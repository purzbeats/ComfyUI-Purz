"""
Interactive Image Filter System for ComfyUI-Purz

A layer-based real-time image filter system with WebGL shaders.
Users can stack multiple effects (desaturate, brightness, etc.) with
individual opacity, preview changes instantly via WebGL,
and the filtered result is output when the workflow runs.
"""

import torch
import numpy as np
import base64
import io
import os
import json
import time
import random
from PIL import Image, ImageFilter

import folder_paths

# Try to import ComfyUI server components for real-time messaging
try:
    from server import PromptServer
    from aiohttp import web
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False
    print("[Purz Interactive] Warning: Could not import server components")

# Global storage for filter layers and rendered images (persists across executions)
PURZ_FILTER_LAYERS = {}
PURZ_RENDERED_IMAGES = {}  # Stores base64 PNG from WebGL canvas for exact output match


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
        # Convert to HSV, shift hue, convert back
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
        result[..., 0] = np.clip(result[..., 0] + amount * 0.3, 0, 1)  # Red
        result[..., 2] = np.clip(result[..., 2] - amount * 0.3, 0, 1)  # Blue

    elif effect == "tint":
        amount = params.get("amount", 0.0)
        result[..., 1] = np.clip(result[..., 1] + amount * 0.3, 0, 1)  # Green
        result[..., 0] = np.clip(result[..., 0] - amount * 0.15, 0, 1)  # Red
        result[..., 2] = np.clip(result[..., 2] - amount * 0.15, 0, 1)  # Blue

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
            # Apply unsharp mask
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
        opacity = 1.0  # Already applied

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
        # Simplified oil paint using posterization + slight blur
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

        # Match WebGL shader exactly:
        # - Uses deterministic random based on y-coordinate band and seed
        # - Applies chromatic aberration (R/G/B channel separation)
        # - 20 horizontal bands
        def glsl_fract(x):
            """Match GLSL fract: x - floor(x), always returns 0-1"""
            return x - np.floor(x)

        def glsl_random(st_x, st_y):
            """Match GLSL random: fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123)"""
            dot_val = st_x * 12.9898 + st_y * 78.233
            return glsl_fract(np.sin(dot_val) * 43758.5453123)

        # Process each row - rows in same band get same random value
        for y in range(h):
            # Match shader: floor(v_texCoord.y * 20.0) creates 20 bands
            tex_y = y / h
            band = np.floor(tex_y * 20.0)
            rnd = glsl_random(band, seed)

            # Calculate shift amount (in texture coordinates, then convert to pixels)
            shift = (rnd - 0.5) * amount * 0.1
            if rnd > 0.9:
                shift *= 3.0

            # Convert texture coordinate shift to pixel shift
            pixel_shift = int(shift * w)

            if pixel_shift != 0:
                # Chromatic aberration: R shifts positive, G stays, B shifts negative
                result[y, :, 0] = np.roll(original[y, :, 0], pixel_shift)   # Red channel
                # Green channel stays (result[y, :, 1] is already original)
                result[y, :, 2] = np.roll(original[y, :, 2], -pixel_shift)  # Blue channel

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
                    # Center and paste
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


class InteractiveImageFilter:
    """
    Interactive layer-based image filter with real-time WebGL preview.

    Features:
    - Stack multiple effect layers
    - Per-layer opacity control
    - Real-time preview without re-executing workflow
    - Output is the filtered result
    """

    def __init__(self):
        self.output_dir = folder_paths.get_temp_directory()
        self.type = "temp"
        self.prefix_append = "_purz_filter_" + ''.join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))
        self.compress_level = 1

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "process"
    CATEGORY = "Purz/Interactive"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, image, prompt=None, extra_pnginfo=None, unique_id=None):
        # Always re-execute to pick up filter changes
        return float("nan")

    def process(self, image, prompt=None, extra_pnginfo=None, unique_id=None):
        """
        Process the input image with stored filter layers.
        """
        # Save the original image to temp directory for interactive preview
        filename_prefix = "PurzFilter" + self.prefix_append
        full_output_folder, filename, counter, subfolder, filename_prefix = folder_paths.get_save_image_path(
            filename_prefix, self.output_dir, image[0].shape[1], image[0].shape[0]
        )

        results = []

        # Save original (first image in batch) for interactive preview
        img_np = (image[0].cpu().numpy() * 255).astype(np.uint8)
        img_pil = Image.fromarray(img_np, mode='RGB')

        file = f"{filename}_{counter:05}_.png"
        file_path = os.path.join(full_output_folder, file)
        img_pil.save(file_path, compress_level=self.compress_level)

        results.append({
            "filename": file,
            "subfolder": subfolder,
            "type": self.type
        })

        # Check if we have a rendered image from the frontend (exact WebGL output)
        output_image = image
        node_id = str(unique_id) if unique_id is not None else None

        if node_id and node_id in PURZ_RENDERED_IMAGES:
            # Use the exact rendered image from WebGL canvas - guarantees preview matches output
            rendered_b64 = PURZ_RENDERED_IMAGES[node_id]
            try:
                # Decode base64 PNG
                if "," in rendered_b64:
                    rendered_b64 = rendered_b64.split(",")[1]
                image_bytes = base64.b64decode(rendered_b64)
                rendered_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")

                # Convert to tensor format [batch, H, W, C]
                rendered_np = np.array(rendered_pil).astype(np.float32) / 255.0
                rendered_tensor = torch.from_numpy(rendered_np).unsqueeze(0)

                # Handle batch - apply same rendered result to all batch items
                # (The preview only shows first image, so rendered is based on that)
                if image.shape[0] > 1:
                    output_image = rendered_tensor.repeat(image.shape[0], 1, 1, 1)
                else:
                    output_image = rendered_tensor

            except Exception as e:
                print(f"[Purz Interactive] Failed to decode rendered image, falling back to filter stack: {e}")
                # Fallback to Python filter implementation
                if node_id in PURZ_FILTER_LAYERS:
                    layers = PURZ_FILTER_LAYERS[node_id]
                    if layers:
                        batch_results = []
                        for i in range(image.shape[0]):
                            img_np = image[i].cpu().numpy().astype(np.float32)
                            filtered = apply_filter_stack(img_np, layers)
                            batch_results.append(torch.from_numpy(filtered))
                        output_image = torch.stack(batch_results)

        elif node_id and node_id in PURZ_FILTER_LAYERS:
            # Fallback: no rendered image available, use Python filter implementation
            layers = PURZ_FILTER_LAYERS[node_id]
            if layers:
                batch_results = []
                for i in range(image.shape[0]):
                    img_np = image[i].cpu().numpy().astype(np.float32)
                    filtered = apply_filter_stack(img_np, layers)
                    batch_results.append(torch.from_numpy(filtered))
                output_image = torch.stack(batch_results)

        return {
            "ui": {
                "purz_images": results,
            },
            "result": (output_image,)
        }


# API routes for saving processed images and storing filter state
if HAS_SERVER:
    @PromptServer.instance.routes.post("/purz/interactive/save")
    async def save_interactive_result(request):
        """
        Endpoint to save the interactively processed image.
        """
        try:
            data = await request.json()
            node_id = data.get("node_id")
            image_data = data.get("image_data")  # Base64 encoded PNG
            filename = data.get("filename", f"purz_filter_{int(time.time())}.png")

            if not image_data:
                return web.json_response({"error": "No image data provided"}, status=400)

            # Decode base64 image
            if "," in image_data:
                image_data = image_data.split(",")[1]
            image_bytes = base64.b64decode(image_data)

            # Get ComfyUI output directory
            output_dir = folder_paths.get_output_directory()

            # Ensure filename is safe
            safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-")
            if not safe_filename.endswith(".png"):
                safe_filename += ".png"

            # Save the image
            output_path = os.path.join(output_dir, safe_filename)
            with open(output_path, "wb") as f:
                f.write(image_bytes)

            return web.json_response({
                "success": True,
                "path": output_path,
                "filename": safe_filename
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/purz/interactive/set_layers")
    async def set_filter_layers(request):
        """
        Endpoint to store filter layers and rendered image for a node.
        Called by frontend when layers change.
        """
        try:
            data = await request.json()
            node_id = str(data.get("node_id", ""))
            layers = data.get("layers", [])
            rendered_image = data.get("rendered_image")  # Base64 PNG from WebGL canvas

            PURZ_FILTER_LAYERS[node_id] = layers

            # Store rendered image if provided (for exact output match)
            if rendered_image:
                PURZ_RENDERED_IMAGES[node_id] = rendered_image
            elif node_id in PURZ_RENDERED_IMAGES and not layers:
                # Clear rendered image if layers are cleared
                del PURZ_RENDERED_IMAGES[node_id]

            return web.json_response({"success": True})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)


# Node mappings for registration
# Note: Only registering one node to avoid duplicate entries in search
# Legacy workflows using "PurzInteractiveDesaturate" will need to be updated
INTERACTIVE_NODE_CLASS_MAPPINGS = {
    "PurzInteractiveFilter": InteractiveImageFilter,
}

INTERACTIVE_NODE_DISPLAY_NAME_MAPPINGS = {
    "PurzInteractiveFilter": "Image Filter Live",
}
