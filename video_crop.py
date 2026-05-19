"""
Video Crop nodes — two flavors. The per-frame resize math is borrowed from
image_crop.py so the two pairs stay consistent.

  VideoCrop          (PurzVideoCrop)
      Path A. Source video stays client-side. Frontend renders frames via
      a <canvas> + captureStream → MediaRecorder webm, POSTs the encoded
      segment to /purz/video_crop/set_baked.

  VideoCropUpload    (PurzVideoCropUpload)
      Path B. User uploads the source to ComfyUI's input/. Backend uses
      VideoFromFile.get_components() → per-frame PIL resize → new
      VideoFromComponents (audio passes through).

Both output a single VIDEO.
"""

import os
import time
import random
from fractions import Fraction

import cv2
import numpy as np
import torch

import folder_paths
from comfy_api.input_impl import VideoFromFile, VideoFromComponents
from comfy_api.util import VideoComponents

from .utils import hex_to_rgb
from .image_crop import _anchor_offset
from .media_extractor import VIDEO_EXTENSIONS, NO_VIDEO_PLACEHOLDER

try:
    from server import PromptServer
    from aiohttp import web
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False


# Path A cache: node_id (str) -> path of the baked webm on disk
PURZ_VIDEO_CROP_BAKED = {}
PURZ_VIDEO_CROP_BAKE_READY = {}
PURZ_VIDEO_CROP_BAKE_ID = {}


def _empty_video():
    components = VideoComponents(
        images=torch.zeros((1, 64, 64, 3), dtype=torch.float32),
        audio=None,
        frame_rate=Fraction(24, 1),
    )
    return VideoFromComponents(components)


def list_input_videos():
    """List video files in ComfyUI's input directory."""
    input_dir = folder_paths.get_input_directory()
    try:
        return sorted(
            f for f in os.listdir(input_dir)
            if os.path.isfile(os.path.join(input_dir, f))
            and f.lower().endswith(VIDEO_EXTENSIONS)
        )
    except FileNotFoundError:
        return []


def _resize_frame_cv2(arr_uint8, out_w, out_h, fit_mode, anchor, bg_rgb,
                       zoom, offset_x, offset_y):
    """
    Apply fit_mode to a single uint8 [H, W, 3] RGB frame using cv2.resize
    (~10x faster than PIL.Image.LANCZOS for video frames). Returns uint8
    [out_h, out_w, 3] RGB.
    """
    src_h, src_w = arr_uint8.shape[:2]
    out_w = max(1, int(out_w))
    out_h = max(1, int(out_h))

    if fit_mode == "stretch":
        interp = cv2.INTER_AREA if (out_w < src_w) else cv2.INTER_LANCZOS4
        return cv2.resize(arr_uint8, (out_w, out_h), interpolation=interp)

    bg = np.full((out_h, out_w, 3), bg_rgb, dtype=np.uint8)

    if fit_mode == "contain":
        src_aspect = src_w / src_h
        out_aspect = out_w / out_h
        if src_aspect > out_aspect:
            dw = out_w
            dh = max(1, int(out_w / src_aspect))
        else:
            dh = out_h
            dw = max(1, int(out_h * src_aspect))
        interp = cv2.INTER_AREA if (dw < src_w) else cv2.INTER_LANCZOS4
        resized = cv2.resize(arr_uint8, (dw, dh), interpolation=interp)
        dx = _anchor_offset(anchor, "x", out_w - dw)
        dy = _anchor_offset(anchor, "y", out_h - dh)
        bg[dy:dy + dh, dx:dx + dw] = resized
        return bg

    # cover and crop share the same machinery; crop adds zoom + offset.
    z = max(0.1, float(zoom))
    src_aspect = src_w / src_h
    out_aspect = out_w / out_h
    if src_aspect > out_aspect:
        sh = src_h
        sw = max(1, int(src_h * out_aspect))
    else:
        sw = src_w
        sh = max(1, int(src_w / out_aspect))
    sw = max(1, int(sw / z))
    sh = max(1, int(sh / z))
    sw = min(sw, src_w)
    sh = min(sh, src_h)

    sx = _anchor_offset(anchor, "x", src_w - sw)
    sy = _anchor_offset(anchor, "y", src_h - sh)
    slack_x = (src_w - sw) // 2
    slack_y = (src_h - sh) // 2
    sx = sx + int(offset_x * slack_x)
    sy = sy + int(offset_y * slack_y)
    sx = max(0, min(sx, src_w - sw))
    sy = max(0, min(sy, src_h - sh))

    cropped = arr_uint8[sy:sy + sh, sx:sx + sw]
    interp = cv2.INTER_AREA if (out_w < sw) else cv2.INTER_LANCZOS4
    return cv2.resize(cropped, (out_w, out_h), interpolation=interp)


def resize_video_file(path, out_w, out_h, fit_mode, anchor, bg_color,
                       zoom=1.0, offset_x=0.0, offset_y=0.0):
    """
    Read a video, apply per-frame resize via cv2, return a new VIDEO.
    Materializes all frames in memory — scales with frame_count × output_area.
    Audio passes through unchanged. Uses cv2.INTER_AREA for downscale and
    cv2.INTER_LANCZOS4 for upscale.
    """
    src = VideoFromFile(path)
    components = src.get_components()
    images = components.images  # [N, H, W, 3] float32 0-1
    n = images.shape[0]
    if n == 0:
        return _empty_video()

    bg_rgb = hex_to_rgb(bg_color)

    # Single bulk conversion to uint8, then per-frame cv2 ops on the numpy view.
    src_uint8 = (images.cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)

    out_w_int = max(1, int(out_w))
    out_h_int = max(1, int(out_h))
    out_arr = np.empty((n, out_h_int, out_w_int, 3), dtype=np.uint8)
    for i in range(n):
        out_arr[i] = _resize_frame_cv2(
            src_uint8[i], out_w_int, out_h_int, fit_mode, anchor, bg_rgb,
            zoom, offset_x, offset_y,
        )

    out_tensor = torch.from_numpy(out_arr.astype(np.float32) / 255.0)
    return VideoFromComponents(VideoComponents(
        images=out_tensor,
        audio=components.audio,
        frame_rate=components.frame_rate,
    ))


# ---------------------------------------------------------------------------
# Path A — VideoCrop (client-side bake)
# ---------------------------------------------------------------------------

class VideoCrop:
    """Crop / resize a locally-loaded video. Bakes client-side on Queue."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    RETURN_TYPES = ("VIDEO",)
    RETURN_NAMES = ("video",)
    FUNCTION = "process"
    CATEGORY = "Purz/Interactive"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def process(self, unique_id=None):
        node_id = str(unique_id) if unique_id is not None else None
        if not node_id or not HAS_SERVER:
            print(f"[Purz VideoCrop V1] Early-return path (node_id={node_id!r}, HAS_SERVER={HAS_SERVER})")
            return (self._read_cached(node_id),)

        bake_id = f"{node_id}_{int(time.time() * 1000)}_{random.randint(0, 99999)}"
        PURZ_VIDEO_CROP_BAKE_ID[node_id] = bake_id
        PURZ_VIDEO_CROP_BAKE_READY[node_id] = False

        PromptServer.instance.send_sync("purz.video_crop.bake_requested", {
            "node_id": node_id,
            "bake_id": bake_id,
        })

        max_wait = 600.0
        poll_interval = 0.1
        waited = 0.0
        last_log = 0.0
        while not PURZ_VIDEO_CROP_BAKE_READY.get(node_id, False) and waited < max_wait:
            time.sleep(poll_interval)
            waited += poll_interval
            if waited - last_log >= 5.0:
                print(f"[Purz VideoCrop] Waiting for frontend bake ({waited:.0f}s, node {node_id})")
                last_log = waited

        time.sleep(0.05)  # let any pending OS write buffer flush
        PURZ_VIDEO_CROP_BAKE_READY.pop(node_id, None)
        PURZ_VIDEO_CROP_BAKE_ID.pop(node_id, None)
        return (self._read_cached(node_id),)

    def _read_cached(self, node_id):
        return _read_cached_video_with_diag(node_id, "VideoCrop V1")


def _read_cached_video_with_diag(node_id, label):
    if not node_id:
        print(f"[Purz {label}] No node_id passed to _read_cached")
        return _empty_video()
    path = PURZ_VIDEO_CROP_BAKED.get(node_id)
    if not path:
        print(f"[Purz {label}] BAKED dict has no entry for node {node_id!r}. "
              f"Current keys: {list(PURZ_VIDEO_CROP_BAKED.keys())}")
        return _empty_video()
    if not os.path.exists(path):
        print(f"[Purz {label}] Cached file does not exist: {path}")
        return _empty_video()
    try:
        size = os.path.getsize(path)
        if size == 0:
            print(f"[Purz {label}] Cached file is empty: {path}")
            return _empty_video()
        return VideoFromFile(path)
    except Exception as e:
        print(f"[Purz {label}] Failed to read cached webm at {path}: {e}")
        return _empty_video()


# ---------------------------------------------------------------------------
# Path B — VideoCropUpload (server-side resize)
# ---------------------------------------------------------------------------

class VideoCropUpload:
    """Crop / resize a video uploaded to ComfyUI's input directory."""

    @classmethod
    def INPUT_TYPES(cls):
        videos = list_input_videos()
        if not videos:
            videos = [NO_VIDEO_PLACEHOLDER]
        return {
            "required": {
                "video": (videos,),
                "width": ("INT", {"default": 1024, "min": 16, "max": 16384, "step": 1}),
                "height": ("INT", {"default": 1024, "min": 16, "max": 16384, "step": 1}),
                "fit_mode": (["stretch", "cover", "contain", "crop"],),
                "anchor": ([
                    "center", "top", "bottom", "left", "right",
                    "top-left", "top-right", "bottom-left", "bottom-right",
                ],),
                "background_color": ("STRING", {"default": "#000000"}),
                "zoom": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 10.0, "step": 0.01}),
                "offset_x": ("FLOAT", {"default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01}),
                "offset_y": ("FLOAT", {"default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01}),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    RETURN_TYPES = ("VIDEO",)
    RETURN_NAMES = ("video",)
    FUNCTION = "process"
    CATEGORY = "Purz/Interactive"

    @classmethod
    def IS_CHANGED(cls, video, width, height, fit_mode, anchor, background_color,
                   zoom, offset_x, offset_y, **kwargs):
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return ""
        path = os.path.join(folder_paths.get_input_directory(), video)
        try:
            return (f"{os.path.getmtime(path)}:{width}:{height}:{fit_mode}:{anchor}"
                    f":{background_color}:{zoom}:{offset_x}:{offset_y}")
        except OSError:
            return ""

    def process(self, video, width, height, fit_mode, anchor, background_color,
                zoom, offset_x, offset_y, unique_id=None):
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return (_empty_video(),)
        path = os.path.join(folder_paths.get_input_directory(), video)
        if not os.path.exists(path):
            return (_empty_video(),)
        try:
            return (resize_video_file(path, width, height, fit_mode, anchor,
                                       background_color, zoom=zoom,
                                       offset_x=offset_x, offset_y=offset_y),)
        except Exception as e:
            import traceback
            print(f"[Purz VideoCrop Upload] Failed to resize {video}: {e}")
            traceback.print_exc()
            return (_empty_video(),)


# ---------------------------------------------------------------------------
# Server routes (Path A only)
# ---------------------------------------------------------------------------

if HAS_SERVER:
    @PromptServer.instance.routes.post("/purz/video_crop/set_baked")
    async def set_video_crop_baked(request):
        try:
            node_id = request.query.get("node_id", "").strip()
            if not node_id:
                return web.json_response({"error": "missing node_id"}, status=400)
            temp_dir = folder_paths.get_temp_directory()
            os.makedirs(temp_dir, exist_ok=True)
            safe_id = "".join(c for c in node_id if c.isalnum() or c in "._-") or "node"
            out_path = os.path.join(temp_dir, f"purz_video_crop_{safe_id}.webm")
            with open(out_path, "wb") as f:
                async for chunk in request.content.iter_chunked(64 * 1024):
                    f.write(chunk)
                f.flush()
                try:
                    os.fsync(f.fileno())
                except OSError:
                    pass
            size = os.path.getsize(out_path)
            if size == 0:
                try:
                    os.remove(out_path)
                except OSError:
                    pass
                PURZ_VIDEO_CROP_BAKED.pop(node_id, None)
                PURZ_VIDEO_CROP_BAKE_READY[node_id] = True
                return web.json_response({"success": True, "cleared": True})
            PURZ_VIDEO_CROP_BAKED[node_id] = out_path
            PURZ_VIDEO_CROP_BAKE_READY[node_id] = True
            return web.json_response({"success": True, "bytes": size})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/purz/video_crop/bake_ready")
    async def video_crop_bake_ready(request):
        try:
            data = await request.json()
            node_id = str(data.get("node_id", "")).strip()
            if not node_id:
                return web.json_response({"error": "missing node_id"}, status=400)
            PURZ_VIDEO_CROP_BAKE_READY[node_id] = True
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)


VIDEO_CROP_NODE_CLASS_MAPPINGS = {
    "PurzVideoCrop": VideoCrop,
    "PurzVideoCropUpload": VideoCropUpload,
}

VIDEO_CROP_NODE_DISPLAY_NAME_MAPPINGS = {
    "PurzVideoCrop": "Video Crop (Purz)",
    "PurzVideoCropUpload": "Video Crop Upload (Purz)",
}
