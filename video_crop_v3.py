"""Video Crop — V3 wrappers."""

import os
import time
import random

from comfy_api.latest import io
from comfy_api.input_impl import VideoFromFile

import folder_paths

from .video_crop import (
    PURZ_VIDEO_CROP_BAKED,
    PURZ_VIDEO_CROP_BAKE_READY,
    PURZ_VIDEO_CROP_BAKE_ID,
    list_input_videos,
    resize_video_file,
    _empty_video,
    _read_cached_video_with_diag,
)
from .media_extractor import NO_VIDEO_PLACEHOLDER

try:
    from server import PromptServer
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False


class VideoCrop(io.ComfyNode):
    """Crop / resize a locally-loaded video. Bakes client-side on Queue."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzVideoCrop",
            display_name="Video Crop (Purz)",
            category="Purz/Interactive",
            description="Load a video locally, crop / resize, see the result, output as VIDEO.",
            inputs=[],
            outputs=[io.Video.Output(display_name="video")],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs) -> float:
        return float("nan")

    @classmethod
    def execute(cls, **kwargs) -> io.NodeOutput:
        node_id = str(cls.hidden.unique_id) if cls.hidden and cls.hidden.unique_id is not None else None
        if not node_id or not HAS_SERVER:
            print(f"[Purz VideoCrop V3] Early-return path (node_id={node_id!r}, HAS_SERVER={HAS_SERVER})")
            return io.NodeOutput(_read_cached_video_with_diag(node_id, "VideoCrop V3"))

        bake_id = f"{node_id}_{int(time.time() * 1000)}_{random.randint(0, 99999)}"
        PURZ_VIDEO_CROP_BAKE_ID[node_id] = bake_id
        PURZ_VIDEO_CROP_BAKE_READY[node_id] = False

        cached_path = PURZ_VIDEO_CROP_BAKED.get(node_id)
        has_cached = bool(cached_path and os.path.exists(cached_path))

        PromptServer.instance.send_sync("purz.video_crop.bake_requested", {
            "node_id": node_id,
            "bake_id": bake_id,
            "has_cached": has_cached,
        })

        max_wait = 600.0
        poll_interval = 0.1
        waited = 0.0
        last_log = 0.0
        while not PURZ_VIDEO_CROP_BAKE_READY.get(node_id, False) and waited < max_wait:
            time.sleep(poll_interval)
            waited += poll_interval
            if waited - last_log >= 5.0:
                print(f"[Purz VideoCrop V3] Waiting for frontend bake ({waited:.0f}s)")
                last_log = waited

        time.sleep(0.05)  # let any pending OS write buffer flush
        PURZ_VIDEO_CROP_BAKE_READY.pop(node_id, None)
        PURZ_VIDEO_CROP_BAKE_ID.pop(node_id, None)
        return io.NodeOutput(_read_cached_video_with_diag(node_id, "VideoCrop V3"))


class VideoCropUpload(io.ComfyNode):
    """Crop / resize a video uploaded to ComfyUI's input directory."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        videos = list_input_videos()
        if not videos:
            videos = [NO_VIDEO_PLACEHOLDER]
        return io.Schema(
            node_id="PurzVideoCropUpload",
            display_name="Video Crop Upload (Purz)",
            category="Purz/Interactive",
            description="Upload a video, crop / resize with fit modes (stretch/cover/contain/crop), output as VIDEO.",
            inputs=[
                io.Combo.Input("video", options=videos, default=videos[0]),
                io.Int.Input("width", default=1024, min=16, max=16384, step=1),
                io.Int.Input("height", default=1024, min=16, max=16384, step=1),
                io.Combo.Input("fit_mode", options=["stretch", "cover", "contain", "crop"], default="cover"),
                io.Combo.Input("anchor", options=[
                    "center", "top", "bottom", "left", "right",
                    "top-left", "top-right", "bottom-left", "bottom-right",
                ], default="center"),
                io.String.Input("background_color", default="#000000"),
                io.Float.Input("zoom", default=1.0, min=0.1, max=10.0, step=0.01),
                io.Float.Input("offset_x", default=0.0, min=-1.0, max=1.0, step=0.01),
                io.Float.Input("offset_y", default=0.0, min=-1.0, max=1.0, step=0.01),
            ],
            outputs=[io.Video.Output(display_name="video")],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def fingerprint_inputs(cls, video, width, height, fit_mode, anchor, background_color,
                            zoom, offset_x, offset_y, **kwargs):
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return ""
        path = os.path.join(folder_paths.get_input_directory(), video)
        try:
            return (f"{os.path.getmtime(path)}:{width}:{height}:{fit_mode}:{anchor}"
                    f":{background_color}:{zoom}:{offset_x}:{offset_y}")
        except OSError:
            return ""

    @classmethod
    def execute(cls, video, width, height, fit_mode, anchor, background_color,
                zoom, offset_x, offset_y, **kwargs) -> io.NodeOutput:
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return io.NodeOutput(_empty_video())
        path = os.path.join(folder_paths.get_input_directory(), video)
        if not os.path.exists(path):
            return io.NodeOutput(_empty_video())
        try:
            return io.NodeOutput(resize_video_file(path, width, height, fit_mode, anchor,
                                                    background_color, zoom=zoom,
                                                    offset_x=offset_x, offset_y=offset_y))
        except Exception as e:
            import traceback
            print(f"[Purz VideoCrop Upload V3] Failed to resize {video}: {e}")
            traceback.print_exc()
            return io.NodeOutput(_empty_video())
