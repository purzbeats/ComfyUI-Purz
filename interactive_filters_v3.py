"""
Interactive Image Filter - V3 Schema

Thin wrapper around shared processing logic in interactive_filters.py.
Uses the V3 ComfyNode API for proper schema definition and hidden param access.
"""

import random

import folder_paths
from comfy_api.latest import io

from .interactive_filters import process_interactive_filter


class InteractiveImageFilter(io.ComfyNode):
    """Interactive layer-based image filter with real-time WebGL preview."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzInteractiveFilter",
            display_name="Image Filter Live (Purz)",
            category="Purz/Interactive",
            description="Interactive layer-based image filter with real-time WebGL preview",
            is_output_node=True,
            inputs=[
                io.Image.Input("image"),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ],
            hidden=[io.Hidden.unique_id, io.Hidden.prompt, io.Hidden.extra_pnginfo],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs) -> float:
        return float("nan")  # Always re-execute to pick up filter changes

    @classmethod
    def execute(cls, image, **kwargs) -> io.NodeOutput:
        node_id = str(cls.hidden.unique_id) if cls.hidden and cls.hidden.unique_id else None
        prefix = "_purz_filter_" + ''.join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))

        output_image, results = process_interactive_filter(
            image, node_id,
            folder_paths.get_temp_directory(), "temp", prefix, 1
        )

        return io.NodeOutput(output_image, ui={"purz_images": results})
