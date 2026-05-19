"""
Video Trim - V3 Schema (both flavors).

Thin wrappers around the V1 module's logic. See video_trim.py for the
distinction between VideoTrim (client-side bake) and VideoTrimUpload
(server-side as_trimmed).
"""

import os
import time
import random

from comfy_api.latest import io
from comfy_api.input_impl import VideoFromFile

import folder_paths

from .video_trim import (
    PURZ_TRIM_BAKED,
    PURZ_TRIM_BAKE_READY,
    PURZ_TRIM_BAKE_ID,
    _empty_video,
)
from .media_extractor import list_input_videos, NO_VIDEO_PLACEHOLDER

try:
    from server import PromptServer
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False


class VideoTrim(io.ComfyNode):
    """Trim a video locally and send only the baked segment to the workflow."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzVideoTrim",
            display_name="Video Trim (Purz)",
            category="Purz/Interactive",
            description="Load a video locally, set trim points, bake the segment client-side and output as VIDEO.",
            inputs=[],
            outputs=[
                io.Video.Output(display_name="video"),
            ],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs) -> float:
        return float("nan")

    @classmethod
    def execute(cls, **kwargs) -> io.NodeOutput:
        node_id = str(cls.hidden.unique_id) if cls.hidden and cls.hidden.unique_id else None
        if not node_id or not HAS_SERVER:
            path = PURZ_TRIM_BAKED.get(node_id) if node_id else None
            if path and os.path.exists(path):
                return io.NodeOutput(VideoFromFile(path))
            return io.NodeOutput(_empty_video())

        # Tell the frontend to bake. See video_trim.py for the protocol.
        bake_id = f"{node_id}_{int(time.time() * 1000)}_{random.randint(0, 99999)}"
        PURZ_TRIM_BAKE_ID[node_id] = bake_id
        PURZ_TRIM_BAKE_READY[node_id] = False

        PromptServer.instance.send_sync("purz.video_trim.bake_requested", {
            "node_id": node_id,
            "bake_id": bake_id,
        })

        max_wait = 600.0
        poll_interval = 0.1
        waited = 0.0
        last_log = 0.0
        while not PURZ_TRIM_BAKE_READY.get(node_id, False) and waited < max_wait:
            time.sleep(poll_interval)
            waited += poll_interval
            if waited - last_log >= 5.0:
                print(f"[Purz VideoTrim V3] Waiting for frontend bake ({waited:.0f}s elapsed, node {node_id})")
                last_log = waited

        if not PURZ_TRIM_BAKE_READY.get(node_id, False):
            print(f"[Purz VideoTrim V3] Timed out waiting for frontend bake after {waited:.0f}s")

        PURZ_TRIM_BAKE_READY.pop(node_id, None)
        PURZ_TRIM_BAKE_ID.pop(node_id, None)

        path = PURZ_TRIM_BAKED.get(node_id)
        if not path or not os.path.exists(path):
            return io.NodeOutput(_empty_video())
        return io.NodeOutput(VideoFromFile(path))


class VideoTrimUpload(io.ComfyNode):
    """Trim a video uploaded to ComfyUI's input directory (server-side, lazy)."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        videos = list_input_videos()
        if not videos:
            videos = [NO_VIDEO_PLACEHOLDER]
        return io.Schema(
            node_id="PurzVideoTrimUpload",
            display_name="Video Trim Upload (Purz)",
            category="Purz/Interactive",
            description="Upload a video, set trim points, output the trimmed VIDEO. Persists across browser reloads.",
            inputs=[
                io.Combo.Input("video", options=videos, default=videos[0]),
                io.Float.Input("trim_start_seconds", default=0.0, min=0.0, max=99999.0, step=0.001),
                io.Float.Input("trim_end_seconds", default=1.0, min=0.0, max=99999.0, step=0.001),
            ],
            outputs=[
                io.Video.Output(display_name="video"),
            ],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def fingerprint_inputs(cls, video, trim_start_seconds, trim_end_seconds, **kwargs):
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return ""
        path = os.path.join(folder_paths.get_input_directory(), video)
        try:
            return f"{os.path.getmtime(path)}:{trim_start_seconds}:{trim_end_seconds}"
        except OSError:
            return ""

    @classmethod
    def execute(cls, video, trim_start_seconds, trim_end_seconds, **kwargs) -> io.NodeOutput:
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return io.NodeOutput(_empty_video())
        path = os.path.join(folder_paths.get_input_directory(), video)
        if not os.path.exists(path):
            return io.NodeOutput(_empty_video())

        start = max(0.0, float(trim_start_seconds))
        end = max(start + 0.001, float(trim_end_seconds))
        duration = end - start

        try:
            full = VideoFromFile(path)
            trimmed = full.as_trimmed(start_time=start, duration=duration, strict_duration=False)
            if trimmed is None:
                return io.NodeOutput(_empty_video())
            return io.NodeOutput(trimmed)
        except Exception as e:
            import traceback
            print(f"[Purz VideoTrim Upload V3] Failed to trim {video}: {e}")
            traceback.print_exc()
            return io.NodeOutput(_empty_video())
