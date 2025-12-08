"""
ComfyUI-Purz Image Effects - V3 Schema
Modernized node definitions using the V3 API with proper slider UI elements.
"""

import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image, ImageEnhance
import cv2

from comfy_api.latest import io, ui

# Use slider display for numeric inputs
SLIDER = io.NumberDisplay.slider


class ImageToBlackWhite(io.ComfyNode):
    """Convert an image to black and white using luminance weighting."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzImageToBlackWhite",
            display_name="Image to Black & White (Purz)",
            category="Purz/Image/Color",
            description="Convert an image to black and white using luminance formula",
            inputs=[
                io.Image.Input("image"),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, image) -> io.NodeOutput:
        batch_size = image.shape[0]
        result = []

        for i in range(batch_size):
            img = image[i]
            # Convert to grayscale using RGB weights: Y = 0.299*R + 0.587*G + 0.114*B
            gray = 0.299 * img[:, :, 0] + 0.587 * img[:, :, 1] + 0.114 * img[:, :, 2]
            # Create RGB image from grayscale (all channels same value)
            bw_image = gray.unsqueeze(2).repeat(1, 1, 3)
            result.append(bw_image)

        result = torch.stack(result)
        return io.NodeOutput(result)


class ImageRotate(io.ComfyNode):
    """Rotate an image by specified degrees."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzImageRotate",
            display_name="Rotate Image (Purz)",
            category="Purz/Image/Transform",
            description="Rotate an image by specified degrees with background color options",
            inputs=[
                io.Image.Input("image"),
                io.Float.Input("angle", default=45.0, min=-360.0, max=360.0, step=1.0, display_mode=SLIDER),
                io.Combo.Input("background_color", options=["black", "white", "transparent"], default="black"),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, image, angle, background_color) -> io.NodeOutput:
        batch_size = image.shape[0]
        result = []

        for i in range(batch_size):
            img_tensor = image[i]
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)
            img_pil = Image.fromarray(img_np, mode='RGB')

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

            rotated_np = np.array(rotated).astype(np.float32) / 255.0
            rotated_tensor = torch.from_numpy(rotated_np)
            result.append(rotated_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


class ImageBlur(io.ComfyNode):
    """Apply various blur effects to an image."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzImageBlur",
            display_name="Blur Image (Purz)",
            category="Purz/Image/Effects",
            description="Apply gaussian, box, or motion blur effects",
            inputs=[
                io.Image.Input("image"),
                io.Combo.Input("blur_type", options=["gaussian", "box", "motion"], default="gaussian"),
                io.Float.Input("blur_radius", default=5.0, min=0.1, max=50.0, step=0.1, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, image, blur_type, blur_radius) -> io.NodeOutput:
        batch_size = image.shape[0]
        result = []

        for i in range(batch_size):
            img_tensor = image[i]
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)

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

            blurred_tensor = torch.from_numpy(blurred.astype(np.float32) / 255.0)
            result.append(blurred_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


class ColorAdjust(io.ComfyNode):
    """Adjust brightness, contrast, and saturation of an image."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzColorAdjust",
            display_name="Color Adjust (Purz)",
            category="Purz/Image/Color",
            description="Adjust brightness, contrast, and saturation",
            inputs=[
                io.Image.Input("image"),
                io.Float.Input("brightness", default=1.0, min=0.0, max=3.0, step=0.05, display_mode=SLIDER),
                io.Float.Input("contrast", default=1.0, min=0.0, max=3.0, step=0.05, display_mode=SLIDER),
                io.Float.Input("saturation", default=1.0, min=0.0, max=3.0, step=0.05, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, image, brightness, contrast, saturation) -> io.NodeOutput:
        batch_size = image.shape[0]
        result = []

        for i in range(batch_size):
            img_tensor = image[i]
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)
            img_pil = Image.fromarray(img_np, mode='RGB')

            if brightness != 1.0:
                enhancer = ImageEnhance.Brightness(img_pil)
                img_pil = enhancer.enhance(brightness)

            if contrast != 1.0:
                enhancer = ImageEnhance.Contrast(img_pil)
                img_pil = enhancer.enhance(contrast)

            if saturation != 1.0:
                enhancer = ImageEnhance.Color(img_pil)
                img_pil = enhancer.enhance(saturation)

            adjusted_np = np.array(img_pil).astype(np.float32) / 255.0
            adjusted_tensor = torch.from_numpy(adjusted_np)
            result.append(adjusted_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


class ImageFlip(io.ComfyNode):
    """Flip or mirror an image."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzImageFlip",
            display_name="Flip/Mirror Image (Purz)",
            category="Purz/Image/Transform",
            description="Flip image horizontally, vertically, or both",
            inputs=[
                io.Image.Input("image"),
                io.Combo.Input("flip_mode", options=["horizontal", "vertical", "both"], default="horizontal"),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, image, flip_mode) -> io.NodeOutput:
        if flip_mode == "horizontal":
            flipped = torch.flip(image, dims=[2])
        elif flip_mode == "vertical":
            flipped = torch.flip(image, dims=[1])
        else:  # both
            flipped = torch.flip(image, dims=[1, 2])

        return io.NodeOutput(flipped)


class Pixelate(io.ComfyNode):
    """Create a pixelated/mosaic effect."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzPixelate",
            display_name="Pixelate Effect (Purz)",
            category="Purz/Image/Effects",
            description="Create a pixelated/mosaic effect",
            inputs=[
                io.Image.Input("image"),
                io.Int.Input("pixel_size", default=10, min=2, max=100, step=1, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, image, pixel_size) -> io.NodeOutput:
        height = image.shape[1]
        width = image.shape[2]

        new_height = height // pixel_size
        new_width = width // pixel_size

        # Downscale then upscale to create pixelated effect
        downscaled = F.interpolate(
            image.permute(0, 3, 1, 2),
            size=(new_height, new_width),
            mode='nearest'
        )
        pixelated = F.interpolate(
            downscaled,
            size=(height, width),
            mode='nearest'
        )

        result = pixelated.permute(0, 2, 3, 1)
        return io.NodeOutput(result)


class EdgeDetect(io.ComfyNode):
    """Detect edges in an image using various methods."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzEdgeDetect",
            display_name="Edge Detection (Purz)",
            category="Purz/Image/Effects",
            description="Detect edges using Sobel, Canny, or Laplacian methods",
            inputs=[
                io.Image.Input("image"),
                io.Combo.Input("method", options=["sobel", "canny", "laplacian"], default="sobel"),
                io.Float.Input("threshold_low", default=50.0, min=0.0, max=255.0, step=1.0, display_mode=SLIDER),
                io.Float.Input("threshold_high", default=150.0, min=0.0, max=255.0, step=1.0, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, image, method, threshold_low, threshold_high) -> io.NodeOutput:
        batch_size = image.shape[0]
        result = []

        for i in range(batch_size):
            img_tensor = image[i]
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)

            # Convert to grayscale for edge detection
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

            # Convert single channel to RGB
            edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)

            edges_tensor = torch.from_numpy(edges_rgb.astype(np.float32) / 255.0)
            result.append(edges_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


# V3 Extension for Image Effects
from comfy_api.latest import ComfyExtension


class PurzImageEffectsExtension(ComfyExtension):
    """V3 Extension containing all Purz image effect nodes."""

    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [
            ImageToBlackWhite,
            ImageRotate,
            ImageBlur,
            ColorAdjust,
            ImageFlip,
            Pixelate,
            EdgeDetect,
        ]


async def comfy_entrypoint() -> PurzImageEffectsExtension:
    """Entry point for the V3 extension system."""
    return PurzImageEffectsExtension()
