"""
Media Extractor nodes — two flavors:

  MediaExtractor          (PurzMediaExtractor)
      Path A. Fast / lightweight. The video itself never touches the server:
      the frontend picks a local file with <input type="file">, plays it in
      a <video> element, lets the user scrub, draws the chosen frame to a
      <canvas>, and posts that single PNG to /purz/media_extractor/set_frame.
      On execution the backend just decodes that cached PNG.

  MediaExtractorUpload    (PurzMediaExtractorUpload)
      Path B. Heavier but persistent across browser reloads. The user
      uploads the video file to ComfyUI's input/ directory; the workflow
      remembers the filename and frame_index. On execution the backend
      opens the file with cv2 and seeks to the requested frame.

Both nodes live in the same Purz/Interactive category. V3 wrappers live
in media_extractor_v3.py.
"""

import base64
import io as _io
import json
import os
import re

import numpy as np
import torch
import cv2
from PIL import Image

import folder_paths

try:
    from server import PromptServer
    from aiohttp import web
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False


VIDEO_EXTENSIONS = (".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v", ".gif")
NO_VIDEO_PLACEHOLDER = "(no video)"

# node_id (str) -> base64 PNG (str). Written by the Path-A frontend on
# every selection commit; read by the Path-A backend on execute.
PURZ_MEDIA_FRAMES = {}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _black_frame():
    return torch.zeros((1, 64, 64, 3), dtype=torch.float32)


def decode_frame_b64(frame_b64):
    """Decode a base64 PNG string into a [1, H, W, 3] float32 tensor."""
    if not frame_b64:
        return _black_frame()
    try:
        if "," in frame_b64:
            frame_b64 = frame_b64.split(",", 1)[1]
        png_bytes = base64.b64decode(frame_b64)
        pil = Image.open(_io.BytesIO(png_bytes)).convert("RGB")
        arr = np.array(pil).astype(np.float32) / 255.0
        return torch.from_numpy(arr).unsqueeze(0)
    except Exception as e:
        print(f"[Purz MediaExtractor] Failed to decode frame: {e}")
        return _black_frame()


def list_input_videos():
    """Return sorted list of video filenames in ComfyUI's input directory."""
    input_dir = folder_paths.get_input_directory()
    try:
        files = [
            f for f in os.listdir(input_dir)
            if os.path.isfile(os.path.join(input_dir, f))
            and f.lower().endswith(VIDEO_EXTENSIONS)
        ]
    except FileNotFoundError:
        files = []
    return sorted(files)


def extract_frame_from_video(video_filename, frame_index):
    """
    Open a video from input/ with cv2 and return frame_index as a
    [1, H, W, 3] float32 tensor. Returns a black frame on any failure.
    """
    if not video_filename or video_filename == NO_VIDEO_PLACEHOLDER:
        return _black_frame()

    input_dir = folder_paths.get_input_directory()
    video_path = os.path.join(input_dir, video_filename)

    real_path = os.path.realpath(video_path)
    if not real_path.startswith(os.path.realpath(input_dir)):
        print(f"[Purz MediaExtractor] Rejected path outside input dir: {video_filename}")
        return _black_frame()

    if not os.path.exists(real_path):
        print(f"[Purz MediaExtractor] Video not found: {video_filename}")
        return _black_frame()

    cap = cv2.VideoCapture(real_path)
    try:
        if not cap.isOpened():
            print(f"[Purz MediaExtractor] Could not open: {video_filename}")
            return _black_frame()

        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0:
            total = 1
        idx = max(0, min(int(frame_index), total - 1))

        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame_bgr = cap.read()
        if not ok or frame_bgr is None:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame_bgr = cap.read()
            if not ok or frame_bgr is None:
                print(f"[Purz MediaExtractor] Failed to read frame {idx} from {video_filename}")
                return _black_frame()

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        tensor = torch.from_numpy(frame_rgb.astype(np.float32) / 255.0).unsqueeze(0)
        return tensor
    finally:
        cap.release()


# ---------------------------------------------------------------------------
# Path A — MediaExtractor (client-side video, no server upload)
# ---------------------------------------------------------------------------

class MediaExtractor:
    """Pick a frame from a locally-loaded video. The file never hits the server."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "process"
    CATEGORY = "Purz/Interactive"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # Selected frame lives in PURZ_MEDIA_FRAMES (written by the frontend),
        # so input identity alone won't catch changes. Always re-execute.
        return float("nan")

    def process(self, unique_id=None):
        node_id = str(unique_id) if unique_id is not None else None
        frame_b64 = PURZ_MEDIA_FRAMES.get(node_id) if node_id else None
        return (decode_frame_b64(frame_b64),)


# ---------------------------------------------------------------------------
# Path B — MediaExtractorUpload (server-side video, persists across reloads)
# ---------------------------------------------------------------------------

class MediaExtractorUpload:
    """
    Pick a frame from a video uploaded to ComfyUI's input directory.
    The video filename + frame index serialize with the workflow.
    """

    @classmethod
    def INPUT_TYPES(cls):
        videos = list_input_videos()
        if not videos:
            videos = [NO_VIDEO_PLACEHOLDER]
        return {
            "required": {
                "video": (videos,),
                "frame_index": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "process"
    CATEGORY = "Purz/Interactive"

    @classmethod
    def IS_CHANGED(cls, video, frame_index, **kwargs):
        # Invalidate when the underlying file's content changes
        # (same name re-uploaded). frame_index is part of input identity.
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return ""
        input_dir = folder_paths.get_input_directory()
        path = os.path.join(input_dir, video)
        try:
            return f"{os.path.getmtime(path)}:{frame_index}"
        except OSError:
            return ""

    def process(self, video, frame_index, unique_id=None):
        return (extract_frame_from_video(video, frame_index),)


# ---------------------------------------------------------------------------
# Server routes
# ---------------------------------------------------------------------------

if HAS_SERVER:

    # ---- Path A -----------------------------------------------------------
    @PromptServer.instance.routes.post("/purz/media_extractor/set_frame")
    async def set_media_frame(request):
        """Cache the current frame for a Path-A node. Body: {node_id, frame: dataURL}."""
        try:
            body = await request.read()
            data = json.loads(body.decode("utf-8"))
            node_id = str(data.get("node_id", ""))
            frame_b64 = data.get("frame", "")
            if not node_id:
                return web.json_response({"error": "missing node_id"}, status=400)
            if frame_b64:
                PURZ_MEDIA_FRAMES[node_id] = frame_b64
            else:
                PURZ_MEDIA_FRAMES.pop(node_id, None)
            return web.json_response({"success": True})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    # ---- Path B -----------------------------------------------------------
    @PromptServer.instance.routes.post("/purz/media_extractor/upload")
    async def upload_video(request):
        """
        Multipart upload of a video file into ComfyUI's input directory.
        Streams chunks to disk to avoid loading the full video into memory.
        Returns the saved filename + cv2-derived metadata.
        """
        try:
            reader = await request.multipart()
            field = await reader.next()
            if field is None or field.name != "video":
                return web.json_response({"error": "expected a 'video' field"}, status=400)

            raw_name = field.filename or "uploaded_video.mp4"
            base_name = os.path.basename(raw_name)
            safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", base_name)
            if not safe_name or safe_name.startswith("."):
                safe_name = "video.mp4"
            if not safe_name.lower().endswith(VIDEO_EXTENSIONS):
                safe_name += ".mp4"

            input_dir = folder_paths.get_input_directory()
            os.makedirs(input_dir, exist_ok=True)
            out_path = os.path.join(input_dir, safe_name)

            # Don't clobber existing files of the same name.
            if os.path.exists(out_path):
                stem, ext = os.path.splitext(safe_name)
                n = 1
                while os.path.exists(os.path.join(input_dir, f"{stem}_{n}{ext}")):
                    n += 1
                safe_name = f"{stem}_{n}{ext}"
                out_path = os.path.join(input_dir, safe_name)

            with open(out_path, "wb") as f:
                while True:
                    chunk = await field.read_chunk(size=64 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)

            info = {"name": safe_name}
            cap = cv2.VideoCapture(out_path)
            try:
                if cap.isOpened():
                    info["total_frames"] = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    info["fps"] = float(cap.get(cv2.CAP_PROP_FPS)) or 0.0
                    info["width"] = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    info["height"] = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            finally:
                cap.release()

            return web.json_response(info)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.get("/purz/media_extractor/info/{filename:.*}")
    async def get_video_info(request):
        """Return frame count / fps / dimensions for a video in the input dir."""
        try:
            filename = request.match_info["filename"]
            input_dir = folder_paths.get_input_directory()
            path = os.path.join(input_dir, filename)
            real_path = os.path.realpath(path)
            if not real_path.startswith(os.path.realpath(input_dir)):
                return web.json_response({"error": "invalid path"}, status=400)
            if not os.path.exists(real_path):
                return web.json_response({"error": "not found"}, status=404)

            cap = cv2.VideoCapture(real_path)
            try:
                if not cap.isOpened():
                    return web.json_response({"error": "could not open video"}, status=500)
                return web.json_response({
                    "total_frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
                    "fps": float(cap.get(cv2.CAP_PROP_FPS)) or 0.0,
                    "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                    "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                })
            finally:
                cap.release()
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.get("/purz/media_extractor/list")
    async def list_videos_endpoint(request):
        """Return the current list of video files in the input directory."""
        try:
            return web.json_response({"videos": list_input_videos()})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)


# ---------------------------------------------------------------------------
# Node registration (V1 fallback)
# ---------------------------------------------------------------------------

MEDIA_EXTRACTOR_NODE_CLASS_MAPPINGS = {
    "PurzMediaExtractor": MediaExtractor,
    "PurzMediaExtractorUpload": MediaExtractorUpload,
}

MEDIA_EXTRACTOR_NODE_DISPLAY_NAME_MAPPINGS = {
    "PurzMediaExtractor": "Media Extractor (Purz)",
    "PurzMediaExtractorUpload": "Media Extractor Upload (Purz)",
}
