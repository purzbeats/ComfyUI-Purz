"""
Image Crop nodes — two flavors. Also hosts the resize/crop math helpers
that `video_crop.py` reuses for per-frame transforms.

  ImageCrop          (PurzImageCrop)
      Path A. Source image stays client-side. The frontend renders the
      cropped/resized result to a <canvas>, encodes PNG, and POSTs it to
      /purz/image_crop/set_baked.

  ImageCropUpload    (PurzImageCropUpload)
      Path B. User uploads the source image to ComfyUI's input/ via the
      existing /purz/media_extractor/upload route. Workflow serializes
      filename + width + height + fit_mode + anchor + bg_color + zoom +
      offset_x + offset_y. Backend resize uses PIL with Image.LANCZOS.

Both output a single IMAGE tensor — no dual-output ambiguity.
"""

import os
import time
import random

import numpy as np
import torch
from PIL import Image

import folder_paths

from .utils import hex_to_rgb

try:
    from server import PromptServer
    from aiohttp import web
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False


IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif")
NO_IMAGE_PLACEHOLDER = "(no image)"

# Path A cache: node_id (str) -> path of the baked PNG on disk
PURZ_IMAGE_CROP_BAKED = {}
PURZ_IMAGE_CROP_BAKE_READY = {}
PURZ_IMAGE_CROP_BAKE_ID = {}


# ---------------------------------------------------------------------------
# Shared math (used by video_crop too)
# ---------------------------------------------------------------------------

def _empty_image():
    return torch.zeros((1, 64, 64, 3), dtype=torch.float32)


def list_input_images():
    """List image files in ComfyUI's input directory."""
    input_dir = folder_paths.get_input_directory()
    try:
        return sorted(
            f for f in os.listdir(input_dir)
            if os.path.isfile(os.path.join(input_dir, f))
            and f.lower().endswith(IMAGE_EXTENSIONS)
        )
    except FileNotFoundError:
        return []


def _anchor_offset(anchor, axis, max_offset):
    if max_offset <= 0:
        return 0
    if axis == "x":
        if "left" in anchor:
            return 0
        if "right" in anchor:
            return max_offset
        return max_offset // 2
    if "top" in anchor:
        return 0
    if "bottom" in anchor:
        return max_offset
    return max_offset // 2


def resize_image_pil(pil, out_w, out_h, fit_mode, anchor, bg_color,
                     zoom=1.0, offset_x=0.0, offset_y=0.0):
    """
    Apply fit_mode to a PIL image, return a new PIL image at (out_w, out_h).
    Used by both Image Crop and Video Crop (per-frame).
    """
    src_w, src_h = pil.size
    out_w = max(1, int(out_w))
    out_h = max(1, int(out_h))

    if fit_mode == "stretch":
        return pil.resize((out_w, out_h), Image.LANCZOS)

    bg_rgb = hex_to_rgb(bg_color)
    bg = Image.new("RGB", (out_w, out_h), bg_rgb)

    if fit_mode == "contain":
        src_aspect = src_w / src_h
        out_aspect = out_w / out_h
        if src_aspect > out_aspect:
            dw = out_w
            dh = max(1, int(out_w / src_aspect))
        else:
            dh = out_h
            dw = max(1, int(out_h * src_aspect))
        resized = pil.resize((dw, dh), Image.LANCZOS)
        dx = _anchor_offset(anchor, "x", out_w - dw)
        dy = _anchor_offset(anchor, "y", out_h - dh)
        bg.paste(resized, (dx, dy))
        return bg

    # cover and crop share the same path; crop adds zoom + offset_x/y on top.
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

    cropped = pil.crop((sx, sy, sx + sw, sy + sh))
    return cropped.resize((out_w, out_h), Image.LANCZOS)


def pil_to_image_tensor(pil):
    """[1, H, W, 3] float32 in 0..1."""
    arr = np.array(pil.convert("RGB")).astype(np.float32) / 255.0
    return torch.from_numpy(arr).unsqueeze(0)


def image_tensor_frame_to_pil(frame_tensor):
    """Convert a [H, W, 3] float32 tensor frame to a PIL RGB image."""
    arr = (frame_tensor.cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, mode="RGB")


def resize_image_file(path, out_w, out_h, fit_mode, anchor, bg_color,
                       zoom=1.0, offset_x=0.0, offset_y=0.0):
    """Open an image file and return a resized [1,H,W,3] IMAGE tensor."""
    pil = Image.open(path).convert("RGB")
    resized = resize_image_pil(pil, out_w, out_h, fit_mode, anchor, bg_color,
                                zoom=zoom, offset_x=offset_x, offset_y=offset_y)
    return pil_to_image_tensor(resized)


def _read_cached_image_with_diag(node_id, label):
    """
    Read the baked PNG for `node_id`, returning a [1,H,W,3] tensor.
    On miss, prints a diagnostic line so the user can see WHY (missing key,
    missing file, empty file, decode error) and falls back to a 64×64 black
    tensor.
    """
    if not node_id:
        print(f"[Purz {label}] No node_id passed to _read_cached")
        return _empty_image()
    path = PURZ_IMAGE_CROP_BAKED.get(node_id)
    if not path:
        print(f"[Purz {label}] BAKED dict has no entry for node {node_id!r}. "
              f"Current keys: {list(PURZ_IMAGE_CROP_BAKED.keys())}")
        return _empty_image()
    if not os.path.exists(path):
        print(f"[Purz {label}] Cached file does not exist: {path}")
        return _empty_image()
    try:
        size = os.path.getsize(path)
        if size == 0:
            print(f"[Purz {label}] Cached file is empty: {path}")
            return _empty_image()
        pil = Image.open(path)
        pil.load()  # force decode now (rather than lazily)
        pil = pil.convert("RGB")
        return pil_to_image_tensor(pil)
    except Exception as e:
        print(f"[Purz {label}] Failed to decode cached PNG at {path}: {e}")
        return _empty_image()


# ---------------------------------------------------------------------------
# Path A — ImageCrop (client-side bake)
# ---------------------------------------------------------------------------

class ImageCrop:
    """Crop / resize a locally-loaded image. Bakes client-side on Queue."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "process"
    CATEGORY = "Purz/Interactive"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def process(self, unique_id=None):
        node_id = str(unique_id) if unique_id is not None else None
        if not node_id or not HAS_SERVER:
            print(f"[Purz ImageCrop V1] Early-return path (node_id={node_id!r}, HAS_SERVER={HAS_SERVER})")
            return (self._read_cached(node_id),)

        bake_id = f"{node_id}_{int(time.time() * 1000)}_{random.randint(0, 99999)}"
        PURZ_IMAGE_CROP_BAKE_ID[node_id] = bake_id
        PURZ_IMAGE_CROP_BAKE_READY[node_id] = False

        PromptServer.instance.send_sync("purz.image_crop.bake_requested", {
            "node_id": node_id,
            "bake_id": bake_id,
        })

        max_wait = 300.0
        poll_interval = 0.1
        waited = 0.0
        last_log = 0.0
        while not PURZ_IMAGE_CROP_BAKE_READY.get(node_id, False) and waited < max_wait:
            time.sleep(poll_interval)
            waited += poll_interval
            if waited - last_log >= 5.0:
                print(f"[Purz ImageCrop] Waiting for frontend bake ({waited:.0f}s, node {node_id})")
                last_log = waited

        # Give the OS a moment to make the just-written file visible from
        # this thread before we try to read it (Windows write-buffer races).
        time.sleep(0.05)
        # Don't pop BAKED here — the cached file is needed by re-queues.
        PURZ_IMAGE_CROP_BAKE_READY.pop(node_id, None)
        PURZ_IMAGE_CROP_BAKE_ID.pop(node_id, None)
        return (self._read_cached(node_id),)

    def _read_cached(self, node_id):
        return _read_cached_image_with_diag(node_id, "ImageCrop V1")


# ---------------------------------------------------------------------------
# Path B — ImageCropUpload (server-side resize)
# ---------------------------------------------------------------------------

class ImageCropUpload:
    """Crop / resize an image uploaded to ComfyUI's input directory."""

    @classmethod
    def INPUT_TYPES(cls):
        images = list_input_images()
        if not images:
            images = [NO_IMAGE_PLACEHOLDER]
        return {
            "required": {
                "image": (images,),
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

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "process"
    CATEGORY = "Purz/Interactive"

    @classmethod
    def IS_CHANGED(cls, image, width, height, fit_mode, anchor, background_color,
                   zoom, offset_x, offset_y, **kwargs):
        if not image or image == NO_IMAGE_PLACEHOLDER:
            return ""
        path = os.path.join(folder_paths.get_input_directory(), image)
        try:
            return (f"{os.path.getmtime(path)}:{width}:{height}:{fit_mode}:{anchor}"
                    f":{background_color}:{zoom}:{offset_x}:{offset_y}")
        except OSError:
            return ""

    def process(self, image, width, height, fit_mode, anchor, background_color,
                zoom, offset_x, offset_y, unique_id=None):
        if not image or image == NO_IMAGE_PLACEHOLDER:
            return (_empty_image(),)
        path = os.path.join(folder_paths.get_input_directory(), image)
        if not os.path.exists(path):
            return (_empty_image(),)
        try:
            tensor = resize_image_file(path, width, height, fit_mode, anchor,
                                        background_color, zoom=zoom,
                                        offset_x=offset_x, offset_y=offset_y)
            return (tensor,)
        except Exception as e:
            import traceback
            print(f"[Purz ImageCrop Upload] Failed to resize {image}: {e}")
            traceback.print_exc()
            return (_empty_image(),)


# ---------------------------------------------------------------------------
# Server routes (Path A only)
# ---------------------------------------------------------------------------

if HAS_SERVER:
    @PromptServer.instance.routes.post("/purz/image_crop/set_baked")
    async def set_image_baked(request):
        try:
            node_id = request.query.get("node_id", "").strip()
            if not node_id:
                return web.json_response({"error": "missing node_id"}, status=400)
            temp_dir = folder_paths.get_temp_directory()
            os.makedirs(temp_dir, exist_ok=True)
            safe_id = "".join(c for c in node_id if c.isalnum() or c in "._-") or "node"
            out_path = os.path.join(temp_dir, f"purz_image_crop_{safe_id}.png")
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
                PURZ_IMAGE_CROP_BAKED.pop(node_id, None)
                PURZ_IMAGE_CROP_BAKE_READY[node_id] = True
                return web.json_response({"success": True, "cleared": True})
            PURZ_IMAGE_CROP_BAKED[node_id] = out_path
            PURZ_IMAGE_CROP_BAKE_READY[node_id] = True
            return web.json_response({"success": True, "bytes": size})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/purz/image_crop/bake_ready")
    async def image_bake_ready(request):
        try:
            data = await request.json()
            node_id = str(data.get("node_id", "")).strip()
            if not node_id:
                return web.json_response({"error": "missing node_id"}, status=400)
            PURZ_IMAGE_CROP_BAKE_READY[node_id] = True
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)


IMAGE_CROP_NODE_CLASS_MAPPINGS = {
    "PurzImageCrop": ImageCrop,
    "PurzImageCropUpload": ImageCropUpload,
}

IMAGE_CROP_NODE_DISPLAY_NAME_MAPPINGS = {
    "PurzImageCrop": "Image Crop (Purz)",
    "PurzImageCropUpload": "Image Crop Upload (Purz)",
}
