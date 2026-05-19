"""Image Crop — V3 wrappers."""

import os
import time
import random

from comfy_api.latest import io

import folder_paths

from .image_crop import (
    PURZ_IMAGE_CROP_BAKED,
    PURZ_IMAGE_CROP_BAKE_READY,
    PURZ_IMAGE_CROP_BAKE_ID,
    NO_IMAGE_PLACEHOLDER,
    list_input_images,
    resize_image_file,
    pil_to_image_tensor,
    _empty_image,
    _read_cached_image_with_diag,
)
from PIL import Image

try:
    from server import PromptServer
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False


class ImageCrop(io.ComfyNode):
    """Crop / resize a locally-loaded image. Bakes client-side on Queue."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzImageCrop",
            display_name="Image Crop (Purz)",
            category="Purz/Interactive",
            description="Load an image locally, crop / resize, see the result, output as IMAGE.",
            inputs=[],
            outputs=[io.Image.Output(display_name="image")],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def fingerprint_inputs(cls, **kwargs) -> float:
        return float("nan")

    @classmethod
    def execute(cls, **kwargs) -> io.NodeOutput:
        node_id = str(cls.hidden.unique_id) if cls.hidden and cls.hidden.unique_id is not None else None
        if not node_id or not HAS_SERVER:
            print(f"[Purz ImageCrop V3] Early-return path (node_id={node_id!r}, HAS_SERVER={HAS_SERVER})")
            return io.NodeOutput(_read_cached_image_with_diag(node_id, "ImageCrop V3"))

        bake_id = f"{node_id}_{int(time.time() * 1000)}_{random.randint(0, 99999)}"
        PURZ_IMAGE_CROP_BAKE_ID[node_id] = bake_id
        PURZ_IMAGE_CROP_BAKE_READY[node_id] = False

        cached_path = PURZ_IMAGE_CROP_BAKED.get(node_id)
        has_cached = bool(cached_path and os.path.exists(cached_path))

        PromptServer.instance.send_sync("purz.image_crop.bake_requested", {
            "node_id": node_id,
            "bake_id": bake_id,
            "has_cached": has_cached,
        })

        max_wait = 300.0
        poll_interval = 0.1
        waited = 0.0
        last_log = 0.0
        while not PURZ_IMAGE_CROP_BAKE_READY.get(node_id, False) and waited < max_wait:
            time.sleep(poll_interval)
            waited += poll_interval
            if waited - last_log >= 5.0:
                print(f"[Purz ImageCrop V3] Waiting for frontend bake ({waited:.0f}s)")
                last_log = waited

        time.sleep(0.05)  # let any pending OS write buffer flush
        PURZ_IMAGE_CROP_BAKE_READY.pop(node_id, None)
        PURZ_IMAGE_CROP_BAKE_ID.pop(node_id, None)
        return io.NodeOutput(_read_cached_image_with_diag(node_id, "ImageCrop V3"))


class ImageCropUpload(io.ComfyNode):
    """Crop / resize an image uploaded to ComfyUI's input directory."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        images = list_input_images()
        if not images:
            images = [NO_IMAGE_PLACEHOLDER]
        return io.Schema(
            node_id="PurzImageCropUpload",
            display_name="Image Crop Upload (Purz)",
            category="Purz/Interactive",
            description="Upload an image, crop / resize with fit modes (stretch/cover/contain/crop), output as IMAGE.",
            inputs=[
                io.Combo.Input("image", options=images, default=images[0]),
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
            outputs=[io.Image.Output(display_name="image")],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def fingerprint_inputs(cls, image, width, height, fit_mode, anchor, background_color,
                            zoom, offset_x, offset_y, **kwargs):
        if not image or image == NO_IMAGE_PLACEHOLDER:
            return ""
        path = os.path.join(folder_paths.get_input_directory(), image)
        try:
            return (f"{os.path.getmtime(path)}:{width}:{height}:{fit_mode}:{anchor}"
                    f":{background_color}:{zoom}:{offset_x}:{offset_y}")
        except OSError:
            return ""

    @classmethod
    def execute(cls, image, width, height, fit_mode, anchor, background_color,
                zoom, offset_x, offset_y, **kwargs) -> io.NodeOutput:
        if not image or image == NO_IMAGE_PLACEHOLDER:
            return io.NodeOutput(_empty_image())
        path = os.path.join(folder_paths.get_input_directory(), image)
        if not os.path.exists(path):
            return io.NodeOutput(_empty_image())
        try:
            tensor = resize_image_file(path, width, height, fit_mode, anchor,
                                        background_color, zoom=zoom,
                                        offset_x=offset_x, offset_y=offset_y)
            return io.NodeOutput(tensor)
        except Exception as e:
            import traceback
            print(f"[Purz ImageCrop Upload V3] Failed to resize {image}: {e}")
            traceback.print_exc()
            return io.NodeOutput(_empty_image())
