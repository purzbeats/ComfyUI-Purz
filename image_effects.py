import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
import cv2


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
            # Convert tensor to PIL Image
            img_tensor = image[i]
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)
            img_pil = Image.fromarray(img_np, mode='RGB')
            
            # Set background color
            if background_color == "white":
                bg_color = (255, 255, 255)
            elif background_color == "transparent":
                # Convert to RGBA for transparency
                img_pil = img_pil.convert('RGBA')
                bg_color = (0, 0, 0, 0)
            else:  # black
                bg_color = (0, 0, 0)
            
            # Rotate image
            rotated = img_pil.rotate(angle, expand=True, fillcolor=bg_color)
            
            # Convert back to RGB if it was RGBA
            if rotated.mode == 'RGBA':
                # Create a white background
                background = Image.new('RGB', rotated.size, (0, 0, 0))
                background.paste(rotated, mask=rotated.split()[3])
                rotated = background
            
            # Convert back to tensor
            rotated_np = np.array(rotated).astype(np.float32) / 255.0
            rotated_tensor = torch.from_numpy(rotated_np)
            
            result.append(rotated_tensor)
        
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
            img_tensor = image[i]
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)
            
            if blur_type == "gaussian":
                # Gaussian blur
                kernel_size = int(blur_radius * 2) | 1  # Ensure odd number
                blurred = cv2.GaussianBlur(img_np, (kernel_size, kernel_size), blur_radius)
            elif blur_type == "box":
                # Box blur
                kernel_size = int(blur_radius) | 1
                blurred = cv2.boxFilter(img_np, -1, (kernel_size, kernel_size))
            else:  # motion
                # Motion blur
                kernel_size = int(blur_radius)
                kernel = np.zeros((kernel_size, kernel_size))
                kernel[int((kernel_size-1)/2), :] = np.ones(kernel_size)
                kernel = kernel / kernel_size
                blurred = cv2.filter2D(img_np, -1, kernel)
            
            blurred_tensor = torch.from_numpy(blurred.astype(np.float32) / 255.0)
            result.append(blurred_tensor)
        
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
            # Convert tensor to PIL Image
            img_tensor = image[i]
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)
            img_pil = Image.fromarray(img_np, mode='RGB')
            
            # Apply adjustments
            if brightness != 1.0:
                enhancer = ImageEnhance.Brightness(img_pil)
                img_pil = enhancer.enhance(brightness)
            
            if contrast != 1.0:
                enhancer = ImageEnhance.Contrast(img_pil)
                img_pil = enhancer.enhance(contrast)
            
            if saturation != 1.0:
                enhancer = ImageEnhance.Color(img_pil)
                img_pil = enhancer.enhance(saturation)
            
            # Convert back to tensor
            adjusted_np = np.array(img_pil).astype(np.float32) / 255.0
            adjusted_tensor = torch.from_numpy(adjusted_np)
            
            result.append(adjusted_tensor)
        
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


class Pixelate:
    """
    Create a pixelated/mosaic effect
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "pixel_size": ("INT", {"default": 10, "min": 2, "max": 100, "step": 1}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "pixelate"
    CATEGORY = "Purz/Image/Effects"
    
    def pixelate(self, image, pixel_size):
        batch_size = image.shape[0]
        height = image.shape[1]
        width = image.shape[2]
        
        # Calculate new dimensions
        new_height = height // pixel_size
        new_width = width // pixel_size
        
        # Downscale then upscale to create pixelated effect
        downscaled = F.interpolate(image.permute(0, 3, 1, 2), 
                                   size=(new_height, new_width), 
                                   mode='nearest')
        pixelated = F.interpolate(downscaled, 
                                  size=(height, width), 
                                  mode='nearest')
        
        # Permute back to original format
        result = pixelated.permute(0, 2, 3, 1)
        
        return (result,)


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
            img_tensor = image[i]
            img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)
            
            # Convert to grayscale for edge detection
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
            
            if method == "sobel":
                # Sobel edge detection
                sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
                sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
                edges = np.sqrt(sobelx**2 + sobely**2)
                edges = np.clip(edges, 0, 255).astype(np.uint8)
            elif method == "canny":
                # Canny edge detection
                edges = cv2.Canny(gray, threshold_low, threshold_high)
            else:  # laplacian
                # Laplacian edge detection
                edges = cv2.Laplacian(gray, cv2.CV_64F)
                edges = np.absolute(edges)
                edges = np.clip(edges, 0, 255).astype(np.uint8)
            
            # Convert single channel to RGB
            edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
            
            edges_tensor = torch.from_numpy(edges_rgb.astype(np.float32) / 255.0)
            result.append(edges_tensor)
        
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