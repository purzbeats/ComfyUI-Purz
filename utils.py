"""
Common utility functions for ComfyUI-Purz nodes.

This module centralizes frequently used helpers to avoid code duplication.
"""

import torch
import numpy as np
from PIL import Image


def hex_to_rgb(hex_color: str) -> tuple:
    """
    Convert a hex color string to RGB tuple.
    
    Args:
        hex_color: Hex color string (e.g., "#FF0000" or "FF0000")
    
    Returns:
        Tuple of (R, G, B) values in range 0-255
    """
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def hex_to_rgb_normalized(hex_color: str) -> tuple:
    """
    Convert a hex color string to normalized RGB tuple (0-1 range).
    
    Args:
        hex_color: Hex color string (e.g., "#FF0000" or "FF0000")
    
    Returns:
        Tuple of (R, G, B) values in range 0.0-1.0
    """
    r, g, b = hex_to_rgb(hex_color)
    return (r / 255.0, g / 255.0, b / 255.0)


# =============================================================================
# Image Format Conversion Helpers
# =============================================================================
# ComfyUI images are PyTorch tensors: [batch, height, width, channels] float32 0-1

def tensor_to_numpy(tensor: torch.Tensor) -> np.ndarray:
    """
    Convert a single ComfyUI image tensor to numpy array (float32, 0-1).
    
    Args:
        tensor: PyTorch tensor [H, W, C] or [B, H, W, C]
    
    Returns:
        NumPy array [H, W, C] float32 in range 0-1
    """
    return tensor.cpu().numpy()


def tensor_to_numpy_uint8(tensor: torch.Tensor) -> np.ndarray:
    """
    Convert a single ComfyUI image tensor to numpy array (uint8, 0-255).
    
    Args:
        tensor: PyTorch tensor [H, W, C] float32 0-1
    
    Returns:
        NumPy array [H, W, C] uint8 in range 0-255
    """
    return (tensor.cpu().numpy() * 255).astype(np.uint8)


def numpy_to_tensor(array: np.ndarray) -> torch.Tensor:
    """
    Convert a numpy array to ComfyUI image tensor.
    
    Args:
        array: NumPy array [H, W, C] (float32 0-1 or uint8 0-255)
    
    Returns:
        PyTorch tensor [H, W, C] float32 in range 0-1
    """
    if array.dtype == np.uint8:
        array = array.astype(np.float32) / 255.0
    return torch.from_numpy(array.astype(np.float32))


def tensor_to_pil(tensor: torch.Tensor) -> Image.Image:
    """
    Convert a single ComfyUI image tensor to PIL Image.
    
    Args:
        tensor: PyTorch tensor [H, W, C] float32 0-1
    
    Returns:
        PIL Image in RGB mode
    """
    img_np = tensor_to_numpy_uint8(tensor)
    return Image.fromarray(img_np, mode='RGB')


def pil_to_tensor(img: Image.Image) -> torch.Tensor:
    """
    Convert a PIL Image to ComfyUI image tensor.
    
    Args:
        img: PIL Image (will be converted to RGB if needed)
    
    Returns:
        PyTorch tensor [H, W, C] float32 in range 0-1
    """
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img_np = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(img_np)


def pil_to_numpy(img: Image.Image) -> np.ndarray:
    """
    Convert a PIL Image to numpy array (float32, 0-1).
    
    Args:
        img: PIL Image
    
    Returns:
        NumPy array [H, W, C] float32 in range 0-1
    """
    return np.array(img).astype(np.float32) / 255.0


def numpy_uint8_to_pil(array: np.ndarray) -> Image.Image:
    """
    Convert a uint8 numpy array to PIL Image.

    Args:
        array: NumPy array [H, W, C] uint8 0-255

    Returns:
        PIL Image in RGB mode
    """
    return Image.fromarray(array, mode='RGB')


# =============================================================================
# Vectorized Color Space Conversion
# =============================================================================
# These functions operate on entire arrays without Python loops for performance.

def rgb_to_hsv_vectorized(rgb: np.ndarray) -> np.ndarray:
    """
    Convert RGB array to HSV using vectorized NumPy operations.

    Much faster than using colorsys in a loop for large images.

    Args:
        rgb: NumPy array [..., 3] with RGB values in range 0-1

    Returns:
        NumPy array [..., 3] with HSV values (H in 0-1, S in 0-1, V in 0-1)
    """
    rgb = np.asarray(rgb)

    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)

    v = maxc

    # Avoid division by zero
    delta = maxc - minc
    s = np.where(maxc > 0, delta / maxc, 0)

    # Calculate hue
    # Initialize hue to 0
    h = np.zeros_like(maxc)

    # Where delta > 0, calculate hue based on which channel is max
    mask = delta > 0

    # Red is max
    red_max = mask & (maxc == r)
    h = np.where(red_max, ((g - b) / delta) % 6, h)

    # Green is max
    green_max = mask & (maxc == g)
    h = np.where(green_max, ((b - r) / delta) + 2, h)

    # Blue is max
    blue_max = mask & (maxc == b)
    h = np.where(blue_max, ((r - g) / delta) + 4, h)

    # Normalize hue to 0-1 range
    h = h / 6.0

    return np.stack([h, s, v], axis=-1)


def hsv_to_rgb_vectorized(hsv: np.ndarray) -> np.ndarray:
    """
    Convert HSV array to RGB using vectorized NumPy operations.

    Much faster than using colorsys in a loop for large images.

    Args:
        hsv: NumPy array [..., 3] with HSV values (H in 0-1, S in 0-1, V in 0-1)

    Returns:
        NumPy array [..., 3] with RGB values in range 0-1
    """
    hsv = np.asarray(hsv)

    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    # Sector index (0-5)
    i = (h * 6.0).astype(np.int32) % 6

    # Fractional part
    f = (h * 6.0) - np.floor(h * 6.0)

    p = v * (1.0 - s)
    q = v * (1.0 - s * f)
    t = v * (1.0 - s * (1.0 - f))

    # Build RGB based on sector
    # Sector 0: v, t, p
    # Sector 1: q, v, p
    # Sector 2: p, v, t
    # Sector 3: p, q, v
    # Sector 4: t, p, v
    # Sector 5: v, p, q

    r = np.select(
        [i == 0, i == 1, i == 2, i == 3, i == 4, i == 5],
        [v, q, p, p, t, v],
        default=v
    )

    g = np.select(
        [i == 0, i == 1, i == 2, i == 3, i == 4, i == 5],
        [t, v, v, q, p, p],
        default=p
    )

    b = np.select(
        [i == 0, i == 1, i == 2, i == 3, i == 4, i == 5],
        [p, p, t, v, v, q],
        default=p
    )

    return np.stack([r, g, b], axis=-1)
