"""
Media Extractor - V3 Schema (both flavors).

Thin wrappers around the V1 module's logic. See media_extractor.py for the
distinction between MediaExtractor (client-side) and MediaExtractorUpload
(server-side).
"""

from comfy_api.latest import io

from .media_extractor import (
    PURZ_MEDIA_FRAMES,
    NO_VIDEO_PLACEHOLDER,
    decode_frame_b64,
    extract_frame_from_video,
    list_input_videos,
)


class MediaExtractor(io.ComfyNode):
    """Pick a frame from a locally-loaded video. The file never hits the server."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzMediaExtractor",
            display_name="Media Extractor (Purz)",
            category="Purz/Interactive",
            description="Load a video in the browser, scrub to a frame, output that frame. Video file stays client-side.",
            inputs=[],
            outputs=[
                io.Image.Output(display_name="image"),
            ],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs) -> float:
        return float("nan")

    @classmethod
    def execute(cls, **kwargs) -> io.NodeOutput:
        node_id = str(cls.hidden.unique_id) if cls.hidden and cls.hidden.unique_id else None
        frame_b64 = PURZ_MEDIA_FRAMES.get(node_id) if node_id else None
        return io.NodeOutput(decode_frame_b64(frame_b64))


class MediaExtractorUpload(io.ComfyNode):
    """Pick a frame from a video uploaded to ComfyUI's input directory."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        videos = list_input_videos()
        if not videos:
            videos = [NO_VIDEO_PLACEHOLDER]
        return io.Schema(
            node_id="PurzMediaExtractorUpload",
            display_name="Media Extractor Upload (Purz)",
            category="Purz/Interactive",
            description="Upload a video to ComfyUI's input directory, scrub to a frame, output that frame. Persists across browser reloads.",
            inputs=[
                io.Combo.Input("video", options=videos, default=videos[0]),
                io.Int.Input("frame_index", default=0, min=0, max=999999, step=1),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def fingerprint_inputs(cls, video, frame_index, **kwargs):
        import os
        import folder_paths
        if not video or video == NO_VIDEO_PLACEHOLDER:
            return ""
        path = os.path.join(folder_paths.get_input_directory(), video)
        try:
            return f"{os.path.getmtime(path)}:{frame_index}"
        except OSError:
            return ""

    @classmethod
    def execute(cls, video, frame_index, **kwargs) -> io.NodeOutput:
        return io.NodeOutput(extract_frame_from_video(video, frame_index))
