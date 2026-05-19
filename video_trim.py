"""
Video Trim nodes — two flavors.

  VideoTrim          (PurzVideoTrim)
      Path A. Source video stays client-side. The frontend uses
      MediaRecorder to bake the trim segment (via <video>.captureStream())
      into a webm Blob and uploads just that segment to
      /purz/video_trim/set_baked. Cost = real-time playback duration of
      the trim, but the source video bytes never reach the server.

  VideoTrimUpload    (PurzVideoTrimUpload)
      Path B. User uploads the source video to ComfyUI's input/ directory
      (reusing the existing /purz/media_extractor/upload endpoint). On
      execute the backend uses VideoFromFile(...).as_trimmed(start, dur)
      which is lazy — no re-encoding, just a windowed read.

Both nodes output a VIDEO (comfy_api VideoInput).
"""

import os
import time
import random

import torch
from fractions import Fraction

import folder_paths
from comfy_api.input_impl import VideoFromFile, VideoFromComponents
from comfy_api.util import VideoComponents

try:
    from server import PromptServer
    from aiohttp import web
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False


# node_id (str) -> absolute path of the baked webm on disk
PURZ_TRIM_BAKED = {}
# node_id (str) -> True once the frontend has acknowledged a bake request
PURZ_TRIM_BAKE_READY = {}
# node_id (str) -> bake_id of the current outstanding request (race-safety)
PURZ_TRIM_BAKE_ID = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_video():
    """Single-frame black VIDEO fallback for unset / failed cases."""
    components = VideoComponents(
        images=torch.zeros((1, 64, 64, 3), dtype=torch.float32),
        audio=None,
        frame_rate=Fraction(24, 1),
    )
    return VideoFromComponents(components)


def _baked_path_for(node_id):
    """Path inside ComfyUI's temp dir where Path A stores baked webm blobs."""
    temp_dir = folder_paths.get_temp_directory()
    os.makedirs(temp_dir, exist_ok=True)
    safe_id = "".join(c for c in str(node_id) if c.isalnum() or c in "._-") or "node"
    return os.path.join(temp_dir, f"purz_trim_{safe_id}.webm")


# ---------------------------------------------------------------------------
# Path A — VideoTrim (client-side bake via MediaRecorder)
# ---------------------------------------------------------------------------

class VideoTrim:
    """Trim a video locally and send only the baked segment to the workflow."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("VIDEO",)
    RETURN_NAMES = ("video",)
    FUNCTION = "process"
    CATEGORY = "Purz/Interactive"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # The baked blob lives in PURZ_TRIM_BAKED and changes whenever the
        # user re-bakes; input identity alone won't catch it.
        return float("nan")

    def process(self, unique_id=None):
        node_id = str(unique_id) if unique_id is not None else None
        if not node_id or not HAS_SERVER:
            path = PURZ_TRIM_BAKED.get(node_id) if node_id else None
            if path and os.path.exists(path):
                return (VideoFromFile(path),)
            return (_empty_video(),)

        # Signal the frontend to bake the current trim. The frontend will
        # POST the baked webm (which sets PURZ_TRIM_BAKE_READY), or POST a
        # short ack via /bake_ready if the existing bake is still fresh,
        # or POST an empty body to /set_baked if there's no video loaded.
        bake_id = f"{node_id}_{int(time.time() * 1000)}_{random.randint(0, 99999)}"
        PURZ_TRIM_BAKE_ID[node_id] = bake_id
        PURZ_TRIM_BAKE_READY[node_id] = False

        PromptServer.instance.send_sync("purz.video_trim.bake_requested", {
            "node_id": node_id,
            "bake_id": bake_id,
        })

        # Wait. Bakes are real-time, so allow up to 10 minutes for long clips.
        max_wait = 600.0
        poll_interval = 0.1
        waited = 0.0
        last_log = 0.0
        while not PURZ_TRIM_BAKE_READY.get(node_id, False) and waited < max_wait:
            time.sleep(poll_interval)
            waited += poll_interval
            # Periodic progress log so long bakes don't look hung in the console
            if waited - last_log >= 5.0:
                print(f"[Purz VideoTrim] Waiting for frontend bake ({waited:.0f}s elapsed, node {node_id})")
                last_log = waited

        if not PURZ_TRIM_BAKE_READY.get(node_id, False):
            print(f"[Purz VideoTrim] Timed out waiting for frontend bake after {waited:.0f}s")

        # Cleanup. Leave PURZ_TRIM_BAKED in place — it's the cached file.
        PURZ_TRIM_BAKE_READY.pop(node_id, None)
        PURZ_TRIM_BAKE_ID.pop(node_id, None)

        path = PURZ_TRIM_BAKED.get(node_id)
        if not path or not os.path.exists(path):
            return (_empty_video(),)
        return (VideoFromFile(path),)


# ---------------------------------------------------------------------------
# Path B — VideoTrimUpload (server-side trim via as_trimmed)
# ---------------------------------------------------------------------------

# Imported lazily to avoid a hard dep at import time and to reuse the
# media_extractor video-list / upload routes.
from .media_extractor import list_input_videos, NO_VIDEO_PLACEHOLDER


class VideoTrimUpload:
    """
    Trim a video that has been uploaded to ComfyUI's input/ directory.
    Uses VideoFromFile.as_trimmed() — lazy, no re-encode.
    """

    @classmethod
    def INPUT_TYPES(cls):
        videos = list_input_videos()
        if not videos:
            videos = [NO_VIDEO_PLACEHOLDER]
        return {
            "required": {
                "video": (videos,),
                "trim_start_seconds": ("FLOAT", {
                    "default": 0.0, "min": 0.0, "max": 99999.0, "step": 0.001,
                }),
                "trim_end_seconds": ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 99999.0, "step": 0.001,
                }),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("VIDEO",)
    RETURN_NAMES = ("video",)
    FUNCTION = "process"
    CATEGORY = "Purz/Interactive"

    @classmethod
    def IS_CHANGED(cls, video, trim_start_seconds, trim_end_seconds, **kwargs):
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return ""
        path = os.path.join(folder_paths.get_input_directory(), video)
        try:
            return f"{os.path.getmtime(path)}:{trim_start_seconds}:{trim_end_seconds}"
        except OSError:
            return ""

    def process(self, video, trim_start_seconds, trim_end_seconds, unique_id=None):
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return (_empty_video(),)
        path = os.path.join(folder_paths.get_input_directory(), video)
        if not os.path.exists(path):
            return (_empty_video(),)

        start = max(0.0, float(trim_start_seconds))
        end = max(start + 0.001, float(trim_end_seconds))
        duration = end - start

        try:
            full = VideoFromFile(path)
            # strict_duration=False so we get a clip even if the requested
            # end runs past the source duration.
            trimmed = full.as_trimmed(start_time=start, duration=duration, strict_duration=False)
            if trimmed is None:
                return (_empty_video(),)
            return (trimmed,)
        except Exception as e:
            import traceback
            print(f"[Purz VideoTrim Upload] Failed to trim {video}: {e}")
            traceback.print_exc()
            return (_empty_video(),)


# ---------------------------------------------------------------------------
# Server routes
# ---------------------------------------------------------------------------

if HAS_SERVER:
    @PromptServer.instance.routes.post("/purz/video_trim/set_baked")
    async def set_baked_video(request):
        """
        Receive a Path-A baked trim segment.

        node_id comes in as a query parameter so the body can be the raw
        webm bytes (streamed to disk). Frontend usage:

            fetch(`/purz/video_trim/set_baked?node_id=${nodeId}`,
                  { method: 'POST', body: webmBlob })
        """
        try:
            node_id = request.query.get("node_id", "").strip()
            if not node_id:
                return web.json_response({"error": "missing node_id"}, status=400)

            out_path = _baked_path_for(node_id)
            with open(out_path, "wb") as f:
                async for chunk in request.content.iter_chunked(64 * 1024):
                    f.write(chunk)

            size = os.path.getsize(out_path)
            if size == 0:
                # Empty body clears the cache (no video / dispose).
                try:
                    os.remove(out_path)
                except OSError:
                    pass
                PURZ_TRIM_BAKED.pop(node_id, None)
                # Still mark ready so the backend doesn't block on a node
                # whose user hasn't loaded any video.
                PURZ_TRIM_BAKE_READY[node_id] = True
                return web.json_response({"success": True, "cleared": True})

            PURZ_TRIM_BAKED[node_id] = out_path
            PURZ_TRIM_BAKE_READY[node_id] = True
            return web.json_response({"success": True, "bytes": size})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/purz/video_trim/bake_ready")
    async def bake_ready(request):
        """
        Frontend signals that an existing cached bake is still fresh, or that
        a bake failed and we should stop waiting. No file write — just unblock
        the backend's wait loop.
        """
        try:
            data = await request.json()
            node_id = str(data.get("node_id", "")).strip()
            if not node_id:
                return web.json_response({"error": "missing node_id"}, status=400)
            PURZ_TRIM_BAKE_READY[node_id] = True
            return web.json_response({"success": True})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)


VIDEO_TRIM_NODE_CLASS_MAPPINGS = {
    "PurzVideoTrim": VideoTrim,
    "PurzVideoTrimUpload": VideoTrimUpload,
}

VIDEO_TRIM_NODE_DISPLAY_NAME_MAPPINGS = {
    "PurzVideoTrim": "Video Trim (Purz)",
    "PurzVideoTrimUpload": "Video Trim Upload (Purz)",
}
