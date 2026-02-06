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
from .utils import rgb_to_hsv_vectorized, hsv_to_rgb_vectorized

# Try to import ComfyUI server components for real-time messaging
try:
    from server import PromptServer
    from aiohttp import web
    HAS_SERVER = True
except ImportError:
    HAS_SERVER = False
    print("[Purz Interactive] Warning: Could not import server components")

# Global storage for filter layers and rendered frames (persists across executions)
PURZ_FILTER_LAYERS = {}  # Filter layer definitions from frontend
PURZ_RENDERED_IMAGES = {}  # WebGL-rendered frames (list of base64 PNGs) for batch output
PURZ_BATCH_PENDING = {}  # Signals that backend is waiting for batch processing (node_id -> batch_size)
PURZ_BATCH_READY = {}  # Signals that frontend finished processing (node_id -> True)
PURZ_BATCH_ID = {}  # Unique ID per execution to prevent stale frame mixing (node_id -> batch_id)


# =============================================================================
# SERVER-SIDE FILTER IMPLEMENTATIONS
# =============================================================================
# Each filter is a standalone function that takes (result, params, original) and
# returns the modified result. The FILTER_REGISTRY maps effect names to handlers.

# Luminance coefficients (ITU-R BT.601)
LUMA_COEFFS = np.array([0.299, 0.587, 0.114])


def _compute_luminance(img):
    """Compute grayscale luminance from RGB image."""
    return np.dot(img[..., :3], LUMA_COEFFS)


def _to_grayscale_rgb(img):
    """Convert image to grayscale but keep 3 channels."""
    gray = _compute_luminance(img)
    return np.stack([gray] * 3, axis=-1)


# =============================================================================
# BASIC ADJUSTMENTS
# =============================================================================

def _filter_desaturate(result, params, original):
    amount = params.get("amount", 1.0)
    gray = _to_grayscale_rgb(result)
    return result * (1 - amount) + gray * amount


def _filter_brightness(result, params, original):
    amount = params.get("amount", 0.0)
    return np.clip(result + amount, 0, 1)


def _filter_contrast(result, params, original):
    amount = params.get("amount", 0.0)
    result = (result - 0.5) * (1.0 + amount) + 0.5
    return np.clip(result, 0, 1)


def _filter_exposure(result, params, original):
    amount = params.get("amount", 0.0)
    result = result * (2.0 ** amount)
    return np.clip(result, 0, 1)


def _filter_gamma(result, params, original):
    amount = params.get("amount", 1.0)
    gamma = 1.0 / max(amount, 0.01)
    return np.power(result, gamma)


def _filter_vibrance(result, params, original):
    amount = params.get("amount", 0.0)
    max_c = np.max(result, axis=-1)
    min_c = np.min(result, axis=-1)
    sat = max_c - min_c
    amt = amount * (1.0 - sat)
    gray = _to_grayscale_rgb(result)
    result = gray + (result - gray) * (1.0 + amt[..., np.newaxis])
    return np.clip(result, 0, 1)


def _filter_saturation(result, params, original):
    amount = params.get("amount", 0.0)
    gray = _to_grayscale_rgb(result)
    result = gray + (result - gray) * (1.0 + amount)
    return np.clip(result, 0, 1)


# =============================================================================
# COLOR MANIPULATION
# =============================================================================

def _filter_hueShift(result, params, original):
    amount = params.get("amount", 0.0)
    hsv = rgb_to_hsv_vectorized(result[..., :3])
    hsv[..., 0] = (hsv[..., 0] + amount) % 1.0
    result = result.copy()
    result[..., :3] = hsv_to_rgb_vectorized(hsv)
    return result


def _filter_temperature(result, params, original):
    amount = params.get("amount", 0.0)
    result = result.copy()
    result[..., 0] = np.clip(result[..., 0] + amount * 0.3, 0, 1)
    result[..., 2] = np.clip(result[..., 2] - amount * 0.3, 0, 1)
    return result


def _filter_tint(result, params, original):
    amount = params.get("amount", 0.0)
    result = result.copy()
    result[..., 1] = np.clip(result[..., 1] + amount * 0.3, 0, 1)
    result[..., 0] = np.clip(result[..., 0] - amount * 0.15, 0, 1)
    result[..., 2] = np.clip(result[..., 2] - amount * 0.15, 0, 1)
    return result


def _filter_colorize(result, params, original):
    hue = params.get("hue", 0.0)
    sat = params.get("saturation", 0.5)
    lum = _compute_luminance(result)
    hsv = np.stack([
        np.full_like(lum, hue),
        np.full_like(lum, sat),
        lum
    ], axis=-1)
    result = result.copy()
    result[..., :3] = hsv_to_rgb_vectorized(hsv)
    return result


def _filter_channelMixer(result, params, original):
    result = result.copy()
    result[..., 0] = np.clip(result[..., 0] + params.get("redShift", 0), 0, 1)
    result[..., 1] = np.clip(result[..., 1] + params.get("greenShift", 0), 0, 1)
    result[..., 2] = np.clip(result[..., 2] + params.get("blueShift", 0), 0, 1)
    return result


# =============================================================================
# TONE ADJUSTMENTS
# =============================================================================

def _filter_highlights(result, params, original):
    amount = params.get("amount", 0.0)
    lum = _compute_luminance(result)
    mask = np.clip((lum - 0.5) * 2, 0, 1)
    result = result + amount * mask[..., np.newaxis]
    return np.clip(result, 0, 1)


def _filter_shadows(result, params, original):
    amount = params.get("amount", 0.0)
    lum = _compute_luminance(result)
    mask = np.clip(1 - lum * 2, 0, 1)
    result = result + amount * mask[..., np.newaxis]
    return np.clip(result, 0, 1)


def _filter_whites(result, params, original):
    amount = params.get("amount", 0.0)
    lum = _compute_luminance(result)
    mask = np.clip((lum - 0.7) / 0.3, 0, 1)
    result = result + amount * mask[..., np.newaxis]
    return np.clip(result, 0, 1)


def _filter_blacks(result, params, original):
    amount = params.get("amount", 0.0)
    lum = _compute_luminance(result)
    mask = np.clip(1 - lum / 0.3, 0, 1)
    result = result + amount * mask[..., np.newaxis]
    return np.clip(result, 0, 1)


def _filter_levels(result, params, original):
    black = params.get("blackPoint", 0.0)
    white = params.get("whitePoint", 1.0)
    mid = params.get("midtones", 1.0)
    result = (result - black) / max(white - black, 0.001)
    result = np.clip(result, 0, 1)
    return np.power(result, 1.0 / max(mid, 0.01))


def _filter_curves(result, params, original):
    shadows = params.get("shadows", 0.0)
    mids = params.get("midtones", 0.0)
    highs = params.get("highlights", 0.0)
    c = result
    c = c + shadows * (1 - c) * (1 - c) * c
    c = c + mids * c * (1 - c)
    c = c + highs * c * c * (1 - c)
    return np.clip(c, 0, 1)


# =============================================================================
# BLUR & SHARPEN
# =============================================================================

def _filter_blur(result, params, original):
    amount = params.get("amount", 5.0)
    if amount > 0:
        img_pil = Image.fromarray((result * 255).astype(np.uint8))
        img_pil = img_pil.filter(ImageFilter.GaussianBlur(radius=amount))
        return np.array(img_pil).astype(np.float32) / 255.0
    return result


def _filter_sharpen(result, params, original):
    amount = params.get("amount", 0.5)
    if amount > 0:
        img_pil = Image.fromarray((result * 255).astype(np.uint8))
        blurred = img_pil.filter(ImageFilter.GaussianBlur(radius=1))
        img_np_blur = np.array(blurred).astype(np.float32) / 255.0
        diff = result - img_np_blur
        result = result + diff * amount
        return np.clip(result, 0, 1)
    return result


def _filter_unsharpMask(result, params, original):
    amount = params.get("amount", 1.0)
    threshold = params.get("threshold", 0.1)
    if amount > 0:
        img_pil = Image.fromarray((result * 255).astype(np.uint8))
        blurred = img_pil.filter(ImageFilter.GaussianBlur(radius=2))
        blur_np = np.array(blurred).astype(np.float32) / 255.0
        diff = result - blur_np
        mask = (np.abs(diff).sum(axis=-1) > threshold).astype(np.float32)
        result = result + diff * amount * mask[..., np.newaxis]
        return np.clip(result, 0, 1)
    return result


def _filter_clarity(result, params, original):
    amount = params.get("amount", 0.0)
    if amount != 0:
        img_pil = Image.fromarray((result * 255).astype(np.uint8))
        blurred = img_pil.filter(ImageFilter.GaussianBlur(radius=2))
        blur_np = np.array(blurred).astype(np.float32) / 255.0
        high_pass = result - blur_np
        lum = _compute_luminance(result)
        mid_mask = 1 - np.abs(lum - 0.5) * 2
        result = result + high_pass * amount * mid_mask[..., np.newaxis]
        return np.clip(result, 0, 1)
    return result


def _filter_dehaze(result, params, original):
    amount = params.get("amount", 0.0)
    gray = _to_grayscale_rgb(result)
    result = (result - 0.5) * (1.0 + amount * 0.5) + 0.5
    result = gray + (result - gray) * (1.0 + amount * 0.3)
    return np.clip(result, 0, 1)


# =============================================================================
# STYLISTIC EFFECTS
# =============================================================================

def _filter_vignette(result, params, original):
    amount = params.get("amount", 0.5)
    softness = params.get("softness", 0.2)
    h, w, _ = result.shape
    y, x = np.ogrid[:h, :w]
    center_y, center_x = h / 2, w / 2
    dist = np.sqrt((x - center_x) ** 2 / (w/2) ** 2 + (y - center_y) ** 2 / (h/2) ** 2)
    vig = 1 - np.clip((dist - (1 - softness)) / softness * amount, 0, 1)
    return result * vig[..., np.newaxis]


def _filter_grain(result, params, original):
    amount = params.get("amount", 0.1)
    noise = (np.random.random(result.shape) * 2 - 1) * amount
    return np.clip(result + noise, 0, 1)


def _filter_posterize(result, params, original):
    levels = int(params.get("levels", 8))
    result = np.floor(result * levels) / (levels - 1)
    return np.clip(result, 0, 1)


def _filter_threshold(result, params, original):
    thresh = params.get("threshold", 0.5)
    gray = _compute_luminance(result)
    binary = (gray > thresh).astype(np.float32)
    return np.stack([binary] * 3, axis=-1)


def _filter_invert(result, params, original):
    amount = params.get("amount", 1.0)
    inverted = 1.0 - result
    return result * (1 - amount) + inverted * amount


def _filter_sepia(result, params, original):
    amount = params.get("amount", 1.0)
    sepia_r = result[..., 0] * 0.393 + result[..., 1] * 0.769 + result[..., 2] * 0.189
    sepia_g = result[..., 0] * 0.349 + result[..., 1] * 0.686 + result[..., 2] * 0.168
    sepia_b = result[..., 0] * 0.272 + result[..., 1] * 0.534 + result[..., 2] * 0.131
    sepia = np.stack([sepia_r, sepia_g, sepia_b], axis=-1)
    sepia = np.clip(sepia, 0, 1)
    return result * (1 - amount) + sepia * amount


def _filter_duotone(result, params, original):
    shadow = np.array([params.get("shadowR", 0.1), params.get("shadowG", 0.0), params.get("shadowB", 0.2)])
    highlight = np.array([params.get("highlightR", 1.0), params.get("highlightG", 0.9), params.get("highlightB", 0.6)])
    gray = _compute_luminance(result)
    return shadow + (highlight - shadow) * gray[..., np.newaxis]


# =============================================================================
# EDGE & DETAIL
# =============================================================================

def _filter_emboss(result, params, original):
    img_pil = Image.fromarray((result * 255).astype(np.uint8))
    embossed = img_pil.filter(ImageFilter.EMBOSS)
    return np.array(embossed).astype(np.float32) / 255.0


def _filter_edgeDetect(result, params, original):
    amount = params.get("amount", 1.0)
    img_pil = Image.fromarray((result * 255).astype(np.uint8))
    edges = img_pil.filter(ImageFilter.FIND_EDGES)
    edge_np = np.array(edges).astype(np.float32) / 255.0 * amount
    return np.clip(edge_np, 0, 1)


def _filter_sketch(result, params, original):
    amount = params.get("amount", 4.0)
    img_pil = Image.fromarray((result * 255).astype(np.uint8))
    edges = img_pil.filter(ImageFilter.FIND_EDGES)
    edge_np = np.array(edges).astype(np.float32) / 255.0
    gray_edges = _compute_luminance(edge_np)
    sketch = 1 - np.clip(gray_edges * amount, 0, 1)
    return np.stack([sketch] * 3, axis=-1)


def _filter_oilPaint(result, params, original):
    levels = int(params.get("levels", 12))
    radius = params.get("radius", 2.0)
    img_pil = Image.fromarray((result * 255).astype(np.uint8))
    img_pil = img_pil.filter(ImageFilter.GaussianBlur(radius=radius))
    result = np.array(img_pil).astype(np.float32) / 255.0
    return np.floor(result * levels) / max(levels - 1, 1)


# =============================================================================
# CREATIVE EFFECTS
# =============================================================================

def _filter_pixelate(result, params, original):
    size = int(max(1, params.get("size", 8)))
    h, w, c = result.shape
    small = Image.fromarray((result * 255).astype(np.uint8)).resize(
        (max(1, w // size), max(1, h // size)), Image.NEAREST
    )
    return np.array(small.resize((w, h), Image.NEAREST)).astype(np.float32) / 255.0


def _filter_chromatic(result, params, original):
    amount = int(params.get("amount", 2))
    if amount > 0:
        r = np.roll(result[..., 0], amount, axis=1)
        b = np.roll(result[..., 2], -amount, axis=1)
        return np.stack([r, result[..., 1], b], axis=-1)
    return result


def _filter_glitch(result, params, original):
    amount = params.get("amount", 0.3)
    seed = params.get("seed", 0.0)
    h, w, _ = result.shape
    result = result.copy()

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
    return result


def _filter_halftone(result, params, original):
    size = int(max(2, params.get("size", 6)))
    h, w, _ = result.shape
    gray = _compute_luminance(result)
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
    return np.stack([halftone] * 3, axis=-1)


# =============================================================================
# LENS EFFECTS
# =============================================================================

def _filter_lensDistort(result, params, original):
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
        return result[new_y, new_x]
    return result


def _filter_tiltShift(result, params, original):
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

    result = result.copy()
    for y in range(h):
        result[y] = result[y] * (1 - blur_mask[y]) + blur_np[y] * blur_mask[y]
    return result


def _filter_radialBlur(result, params, original):
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
        return accumulated / samples
    return result


# =============================================================================
# FILTER REGISTRY
# =============================================================================

FILTER_REGISTRY = {
    # Basic adjustments
    "desaturate": _filter_desaturate,
    "brightness": _filter_brightness,
    "contrast": _filter_contrast,
    "exposure": _filter_exposure,
    "gamma": _filter_gamma,
    "vibrance": _filter_vibrance,
    "saturation": _filter_saturation,
    # Color manipulation
    "hueShift": _filter_hueShift,
    "temperature": _filter_temperature,
    "tint": _filter_tint,
    "colorize": _filter_colorize,
    "channelMixer": _filter_channelMixer,
    # Tone adjustments
    "highlights": _filter_highlights,
    "shadows": _filter_shadows,
    "whites": _filter_whites,
    "blacks": _filter_blacks,
    "levels": _filter_levels,
    "curves": _filter_curves,
    # Blur & sharpen
    "blur": _filter_blur,
    "sharpen": _filter_sharpen,
    "unsharpMask": _filter_unsharpMask,
    "clarity": _filter_clarity,
    "dehaze": _filter_dehaze,
    # Stylistic effects
    "vignette": _filter_vignette,
    "grain": _filter_grain,
    "posterize": _filter_posterize,
    "threshold": _filter_threshold,
    "invert": _filter_invert,
    "sepia": _filter_sepia,
    "duotone": _filter_duotone,
    # Edge & detail
    "emboss": _filter_emboss,
    "edgeDetect": _filter_edgeDetect,
    "sketch": _filter_sketch,
    "oilPaint": _filter_oilPaint,
    # Creative effects
    "pixelate": _filter_pixelate,
    "chromatic": _filter_chromatic,
    "glitch": _filter_glitch,
    "halftone": _filter_halftone,
    # Lens effects
    "lensDistort": _filter_lensDistort,
    "tiltShift": _filter_tiltShift,
    "radialBlur": _filter_radialBlur,
}


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

    handler = FILTER_REGISTRY.get(effect)
    if handler:
        result = handler(result, params, original)

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


def process_interactive_filter(image, node_id, output_dir, output_type, prefix_append, compress_level, mask=None):
    """
    Shared processing logic for the Interactive Image Filter node.
    Used by both V1 and V3 node implementations.

    Saves input images to temp, signals frontend for WebGL processing,
    waits for rendered frames, and returns the output.

    Args:
        image: PyTorch tensor [batch, H, W, C] float32 0-1
        node_id: String node ID (or None)
        output_dir: Directory to save temp images
        output_type: "temp" or "output"
        prefix_append: Random suffix for filename uniqueness
        compress_level: PNG compression level
        mask: Optional PyTorch tensor [batch, H, W] float32 0-1 for selective filtering

    Returns:
        (output_image_tensor, ui_results_list)
    """
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

    print(f"[Purz Interactive] process() called: node_id={node_id}, batch_size={batch_size}, HAS_SERVER={HAS_SERVER}")

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

        print(f"[Purz Interactive] Signaling frontend to process {batch_size} frame(s)... batch_id={batch_id}")

        # Send message to frontend that we need processing
        PromptServer.instance.send_sync("purz.batch_pending", {
            "node_id": node_id,
            "batch_size": batch_size,
            "batch_id": batch_id,
            "images": results
        })

        # Give the WebSocket message time to be delivered
        time.sleep(0.5)
        print(f"[Purz Interactive] Message sent, starting to wait...")

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
                print(f"[Purz Interactive] Waiting... ({rendered_count}/{batch_size} frames, {int(waited)}s elapsed)")

        # Check if we got the rendered frames
        if PURZ_BATCH_READY.get(node_id, False):
            rendered_frames = PURZ_RENDERED_IMAGES.get(node_id)

            # If rendered_frames is empty list, frontend said no filters - use original
            if rendered_frames is None:
                print(f"[Purz Interactive] Frontend didn't respond, using original")
            elif len(rendered_frames) == 0:
                print(f"[Purz Interactive] No filters applied, using original batch")
            elif len(rendered_frames) == batch_size:
                try:
                    batch_results = []
                    print(f"[Purz Interactive] Decoding {len(rendered_frames)} WebGL-rendered frames")

                    for i, rendered_b64 in enumerate(rendered_frames):
                        if "," in rendered_b64:
                            rendered_b64 = rendered_b64.split(",")[1]
                        image_bytes = base64.b64decode(rendered_b64)
                        rendered_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                        rendered_np = np.array(rendered_pil).astype(np.float32) / 255.0
                        batch_results.append(torch.from_numpy(rendered_np))

                    output_image = torch.stack(batch_results)
                    print(f"[Purz Interactive] Batch output ready: {output_image.shape}")

                except Exception as e:
                    print(f"[Purz Interactive] Failed to decode rendered frames: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f"[Purz Interactive] Frame count mismatch: got {len(rendered_frames)}, expected {batch_size}")
        else:
            print(f"[Purz Interactive] Timeout waiting for frontend processing after {int(waited)}s")

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
                    rendered_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                    rendered_np = np.array(rendered_pil).astype(np.float32) / 255.0
                    batch_results.append(torch.from_numpy(rendered_np))
                output_image = torch.stack(batch_results)
            except Exception as e:
                print(f"[Purz Interactive] Failed to decode rendered frames: {e}")

    # Apply mask blending if mask is provided
    if mask is not None and output_image is not image:
        # mask shape: [batch, H, W] -> expand to [batch, H, W, 1] for broadcasting
        mask_tensor = mask
        if mask_tensor.shape[0] == 1 and output_image.shape[0] > 1:
            mask_tensor = mask_tensor.expand(output_image.shape[0], -1, -1)
        # Resize mask to match image dimensions if needed
        if mask_tensor.shape[1] != output_image.shape[1] or mask_tensor.shape[2] != output_image.shape[2]:
            mask_tensor = torch.nn.functional.interpolate(
                mask_tensor.unsqueeze(1),
                size=(output_image.shape[1], output_image.shape[2]),
                mode='bilinear', align_corners=False
            ).squeeze(1)
        mask_expanded = mask_tensor.unsqueeze(-1)  # [B, H, W, 1]
        output_image = image * (1.0 - mask_expanded) + output_image * mask_expanded

    return output_image, results


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
            "optional": {
                "mask": ("MASK",),
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
    def IS_CHANGED(cls, image, mask=None, prompt=None, extra_pnginfo=None, unique_id=None):
        # Always re-execute to pick up filter changes
        return float("nan")

    def process(self, image, mask=None, prompt=None, extra_pnginfo=None, unique_id=None):
        node_id = str(unique_id) if unique_id is not None else None
        output_image, results = process_interactive_filter(
            image, node_id, self.output_dir, self.type, self.prefix_append, self.compress_level,
            mask=mask
        )
        return {"ui": {"purz_images": results}, "result": (output_image,)}


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
        Endpoint to store filter layers for a node.
        Called by frontend when layers change (for preview sync).
        """
        try:
            data = await request.json()
            node_id = str(data.get("node_id", ""))
            layers = data.get("layers", [])

            PURZ_FILTER_LAYERS[node_id] = layers

            return web.json_response({"success": True})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/purz/interactive/set_rendered_batch")
    async def set_rendered_batch(request):
        """
        Endpoint to store WebGL-rendered frames for batch output.
        Called by frontend after processing all frames through WebGL.
        Supports chunked uploads for large batches.
        """
        try:
            # Read with larger limit - aiohttp default is 1MB, we need more
            body = await request.read()
            data = json.loads(body.decode('utf-8'))

            node_id = str(data.get("node_id", ""))
            batch_id = data.get("batch_id", "")
            rendered_frames = data.get("rendered_frames", [])  # List of base64 PNGs
            chunk_index = data.get("chunk_index", 0)
            total_chunks = data.get("total_chunks", 1)
            is_final = data.get("is_final", True)

            # Validate batch_id matches current execution to prevent stale frame mixing
            expected_batch_id = PURZ_BATCH_ID.get(node_id, "")
            if batch_id and expected_batch_id and batch_id != expected_batch_id:
                print(f"[Purz Interactive] IGNORING stale chunk: batch_id mismatch for node {node_id}")
                return web.json_response({"success": False, "error": "stale_batch"})

            # For chunked uploads, append to existing frames
            if chunk_index == 0:
                PURZ_RENDERED_IMAGES[node_id] = rendered_frames
            else:
                if node_id not in PURZ_RENDERED_IMAGES or PURZ_RENDERED_IMAGES[node_id] is None:
                    PURZ_RENDERED_IMAGES[node_id] = []
                PURZ_RENDERED_IMAGES[node_id].extend(rendered_frames)

            current_count = len(PURZ_RENDERED_IMAGES.get(node_id) or [])
            print(f"[Purz Interactive] Received chunk {chunk_index + 1}/{total_chunks} ({len(rendered_frames)} frames, total: {current_count}) for node {node_id}")

            # Signal completion only on final chunk
            if is_final:
                PURZ_BATCH_READY[node_id] = True
                print(f"[Purz Interactive] All {current_count} frames received for node {node_id}")

            return web.json_response({"success": True, "count": current_count, "ready": is_final})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.get("/purz/interactive/batch_pending/{node_id}")
    async def get_batch_pending(request):
        """
        Check if backend is waiting for batch processing for a node.
        Frontend can poll this to know when to start processing.
        """
        try:
            node_id = request.match_info.get("node_id", "")
            pending = PURZ_BATCH_PENDING.get(node_id, 0)
            images = []

            # If pending, include the image info so frontend can process
            if pending > 0:
                # Get the saved results from temp storage
                # The images list is in the pending data
                pass  # Images are sent via send_sync, polling is just a backup

            return web.json_response({
                "pending": pending > 0,
                "batch_size": pending
            })
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    # =========================================================================
    # PRESET API ENDPOINTS
    # =========================================================================

    def _get_presets_dir():
        """Get the presets directory path."""
        return os.path.join(os.path.dirname(__file__), "presets")

    @PromptServer.instance.routes.get("/purz/presets/list")
    async def list_presets(request):
        """
        List all custom presets from the presets folder.
        """
        try:
            presets_dir = _get_presets_dir()
            os.makedirs(presets_dir, exist_ok=True)

            presets = {}
            for filename in os.listdir(presets_dir):
                if filename.endswith(".json"):
                    filepath = os.path.join(presets_dir, filename)
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            preset_data = json.load(f)
                            # Use filename without extension as key
                            key = filename[:-5]
                            presets[key] = preset_data
                    except (json.JSONDecodeError, IOError) as e:
                        print(f"[Purz] Failed to load preset {filename}: {e}")

            return web.json_response({"success": True, "presets": presets})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/purz/presets/save")
    async def save_preset(request):
        """
        Save a custom preset to a JSON file.
        """
        try:
            data = await request.json()
            name = data.get("name", "").strip()
            layers = data.get("layers", [])

            if not name:
                return web.json_response({"error": "Preset name is required"}, status=400)

            if not layers:
                return web.json_response({"error": "No layers to save"}, status=400)

            # Create safe filename
            safe_name = "".join(c for c in name.lower() if c.isalnum() or c in " _-")
            safe_name = safe_name.replace(" ", "_")
            if not safe_name:
                safe_name = f"preset_{int(time.time())}"

            presets_dir = _get_presets_dir()
            os.makedirs(presets_dir, exist_ok=True)

            preset_data = {
                "name": name,
                "category": "My Presets",
                "layers": layers
            }

            filepath = os.path.join(presets_dir, f"{safe_name}.json")
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(preset_data, f, indent=2)

            return web.json_response({
                "success": True,
                "key": safe_name,
                "filename": f"{safe_name}.json"
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/purz/presets/delete")
    async def delete_preset(request):
        """
        Delete a custom preset.
        """
        try:
            data = await request.json()
            key = data.get("key", "").strip()

            if not key:
                return web.json_response({"error": "Preset key is required"}, status=400)

            presets_dir = _get_presets_dir()
            filepath = os.path.join(presets_dir, f"{key}.json")

            # Security: ensure path is within presets directory
            filepath = os.path.abspath(filepath)
            if not filepath.startswith(os.path.abspath(presets_dir)):
                return web.json_response({"error": "Invalid preset key"}, status=400)

            if not os.path.exists(filepath):
                return web.json_response({"error": "Preset not found"}, status=404)

            os.remove(filepath)

            return web.json_response({"success": True})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)


    # =============================================================================
    # SHADER FILE ENDPOINTS
    # =============================================================================

    def _get_shaders_dir():
        """Get the shaders directory path."""
        return os.path.join(os.path.dirname(__file__), "shaders")

    @PromptServer.instance.routes.get("/purz/shaders/manifest")
    async def get_shader_manifest(request):
        """
        Get the effects manifest (effects.json).
        """
        try:
            shaders_dir = _get_shaders_dir()
            manifest_path = os.path.join(shaders_dir, "effects.json")

            if not os.path.exists(manifest_path):
                return web.json_response({"error": "Manifest not found"}, status=404)

            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)

            # Also load any custom shaders
            custom_dir = os.path.join(shaders_dir, "custom")
            if os.path.exists(custom_dir):
                custom_effects = {}
                for filename in os.listdir(custom_dir):
                    if filename.endswith(".glsl") and not filename.startswith("_"):
                        effect_id = filename[:-5]  # Remove .glsl
                        # Check for accompanying .json metadata
                        meta_path = os.path.join(custom_dir, f"{effect_id}.json")
                        if os.path.exists(meta_path):
                            with open(meta_path, "r", encoding="utf-8") as f:
                                custom_effects[effect_id] = json.load(f)
                                custom_effects[effect_id]["shader"] = f"custom/{filename}"
                                custom_effects[effect_id]["isCustom"] = True
                        else:
                            # Create basic metadata from filename
                            custom_effects[effect_id] = {
                                "name": effect_id.replace("_", " ").title(),
                                "category": "Custom",
                                "shader": f"custom/{filename}",
                                "isCustom": True,
                                "params": [
                                    {"name": "amount", "label": "Amount", "min": 0, "max": 1, "default": 0.5, "step": 0.01}
                                ]
                            }
                # Merge custom effects into manifest
                manifest["effects"].update(custom_effects)

            return web.json_response(manifest)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.get("/purz/shaders/file/{path:.*}")
    async def get_shader_file(request):
        """
        Get a specific shader file.
        Path can be like: basic/desaturate.glsl or custom/myeffect.glsl
        """
        try:
            shader_path = request.match_info["path"]
            shaders_dir = _get_shaders_dir()
            filepath = os.path.join(shaders_dir, shader_path)

            # Security: ensure path is within shaders directory
            filepath = os.path.abspath(filepath)
            if not filepath.startswith(os.path.abspath(shaders_dir)):
                return web.json_response({"error": "Invalid path"}, status=400)

            if not os.path.exists(filepath):
                return web.json_response({"error": "Shader not found"}, status=404)

            with open(filepath, "r", encoding="utf-8") as f:
                shader_source = f.read()

            return web.Response(text=shader_source, content_type="text/plain")
        except Exception as e:
            import traceback
            traceback.print_exc()
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.get("/purz/shaders/custom/list")
    async def list_custom_shaders(request):
        """
        List all custom shaders in the custom directory.
        """
        try:
            shaders_dir = _get_shaders_dir()
            custom_dir = os.path.join(shaders_dir, "custom")

            if not os.path.exists(custom_dir):
                return web.json_response({"shaders": []})

            shaders = []
            for filename in os.listdir(custom_dir):
                if filename.endswith(".glsl") and not filename.startswith("_"):
                    effect_id = filename[:-5]
                    meta_path = os.path.join(custom_dir, f"{effect_id}.json")
                    has_metadata = os.path.exists(meta_path)
                    shaders.append({
                        "id": effect_id,
                        "filename": filename,
                        "hasMetadata": has_metadata
                    })

            return web.json_response({"shaders": shaders})
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
