"""
Interactive Image Filter System for ComfyUI-Purz - V3 Schema
Modernized node definition using the V3 API.

A layer-based real-time image filter system with WebGL shaders.
Users can stack multiple effects (desaturate, brightness, etc.) with
individual opacity, preview changes instantly via WebGL,
and the filtered result is output when the workflow runs.
"""

import torch
import numpy as np
import base64
import io as python_io
import os
import json
import time
import random
from PIL import Image, ImageFilter

import folder_paths

from comfy_api.latest import io, ui

# Try to import ComfyUI server components for real-time messaging
try:
    from server import PromptServer
    from aiohttp import web
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False
    print("[Purz Interactive V3] Warning: Could not import server components")

# Import global storage from V1 module to share state with server routes
# Routes are registered by V1, so we need to use the same dictionaries
from .interactive_filters import (
    PURZ_FILTER_LAYERS,
    PURZ_RENDERED_IMAGES,
    PURZ_BATCH_PENDING,
    PURZ_BATCH_READY,
    PURZ_BATCH_ID,
)


# =============================================================================
# SERVER-SIDE FILTER IMPLEMENTATIONS
# =============================================================================

def apply_filter(img_np, effect, params, opacity):
    """
    Apply a single filter effect to an image.

    Args:
        img_np: numpy array (H, W, 3) float32 0-1
        effect: string name of effect
        params: dict of parameter values
        opacity: float 0-1

    Returns:
        filtered numpy array
    """
    original = img_np.copy()
    result = img_np.copy()

    # === BASIC ADJUSTMENTS ===
    if effect == "desaturate":
        amount = params.get("amount", 1.0)
        gray = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        gray = np.stack([gray] * 3, axis=-1)
        result = result * (1 - amount) + gray * amount

    elif effect == "brightness":
        amount = params.get("amount", 0.0)
        result = np.clip(result + amount, 0, 1)

    elif effect == "contrast":
        amount = params.get("amount", 0.0)
        result = (result - 0.5) * (1.0 + amount) + 0.5
        result = np.clip(result, 0, 1)

    elif effect == "exposure":
        amount = params.get("amount", 0.0)
        result = result * (2.0 ** amount)
        result = np.clip(result, 0, 1)

    elif effect == "gamma":
        amount = params.get("amount", 1.0)
        gamma = 1.0 / max(amount, 0.01)
        result = np.power(result, gamma)

    elif effect == "vibrance":
        amount = params.get("amount", 0.0)
        max_c = np.max(result, axis=-1)
        min_c = np.min(result, axis=-1)
        sat = max_c - min_c
        amt = amount * (1.0 - sat)
        gray = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        gray = np.stack([gray] * 3, axis=-1)
        result = gray + (result - gray) * (1.0 + amt[..., np.newaxis])
        result = np.clip(result, 0, 1)

    elif effect == "saturation":
        amount = params.get("amount", 0.0)
        gray = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        gray = np.stack([gray] * 3, axis=-1)
        result = gray + (result - gray) * (1.0 + amount)
        result = np.clip(result, 0, 1)

    # === COLOR MANIPULATION ===
    elif effect == "hueShift":
        amount = params.get("amount", 0.0)
        from colorsys import rgb_to_hsv, hsv_to_rgb
        h, w, _ = result.shape
        for y in range(h):
            for x in range(w):
                r, g, b = result[y, x]
                h_val, s, v = rgb_to_hsv(r, g, b)
                h_val = (h_val + amount) % 1.0
                r, g, b = hsv_to_rgb(h_val, s, v)
                result[y, x] = [r, g, b]

    elif effect == "temperature":
        amount = params.get("amount", 0.0)
        result[..., 0] = np.clip(result[..., 0] + amount * 0.3, 0, 1)
        result[..., 2] = np.clip(result[..., 2] - amount * 0.3, 0, 1)

    elif effect == "tint":
        amount = params.get("amount", 0.0)
        result[..., 1] = np.clip(result[..., 1] + amount * 0.3, 0, 1)
        result[..., 0] = np.clip(result[..., 0] - amount * 0.15, 0, 1)
        result[..., 2] = np.clip(result[..., 2] - amount * 0.15, 0, 1)

    elif effect == "colorize":
        hue = params.get("hue", 0.0)
        sat = params.get("saturation", 0.5)
        from colorsys import hsv_to_rgb
        lum = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        h, w = lum.shape
        for y in range(h):
            for x in range(w):
                r, g, b = hsv_to_rgb(hue, sat, lum[y, x])
                result[y, x] = [r, g, b]

    elif effect == "channelMixer":
        result[..., 0] = np.clip(result[..., 0] + params.get("redShift", 0), 0, 1)
        result[..., 1] = np.clip(result[..., 1] + params.get("greenShift", 0), 0, 1)
        result[..., 2] = np.clip(result[..., 2] + params.get("blueShift", 0), 0, 1)

    # === TONE ADJUSTMENTS ===
    elif effect == "highlights":
        amount = params.get("amount", 0.0)
        lum = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        mask = np.clip((lum - 0.5) * 2, 0, 1)
        result = result + amount * mask[..., np.newaxis]
        result = np.clip(result, 0, 1)

    elif effect == "shadows":
        amount = params.get("amount", 0.0)
        lum = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        mask = np.clip(1 - lum * 2, 0, 1)
        result = result + amount * mask[..., np.newaxis]
        result = np.clip(result, 0, 1)

    elif effect == "whites":
        amount = params.get("amount", 0.0)
        lum = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        mask = np.clip((lum - 0.7) / 0.3, 0, 1)
        result = result + amount * mask[..., np.newaxis]
        result = np.clip(result, 0, 1)

    elif effect == "blacks":
        amount = params.get("amount", 0.0)
        lum = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        mask = np.clip(1 - lum / 0.3, 0, 1)
        result = result + amount * mask[..., np.newaxis]
        result = np.clip(result, 0, 1)

    elif effect == "levels":
        black = params.get("blackPoint", 0.0)
        white = params.get("whitePoint", 1.0)
        mid = params.get("midtones", 1.0)
        result = (result - black) / max(white - black, 0.001)
        result = np.clip(result, 0, 1)
        result = np.power(result, 1.0 / max(mid, 0.01))

    elif effect == "curves":
        shadows = params.get("shadows", 0.0)
        mids = params.get("midtones", 0.0)
        highs = params.get("highlights", 0.0)
        c = result
        c = c + shadows * (1 - c) * (1 - c) * c
        c = c + mids * c * (1 - c)
        c = c + highs * c * c * (1 - c)
        result = np.clip(c, 0, 1)

    # === BLUR & SHARPEN ===
    elif effect == "blur":
        amount = params.get("amount", 5.0)
        if amount > 0:
            img_pil = Image.fromarray((result * 255).astype(np.uint8))
            img_pil = img_pil.filter(ImageFilter.GaussianBlur(radius=amount))
            result = np.array(img_pil).astype(np.float32) / 255.0

    elif effect == "sharpen":
        amount = params.get("amount", 0.5)
        if amount > 0:
            img_pil = Image.fromarray((result * 255).astype(np.uint8))
            blurred = img_pil.filter(ImageFilter.GaussianBlur(radius=1))
            img_np_blur = np.array(blurred).astype(np.float32) / 255.0
            diff = result - img_np_blur
            result = result + diff * amount
            result = np.clip(result, 0, 1)

    elif effect == "unsharpMask":
        amount = params.get("amount", 1.0)
        threshold = params.get("threshold", 0.1)
        if amount > 0:
            img_pil = Image.fromarray((result * 255).astype(np.uint8))
            blurred = img_pil.filter(ImageFilter.GaussianBlur(radius=2))
            blur_np = np.array(blurred).astype(np.float32) / 255.0
            diff = result - blur_np
            mask = (np.abs(diff).sum(axis=-1) > threshold).astype(np.float32)
            result = result + diff * amount * mask[..., np.newaxis]
            result = np.clip(result, 0, 1)

    elif effect == "clarity":
        amount = params.get("amount", 0.0)
        if amount != 0:
            img_pil = Image.fromarray((result * 255).astype(np.uint8))
            blurred = img_pil.filter(ImageFilter.GaussianBlur(radius=2))
            blur_np = np.array(blurred).astype(np.float32) / 255.0
            high_pass = result - blur_np
            lum = np.dot(result[..., :3], [0.299, 0.587, 0.114])
            mid_mask = 1 - np.abs(lum - 0.5) * 2
            result = result + high_pass * amount * mid_mask[..., np.newaxis]
            result = np.clip(result, 0, 1)

    elif effect == "dehaze":
        amount = params.get("amount", 0.0)
        gray = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        gray = np.stack([gray] * 3, axis=-1)
        result = (result - 0.5) * (1.0 + amount * 0.5) + 0.5
        result = gray + (result - gray) * (1.0 + amount * 0.3)
        result = np.clip(result, 0, 1)

    # === STYLISTIC EFFECTS ===
    elif effect == "vignette":
        amount = params.get("amount", 0.5)
        softness = params.get("softness", 0.2)
        h, w, _ = result.shape
        y, x = np.ogrid[:h, :w]
        center_y, center_x = h / 2, w / 2
        dist = np.sqrt((x - center_x) ** 2 / (w/2) ** 2 + (y - center_y) ** 2 / (h/2) ** 2)
        vig = 1 - np.clip((dist - (1 - softness)) / softness * amount, 0, 1)
        result = result * vig[..., np.newaxis]

    elif effect == "grain":
        amount = params.get("amount", 0.1)
        noise = (np.random.random(result.shape) * 2 - 1) * amount
        result = np.clip(result + noise, 0, 1)

    elif effect == "posterize":
        levels = int(params.get("levels", 8))
        result = np.floor(result * levels) / (levels - 1)
        result = np.clip(result, 0, 1)

    elif effect == "threshold":
        thresh = params.get("threshold", 0.5)
        gray = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        binary = (gray > thresh).astype(np.float32)
        result = np.stack([binary] * 3, axis=-1)

    elif effect == "invert":
        amount = params.get("amount", 1.0)
        inverted = 1.0 - result
        result = result * (1 - amount) + inverted * amount

    elif effect == "sepia":
        amount = params.get("amount", 1.0)
        sepia_r = result[..., 0] * 0.393 + result[..., 1] * 0.769 + result[..., 2] * 0.189
        sepia_g = result[..., 0] * 0.349 + result[..., 1] * 0.686 + result[..., 2] * 0.168
        sepia_b = result[..., 0] * 0.272 + result[..., 1] * 0.534 + result[..., 2] * 0.131
        sepia = np.stack([sepia_r, sepia_g, sepia_b], axis=-1)
        sepia = np.clip(sepia, 0, 1)
        result = result * (1 - amount) + sepia * amount

    elif effect == "duotone":
        shadow = np.array([params.get("shadowR", 0.1), params.get("shadowG", 0.0), params.get("shadowB", 0.2)])
        highlight = np.array([params.get("highlightR", 1.0), params.get("highlightG", 0.9), params.get("highlightB", 0.6)])
        gray = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        result = shadow + (highlight - shadow) * gray[..., np.newaxis]

    # === EDGE & DETAIL ===
    elif effect == "emboss":
        amount = params.get("amount", 2.0)
        img_pil = Image.fromarray((result * 255).astype(np.uint8))
        embossed = img_pil.filter(ImageFilter.EMBOSS)
        emboss_np = np.array(embossed).astype(np.float32) / 255.0
        result = result * (1 - opacity) + emboss_np * opacity
        opacity = 1.0

    elif effect == "edgeDetect":
        amount = params.get("amount", 1.0)
        img_pil = Image.fromarray((result * 255).astype(np.uint8))
        edges = img_pil.filter(ImageFilter.FIND_EDGES)
        edge_np = np.array(edges).astype(np.float32) / 255.0 * amount
        result = np.clip(edge_np, 0, 1)

    elif effect == "sketch":
        amount = params.get("amount", 4.0)
        img_pil = Image.fromarray((result * 255).astype(np.uint8))
        edges = img_pil.filter(ImageFilter.FIND_EDGES)
        edge_np = np.array(edges).astype(np.float32) / 255.0
        gray_edges = np.dot(edge_np[..., :3], [0.299, 0.587, 0.114])
        sketch = 1 - np.clip(gray_edges * amount, 0, 1)
        result = np.stack([sketch] * 3, axis=-1)

    elif effect == "oilPaint":
        levels = int(params.get("levels", 12))
        radius = params.get("radius", 2.0)
        img_pil = Image.fromarray((result * 255).astype(np.uint8))
        img_pil = img_pil.filter(ImageFilter.GaussianBlur(radius=radius))
        result = np.array(img_pil).astype(np.float32) / 255.0
        result = np.floor(result * levels) / max(levels - 1, 1)

    # === CREATIVE EFFECTS ===
    elif effect == "pixelate":
        size = int(max(1, params.get("size", 8)))
        h, w, c = result.shape
        small = Image.fromarray((result * 255).astype(np.uint8)).resize(
            (max(1, w // size), max(1, h // size)), Image.NEAREST
        )
        result = np.array(small.resize((w, h), Image.NEAREST)).astype(np.float32) / 255.0

    elif effect == "chromatic":
        amount = int(params.get("amount", 2))
        if amount > 0:
            r = np.roll(result[..., 0], amount, axis=1)
            b = np.roll(result[..., 2], -amount, axis=1)
            result = np.stack([r, result[..., 1], b], axis=-1)

    elif effect == "glitch":
        amount = params.get("amount", 0.3)
        seed = params.get("seed", 0.0)
        h, w, _ = result.shape

        def glsl_fract(x):
            return x - np.floor(x)

        def glsl_random(st_x, st_y):
            dot_val = st_x * 12.9898 + st_y * 78.233
            return glsl_fract(np.sin(dot_val) * 43758.5453123)

        for y in range(h):
            tex_y = y / h
            band = np.floor(tex_y * 20.0)
            rnd = glsl_random(band, seed)
            shift = (rnd - 0.5) * amount * 0.1
            if rnd > 0.9:
                shift *= 3.0
            pixel_shift = int(shift * w)
            if pixel_shift != 0:
                result[y, :, 0] = np.roll(original[y, :, 0], pixel_shift)
                result[y, :, 2] = np.roll(original[y, :, 2], -pixel_shift)

    elif effect == "halftone":
        size = int(max(2, params.get("size", 6)))
        h, w, _ = result.shape
        gray = np.dot(result[..., :3], [0.299, 0.587, 0.114])
        halftone = np.zeros_like(gray)
        for y in range(0, h, size):
            for x in range(0, w, size):
                region = gray[y:y+size, x:x+size]
                if region.size > 0:
                    avg = np.mean(region)
                    radius = int((1 - avg) * size / 2)
                    cy, cx = size // 2, size // 2
                    for dy in range(min(size, h - y)):
                        for dx in range(min(size, w - x)):
                            if (dy - cy) ** 2 + (dx - cx) ** 2 <= radius ** 2:
                                halftone[y + dy, x + dx] = 1.0
        result = np.stack([halftone] * 3, axis=-1)

    # === LENS EFFECTS ===
    elif effect == "lensDistort":
        amount = params.get("amount", 0.0)
        if abs(amount) > 0.001:
            h, w, _ = result.shape
            cx, cy = w / 2, h / 2
            y, x = np.ogrid[:h, :w]
            dx = (x - cx) / cx
            dy = (y - cy) / cy
            dist = np.sqrt(dx ** 2 + dy ** 2)
            distortion = 1 + dist ** 2 * amount
            new_x = cx + dx * distortion * cx
            new_y = cy + dy * distortion * cy
            new_x = np.clip(new_x.astype(int), 0, w - 1)
            new_y = np.clip(new_y.astype(int), 0, h - 1)
            result = result[new_y, new_x]

    elif effect == "tiltShift":
        focus = params.get("focus", 0.5)
        range_val = params.get("range", 0.2)
        blur_amount = params.get("blur", 8)
        h, w, _ = result.shape
        y_coords = np.linspace(0, 1, h)
        dist = np.abs(y_coords - focus)
        blur_mask = np.clip((dist - range_val * 0.5) / range_val, 0, 1)
        img_pil = Image.fromarray((result * 255).astype(np.uint8))
        blurred = img_pil.filter(ImageFilter.GaussianBlur(radius=blur_amount))
        blur_np = np.array(blurred).astype(np.float32) / 255.0
        for y in range(h):
            result[y] = result[y] * (1 - blur_mask[y]) + blur_np[y] * blur_mask[y]

    elif effect == "radialBlur":
        amount = params.get("amount", 0.3)
        if amount > 0:
            h, w, _ = result.shape
            samples = 10
            accumulated = np.zeros_like(result)
            for i in range(samples):
                scale = 1.0 - amount * 0.02 * i
                scaled_w = int(w * scale)
                scaled_h = int(h * scale)
                if scaled_w > 0 and scaled_h > 0:
                    img_pil = Image.fromarray((result * 255).astype(np.uint8))
                    scaled = img_pil.resize((scaled_w, scaled_h), Image.BILINEAR)
                    offset_x = (w - scaled_w) // 2
                    offset_y = (h - scaled_h) // 2
                    canvas = np.zeros((h, w, 3), dtype=np.float32)
                    scaled_np = np.array(scaled).astype(np.float32) / 255.0
                    canvas[offset_y:offset_y+scaled_h, offset_x:offset_x+scaled_w] = scaled_np
                    accumulated += canvas
            result = accumulated / samples

    # Apply opacity blend with original
    result = original * (1 - opacity) + result * opacity
    return np.clip(result, 0, 1).astype(np.float32)


def apply_filter_stack(img_np, layers):
    """Apply a stack of filter layers to an image."""
    result = img_np.copy()
    for layer in layers:
        if not layer.get("enabled", True):
            continue
        effect = layer.get("effect", "")
        params = layer.get("params", {})
        opacity = layer.get("opacity", 1.0)
        result = apply_filter(result, effect, params, opacity)
    return result


class InteractiveImageFilter(io.ComfyNode):
    """
    Interactive layer-based image filter with real-time WebGL preview.

    Features:
    - Stack multiple effect layers
    - Per-layer opacity control
    - Real-time preview without re-executing workflow
    - Output is the filtered result
    """

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
        # Always re-execute to pick up filter changes
        return float("nan")

    @classmethod
    def execute(cls, image, **kwargs) -> io.NodeOutput:
        """
        Process the input image(s) with stored filter layers.
        Frontend renders each frame through WebGL, backend outputs the results.
        """
        # V3 nodes are immutable, use local variables instead of instance attributes
        output_dir = folder_paths.get_temp_directory()
        output_type = "temp"
        prefix_append = "_purz_filter_" + ''.join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))
        compress_level = 1

        # Debug: print all kwargs to see what's available
        print(f"[Purz Interactive V3] kwargs: {kwargs}")
        print(f"[Purz Interactive V3] kwargs keys: {list(kwargs.keys())}")

        # Try to get unique_id from various possible locations
        unique_id = None

        # Method 1: Direct kwarg
        if 'unique_id' in kwargs:
            unique_id = kwargs['unique_id']
            print(f"[Purz Interactive V3] Found unique_id in kwargs: {unique_id}")

        # Method 2: Hidden dict
        if unique_id is None and 'hidden' in kwargs:
            hidden = kwargs['hidden']
            if isinstance(hidden, dict) and 'unique_id' in hidden:
                unique_id = hidden['unique_id']
                print(f"[Purz Interactive V3] Found unique_id in hidden dict: {unique_id}")
            elif hasattr(hidden, 'unique_id'):
                unique_id = hidden.unique_id
                print(f"[Purz Interactive V3] Found unique_id in hidden object: {unique_id}")

        # Method 3: Try cls.hidden (V3 pattern)
        if unique_id is None and hasattr(cls, 'hidden') and cls.hidden:
            if hasattr(cls.hidden, 'unique_id'):
                unique_id = cls.hidden.unique_id
                print(f"[Purz Interactive V3] Found unique_id in cls.hidden: {unique_id}")

        node_id = str(unique_id) if unique_id is not None else None

        print(f"[Purz Interactive V3] Final: unique_id={unique_id}, node_id={node_id}, HAS_SERVER={HAS_SERVER}")
        batch_size = image.shape[0]

        # Save ALL original images to temp directory for frontend processing
        filename_prefix = "PurzFilter" + prefix_append
        full_output_folder, filename, counter, subfolder, filename_prefix = folder_paths.get_save_image_path(
            filename_prefix, output_dir, image[0].shape[1], image[0].shape[0]
        )

        results = []
        for i in range(batch_size):
            img_np = (image[i].cpu().numpy() * 255).astype(np.uint8)
            img_pil = Image.fromarray(img_np, mode='RGB')

            file = f"{filename}_{counter:05}_{i:05}.png"
            file_path = os.path.join(full_output_folder, file)
            img_pil.save(file_path, compress_level=compress_level)

            results.append({
                "filename": file,
                "subfolder": subfolder,
                "type": output_type
            })

        output_image = image

        print(f"[Purz Interactive V3] execute() called: node_id={node_id}, batch_size={batch_size}, HAS_SERVER={HAS_SERVER}")

        # Always signal to frontend and wait for processing
        # The frontend will decide if filters need to be applied
        if node_id and batch_size >= 1 and HAS_SERVER:
            # Generate unique batch ID to prevent stale frame mixing from previous runs
            batch_id = f"{node_id}_{int(time.time() * 1000)}_{random.randint(0, 99999)}"
            PURZ_BATCH_ID[node_id] = batch_id

            # Signal that we're waiting for frontend processing
            PURZ_BATCH_PENDING[node_id] = batch_size
            PURZ_BATCH_READY[node_id] = False
            PURZ_RENDERED_IMAGES[node_id] = None  # Will be set to [] for "no filters" or frames list

            print(f"[Purz Interactive V3] Signaling frontend to process {batch_size} frame(s)... batch_id={batch_id}")

            # Send message to frontend that we need processing
            PromptServer.instance.send_sync("purz.batch_pending", {
                "node_id": node_id,
                "batch_size": batch_size,
                "batch_id": batch_id,
                "images": results
            })

            # Give the WebSocket message time to be delivered
            time.sleep(0.5)
            print(f"[Purz Interactive V3] Message sent, starting to wait...")

            # Wait for frontend to signal completion (with timeout)
            max_wait = 300  # 5 minutes max
            poll_interval = 0.1  # 100ms
            waited = 0

            while not PURZ_BATCH_READY.get(node_id, False) and waited < max_wait:
                time.sleep(poll_interval)
                waited += poll_interval

                # Log progress every 10 seconds
                if waited > 0 and int(waited * 10) % 100 == 0:
                    rendered_count = len(PURZ_RENDERED_IMAGES.get(node_id) or [])
                    print(f"[Purz Interactive V3] Waiting... ({rendered_count}/{batch_size} frames, {int(waited)}s elapsed)")

            # Check if we got the rendered frames
            if PURZ_BATCH_READY.get(node_id, False):
                rendered_frames = PURZ_RENDERED_IMAGES.get(node_id)

                # If rendered_frames is empty list, frontend said no filters - use original
                if rendered_frames is None:
                    print(f"[Purz Interactive V3] Frontend didn't respond, using original")
                elif len(rendered_frames) == 0:
                    print(f"[Purz Interactive V3] No filters applied, using original batch")
                elif len(rendered_frames) == batch_size:
                    try:
                        batch_results = []
                        print(f"[Purz Interactive V3] Decoding {len(rendered_frames)} WebGL-rendered frames")

                        for i, rendered_b64 in enumerate(rendered_frames):
                            if "," in rendered_b64:
                                rendered_b64 = rendered_b64.split(",")[1]
                            image_bytes = base64.b64decode(rendered_b64)
                            rendered_pil = Image.open(python_io.BytesIO(image_bytes)).convert("RGB")
                            rendered_np = np.array(rendered_pil).astype(np.float32) / 255.0
                            batch_results.append(torch.from_numpy(rendered_np))

                        output_image = torch.stack(batch_results)
                        print(f"[Purz Interactive V3] Batch output ready: {output_image.shape}")

                    except Exception as e:
                        print(f"[Purz Interactive V3] Failed to decode rendered frames: {e}")
                        import traceback
                        traceback.print_exc()
                else:
                    print(f"[Purz Interactive V3] Frame count mismatch: got {len(rendered_frames)}, expected {batch_size}")
            else:
                print(f"[Purz Interactive V3] Timeout waiting for frontend processing after {int(waited)}s")

            # Clean up
            PURZ_BATCH_PENDING.pop(node_id, None)
            PURZ_BATCH_READY.pop(node_id, None)
            PURZ_RENDERED_IMAGES.pop(node_id, None)

        elif node_id and node_id in PURZ_RENDERED_IMAGES:
            rendered_frames = PURZ_RENDERED_IMAGES[node_id]
            if rendered_frames and len(rendered_frames) > 0:
                try:
                    batch_results = []
                    for rendered_b64 in rendered_frames:
                        if "," in rendered_b64:
                            rendered_b64 = rendered_b64.split(",")[1]
                        image_bytes = base64.b64decode(rendered_b64)
                        rendered_pil = Image.open(python_io.BytesIO(image_bytes)).convert("RGB")
                        rendered_np = np.array(rendered_pil).astype(np.float32) / 255.0
                        batch_results.append(torch.from_numpy(rendered_np))
                    output_image = torch.stack(batch_results)
                except Exception as e:
                    print(f"[Purz Interactive V3] Failed to decode rendered frames: {e}")

        # Return with custom UI key to prevent default preview
        return io.NodeOutput(
            output_image,
            ui={"purz_images": results}
        )
