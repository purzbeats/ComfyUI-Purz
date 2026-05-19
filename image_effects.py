import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
import cv2

from .utils import tensor_to_numpy_uint8, numpy_to_tensor, tensor_to_pil, pil_to_tensor


class ImageToBlackWhite:
    """
    Convert an image to black and white
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "convert_to_bw"
    CATEGORY = "Purz/Image/Color"
    
    def convert_to_bw(self, image):
        # ComfyUI images are in format [batch, height, width, channels]
        # Convert to grayscale using luminance formula
        batch_size = image.shape[0]
        result = []
        
        for i in range(batch_size):
            # Get single image from batch
            img = image[i]
            
            # Convert to grayscale using RGB weights
            # Y = 0.299*R + 0.587*G + 0.114*B
            gray = 0.299 * img[:, :, 0] + 0.587 * img[:, :, 1] + 0.114 * img[:, :, 2]
            
            # Create RGB image from grayscale (all channels same value)
            bw_image = gray.unsqueeze(2).repeat(1, 1, 3)
            
            result.append(bw_image)
        
        # Stack back into batch
        result = torch.stack(result)
        
        return (result,)


class ImageRotate:
    """
    Rotate an image by specified degrees
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "angle": ("FLOAT", {"default": 45.0, "min": -360.0, "max": 360.0, "step": 1.0}),
                "background_color": (["black", "white", "transparent"], {"default": "black"}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "rotate_image"
    CATEGORY = "Purz/Image/Transform"
    
    def rotate_image(self, image, angle, background_color):
        batch_size = image.shape[0]
        result = []
        
        for i in range(batch_size):
            img_pil = tensor_to_pil(image[i])
            
            # Set background color
            if background_color == "white":
                bg_color = (255, 255, 255)
            elif background_color == "transparent":
                img_pil = img_pil.convert('RGBA')
                bg_color = (0, 0, 0, 0)
            else:  # black
                bg_color = (0, 0, 0)
            
            # Rotate image
            rotated = img_pil.rotate(angle, expand=True, fillcolor=bg_color)
            
            # Convert back to RGB if it was RGBA
            if rotated.mode == 'RGBA':
                background = Image.new('RGB', rotated.size, (0, 0, 0))
                background.paste(rotated, mask=rotated.split()[3])
                rotated = background
            
            result.append(pil_to_tensor(rotated))
        
        result = torch.stack(result)
        return (result,)


class ImageBlur:
    """
    Apply various blur effects to an image
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "blur_type": (["gaussian", "box", "motion"], {"default": "gaussian"}),
                "blur_radius": ("FLOAT", {"default": 5.0, "min": 0.1, "max": 50.0, "step": 0.1}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "apply_blur"
    CATEGORY = "Purz/Image/Effects"
    
    def apply_blur(self, image, blur_type, blur_radius):
        batch_size = image.shape[0]
        result = []
        
        for i in range(batch_size):
            img_np = tensor_to_numpy_uint8(image[i])
            
            if blur_type == "gaussian":
                kernel_size = int(blur_radius * 2) | 1  # Ensure odd number
                blurred = cv2.GaussianBlur(img_np, (kernel_size, kernel_size), blur_radius)
            elif blur_type == "box":
                kernel_size = int(blur_radius) | 1
                blurred = cv2.boxFilter(img_np, -1, (kernel_size, kernel_size))
            else:  # motion
                kernel_size = int(blur_radius)
                kernel = np.zeros((kernel_size, kernel_size))
                kernel[int((kernel_size-1)/2), :] = np.ones(kernel_size)
                kernel = kernel / kernel_size
                blurred = cv2.filter2D(img_np, -1, kernel)
            
            result.append(numpy_to_tensor(blurred))
        
        result = torch.stack(result)
        return (result,)


class ColorAdjust:
    """
    Adjust brightness, contrast, and saturation of an image
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "brightness": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 3.0, "step": 0.05}),
                "contrast": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 3.0, "step": 0.05}),
                "saturation": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 3.0, "step": 0.05}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "adjust_colors"
    CATEGORY = "Purz/Image/Color"
    
    def adjust_colors(self, image, brightness, contrast, saturation):
        batch_size = image.shape[0]
        result = []
        
        for i in range(batch_size):
            img_pil = tensor_to_pil(image[i])
            
            if brightness != 1.0:
                enhancer = ImageEnhance.Brightness(img_pil)
                img_pil = enhancer.enhance(brightness)
            
            if contrast != 1.0:
                enhancer = ImageEnhance.Contrast(img_pil)
                img_pil = enhancer.enhance(contrast)
            
            if saturation != 1.0:
                enhancer = ImageEnhance.Color(img_pil)
                img_pil = enhancer.enhance(saturation)
            
            result.append(pil_to_tensor(img_pil))
        
        result = torch.stack(result)
        return (result,)


class ImageFlip:
    """
    Flip or mirror an image
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "flip_mode": (["horizontal", "vertical", "both"], {"default": "horizontal"}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "flip_image"
    CATEGORY = "Purz/Image/Transform"
    
    def flip_image(self, image, flip_mode):
        if flip_mode == "horizontal":
            flipped = torch.flip(image, dims=[2])
        elif flip_mode == "vertical":
            flipped = torch.flip(image, dims=[1])
        else:  # both
            flipped = torch.flip(image, dims=[1, 2])
        
        return (flipped,)


# ---------------------------------------------------------------------------
# Pixelate helpers — shared by V1 and V3 nodes
# ---------------------------------------------------------------------------

RETRO_PALETTES = {
    "game_boy": np.array([
        [15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15],
    ], dtype=np.float32) / 255.0,
    "nes": np.array([
        [84,84,84],[0,30,116],[8,16,144],[48,0,136],[68,0,100],[92,0,48],
        [84,4,0],[60,24,0],[32,42,0],[8,58,0],[0,64,0],[0,60,0],
        [0,50,60],[0,0,0],[0,0,0],[0,0,0],
        [152,150,152],[8,76,196],[48,50,236],[92,30,228],[136,20,176],
        [160,20,100],[152,34,32],[120,60,0],[84,90,0],[40,114,0],
        [8,124,0],[0,118,40],[0,102,120],[0,0,0],[0,0,0],[0,0,0],
        [236,238,236],[76,154,236],[120,124,236],[176,98,236],[228,84,236],
        [236,88,180],[236,106,100],[212,136,32],[160,170,0],[116,196,0],
        [76,208,32],[56,204,108],[56,180,204],[60,60,60],[0,0,0],[0,0,0],
        [236,238,236],[168,204,236],[188,188,236],[212,178,236],[236,174,236],
        [236,174,212],[236,180,176],[228,196,144],[204,210,120],[180,222,120],
        [168,226,144],[152,226,180],[160,214,228],[160,162,160],[0,0,0],[0,0,0],
    ], dtype=np.float32) / 255.0,
    "c64": np.array([
        [0,0,0],[255,255,255],[104,55,43],[112,164,178],
        [111,61,134],[88,141,67],[53,40,121],[184,199,111],
        [111,79,37],[67,57,0],[154,103,89],[68,68,68],
        [108,108,108],[154,210,132],[108,94,181],[149,149,149],
    ], dtype=np.float32) / 255.0,
    "pico8": np.array([
        [0,0,0],[29,43,83],[126,37,83],[0,135,81],
        [171,82,54],[95,87,79],[194,195,199],[255,241,232],
        [255,0,77],[255,163,0],[255,236,39],[0,228,54],
        [41,173,255],[131,118,156],[255,119,168],[255,204,170],
    ], dtype=np.float32) / 255.0,
    "cga": np.array([
        [0,0,0],[0,0,170],[0,170,0],[0,170,170],
        [170,0,0],[170,0,170],[170,85,0],[170,170,170],
        [85,85,85],[85,85,255],[85,255,85],[85,255,255],
        [255,85,85],[255,85,255],[255,255,85],[255,255,255],
    ], dtype=np.float32) / 255.0,
    "endesga32": np.array([
        [190,74,47],[215,118,67],[234,212,170],[228,166,114],
        [184,111,80],[115,62,57],[62,39,49],[162,38,51],
        [228,59,68],[247,118,34],[254,174,52],[254,231,97],
        [99,199,77],[62,137,72],[38,92,66],[25,60,62],
        [18,78,137],[0,153,219],[44,232,245],[192,203,220],
        [139,155,180],[90,105,136],[58,68,102],[38,43,68],
        [24,20,37],[255,0,68],[104,56,108],[181,80,136],
        [246,117,122],[232,183,150],[194,133,105],[115,80,56],
    ], dtype=np.float32) / 255.0,
}


def _generate_bayer_matrix(n):
    """Generate an NxN Bayer ordered dither threshold matrix, normalized to 0-1."""
    if n == 1:
        return np.array([[0.0]])
    half = n // 2
    smaller = _generate_bayer_matrix(half)
    m = np.zeros((n, n), dtype=np.float64)
    m[:half, :half] = 4 * smaller
    m[:half, half:] = 4 * smaller + 2
    m[half:, :half] = 4 * smaller + 3
    m[half:, half:] = 4 * smaller + 1
    return m / (n * n)


def _quantize_posterize(image, levels):
    """Posterize: reduce to `levels` evenly-spaced values per channel."""
    return np.floor(image * levels).clip(0, levels - 1) / (levels - 1)


def _quantize_to_palette(image, palette):
    """Map each pixel to the nearest color in `palette` (Nx3 float32 array)."""
    h, w, c = image.shape
    pixels = image.reshape(-1, c)  # (H*W, 3)
    # Squared distances to every palette entry: (H*W, N)
    dists = np.sum((pixels[:, np.newaxis, :] - palette[np.newaxis, :, :]) ** 2, axis=2)
    indices = np.argmin(dists, axis=1)
    return palette[indices].reshape(h, w, c)


def _apply_ordered_dither(image, matrix_size, strength, quantize_fn):
    """Apply ordered (Bayer) dithering before quantization.

    `quantize_fn(image) -> quantized` is called after adding the threshold offset.
    """
    h, w, c = image.shape
    bayer = _generate_bayer_matrix(matrix_size)
    # Tile bayer matrix to cover image, centered around 0
    tiled = np.tile(bayer, (h // matrix_size + 1, w // matrix_size + 1))[:h, :w]
    offset = (tiled - 0.5)[:, :, np.newaxis] * strength
    dithered = np.clip(image + offset, 0.0, 1.0)
    return quantize_fn(dithered)


def _apply_floyd_steinberg(image, quantize_fn):
    """Floyd-Steinberg error diffusion dithering.

    `quantize_fn(pixel_1d) -> quantized_1d` operates on a single pixel (shape (3,)).
    """
    img = image.astype(np.float64).copy()
    h, w, _ = img.shape
    for y in range(h):
        for x in range(w):
            old = img[y, x].copy()
            new = quantize_fn(old)
            img[y, x] = new
            err = old - new
            if x + 1 < w:
                img[y, x + 1] += err * 7.0 / 16.0
            if y + 1 < h:
                if x - 1 >= 0:
                    img[y + 1, x - 1] += err * 3.0 / 16.0
                img[y + 1, x] += err * 5.0 / 16.0
                if x + 1 < w:
                    img[y + 1, x + 1] += err * 1.0 / 16.0
    return np.clip(img, 0.0, 1.0).astype(np.float32)


def _draw_grid_lines(image, px_x, px_y, line_frac, color):
    """Draw grid lines on an upscaled pixelated image.

    `line_frac` is the line width as a fraction of pixel size.
    `color` is one of 'black', 'dark_gray', 'white'.
    """
    color_map = {"black": 0.0, "dark_gray": 0.25, "white": 1.0}
    c = color_map.get(color, 0.0)
    h, w, ch = image.shape
    lw_x = max(1, int(round(px_x * line_frac)))
    lw_y = max(1, int(round(px_y * line_frac)))

    result = image.copy()
    # Vertical grid lines
    for x in range(0, w, px_x):
        x_end = min(x + lw_x, w)
        result[:, x:x_end, :] = c
    # Horizontal grid lines
    for y in range(0, h, px_y):
        y_end = min(y + lw_y, h)
        result[y:y_end, :, :] = c
    return result


def _pixelate_image(img_np, pixel_size, pixel_size_y, downsample, palette_mode,
                    num_colors, dithering, dither_strength, grid_lines, grid_color,
                    output_mode):
    """Core pixelation pipeline operating on a single HxWx3 float32 numpy array in 0-1 range.

    Returns processed HxWx3 float32 numpy array.
    """
    h, w, c = img_np.shape
    px_x = pixel_size
    px_y = pixel_size_y if pixel_size_y > 0 else pixel_size
    lo_w = max(1, w // px_x)
    lo_h = max(1, h // px_y)

    # --- Downsample ---
    if downsample == "median":
        # Block-wise median via reshape
        # Crop to exact multiple first
        crop_h = lo_h * px_y
        crop_w = lo_w * px_x
        cropped = img_np[:crop_h, :crop_w, :]
        blocks = cropped.reshape(lo_h, px_y, lo_w, px_x, c)
        low = np.median(blocks, axis=(1, 3)).astype(np.float32)
    else:
        # Use torch interpolation for area/nearest
        t = torch.from_numpy(img_np).unsqueeze(0).permute(0, 3, 1, 2)  # 1,C,H,W
        mode = "area" if downsample == "area" else "nearest"
        low_t = F.interpolate(t, size=(lo_h, lo_w), mode=mode)
        low = low_t.squeeze(0).permute(1, 2, 0).numpy()  # lo_h, lo_w, C

    # --- Color quantize + dither ---
    if palette_mode != "none":
        if palette_mode == "posterize":
            levels = float(num_colors)
            if dithering.startswith("ordered_"):
                mat_size = int(dithering.split("_")[1].split("x")[0])
                low = _apply_ordered_dither(low, mat_size, dither_strength / levels,
                                            lambda img: _quantize_posterize(img, levels))
            elif dithering == "floyd_steinberg":
                def _q_pixel(p):
                    q = np.floor(p * levels).clip(0, levels - 1) / (levels - 1)
                    return q.astype(np.float64)
                low = _apply_floyd_steinberg(low, _q_pixel)
            else:
                low = _quantize_posterize(low, levels)
        else:
            palette = RETRO_PALETTES[palette_mode]
            if dithering.startswith("ordered_"):
                mat_size = int(dithering.split("_")[1].split("x")[0])
                spread = dither_strength / max(len(palette), 1)
                low = _apply_ordered_dither(low, mat_size, spread,
                                            lambda img: _quantize_to_palette(img, palette))
            elif dithering == "floyd_steinberg":
                def _q_pixel_pal(p):
                    dists = np.sum((p - palette) ** 2, axis=1)
                    return palette[np.argmin(dists)].astype(np.float64)
                low = _apply_floyd_steinberg(low, _q_pixel_pal)
            else:
                low = _quantize_to_palette(low, palette)

    # --- Output ---
    if output_mode == "low_res":
        return low

    # Upscale back to original size
    t = torch.from_numpy(low).unsqueeze(0).permute(0, 3, 1, 2)
    up_t = F.interpolate(t, size=(h, w), mode="nearest")
    result = up_t.squeeze(0).permute(1, 2, 0).numpy()

    if grid_lines > 0.0:
        result = _draw_grid_lines(result, px_x, px_y, grid_lines, grid_color)

    return result


class Pixelate:
    """
    Advanced pixelation with area averaging, retro palettes, dithering, grid lines, and mask support.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "pixel_size": ("INT", {"default": 8, "min": 2, "max": 128, "step": 1}),
                "pixel_size_y": ("INT", {"default": 0, "min": 0, "max": 128, "step": 1}),
                "downsample": (["area", "nearest", "median"], {"default": "area"}),
                "palette_mode": (["none", "posterize", "game_boy", "nes", "c64", "pico8", "cga", "endesga32"], {"default": "none"}),
                "num_colors": ("INT", {"default": 8, "min": 2, "max": 256, "step": 1}),
                "dithering": (["none", "ordered_2x2", "ordered_4x4", "ordered_8x8", "floyd_steinberg"], {"default": "none"}),
                "dither_strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.05}),
                "grid_lines": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 0.5, "step": 0.01}),
                "grid_color": (["black", "dark_gray", "white"], {"default": "black"}),
                "output_mode": (["upscaled", "low_res"], {"default": "upscaled"}),
            },
            "optional": {
                "mask": ("MASK",),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "pixelate"
    CATEGORY = "Purz/Image/Effects"

    def pixelate(self, image, pixel_size, pixel_size_y, downsample, palette_mode,
                 num_colors, dithering, dither_strength, grid_lines, grid_color,
                 output_mode, mask=None):
        batch_size = image.shape[0]
        results = []

        for i in range(batch_size):
            img_np = image[i].cpu().numpy()
            processed = _pixelate_image(
                img_np, pixel_size, pixel_size_y, downsample, palette_mode,
                num_colors, dithering, dither_strength, grid_lines, grid_color,
                output_mode,
            )

            if mask is not None and output_mode == "upscaled":
                m = mask[i].cpu().numpy() if mask.shape[0] > 1 else mask[0].cpu().numpy()
                # Resize mask if needed
                if m.shape != img_np.shape[:2]:
                    m = cv2.resize(m, (img_np.shape[1], img_np.shape[0]), interpolation=cv2.INTER_LINEAR)
                m = m[:, :, np.newaxis]
                processed = img_np * (1.0 - m) + processed * m

            results.append(torch.from_numpy(processed.astype(np.float32)))

        return (torch.stack(results),)


class EdgeDetect:
    """
    Detect edges in an image using various methods
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "method": (["sobel", "canny", "laplacian"], {"default": "sobel"}),
                "threshold_low": ("FLOAT", {"default": 50.0, "min": 0.0, "max": 255.0, "step": 1.0}),
                "threshold_high": ("FLOAT", {"default": 150.0, "min": 0.0, "max": 255.0, "step": 1.0}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "detect_edges"
    CATEGORY = "Purz/Image/Effects"
    
    def detect_edges(self, image, method, threshold_low, threshold_high):
        batch_size = image.shape[0]
        result = []
        
        for i in range(batch_size):
            img_np = tensor_to_numpy_uint8(image[i])
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
            
            if method == "sobel":
                sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
                sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
                edges = np.sqrt(sobelx**2 + sobely**2)
                edges = np.clip(edges, 0, 255).astype(np.uint8)
            elif method == "canny":
                edges = cv2.Canny(gray, threshold_low, threshold_high)
            else:  # laplacian
                edges = cv2.Laplacian(gray, cv2.CV_64F)
                edges = np.absolute(edges)
                edges = np.clip(edges, 0, 255).astype(np.uint8)
            
            edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
            result.append(numpy_to_tensor(edges_rgb))
        
        result = torch.stack(result)
        return (result,)


# Image effects node mappings
IMAGE_NODE_CLASS_MAPPINGS = {
    "PurzImageToBlackWhite": ImageToBlackWhite,
    "PurzImageRotate": ImageRotate,
    "PurzImageBlur": ImageBlur,
    "PurzColorAdjust": ColorAdjust,
    "PurzImageFlip": ImageFlip,
    "PurzPixelate": Pixelate,
    "PurzEdgeDetect": EdgeDetect,
}

IMAGE_NODE_DISPLAY_NAME_MAPPINGS = {
    "PurzImageToBlackWhite": "Image to Black & White (Purz)",
    "PurzImageRotate": "Rotate Image (Purz)",
    "PurzImageBlur": "Blur Image (Purz)",
    "PurzColorAdjust": "Color Adjust (Purz)",
    "PurzImageFlip": "Flip/Mirror Image (Purz)",
    "PurzPixelate": "Pixelate Effect (Purz)",
    "PurzEdgeDetect": "Edge Detection (Purz)",
}