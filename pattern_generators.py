import torch
import numpy as np
import math
from PIL import Image, ImageDraw


class CheckerboardPattern:
    """
    Generate a checkerboard pattern
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "square_size": ("INT", {"default": 32, "min": 8, "max": 256, "step": 8}),
                "color1": ("STRING", {"default": "#FFFFFF"}),
                "color2": ("STRING", {"default": "#000000"}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 16}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_pattern"
    CATEGORY = "Purz/Patterns/Basic"
    
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def generate_pattern(self, width, height, square_size, color1, color2, batch_size):
        result = []
        
        rgb1 = self.hex_to_rgb(color1)
        rgb2 = self.hex_to_rgb(color2)
        
        for _ in range(batch_size):
            img = Image.new('RGB', (width, height))
            draw = ImageDraw.Draw(img)
            
            for y in range(0, height, square_size):
                for x in range(0, width, square_size):
                    if ((x // square_size) + (y // square_size)) % 2 == 0:
                        color = rgb1
                    else:
                        color = rgb2
                    draw.rectangle([x, y, x + square_size, y + square_size], fill=color)
            
            img_np = np.array(img).astype(np.float32) / 255.0
            img_tensor = torch.from_numpy(img_np)
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


class StripesPattern:
    """
    Generate various stripe patterns
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "stripe_width": ("INT", {"default": 20, "min": 1, "max": 256, "step": 1}),
                "direction": (["horizontal", "vertical", "diagonal_right", "diagonal_left"], {"default": "vertical"}),
                "color1": ("STRING", {"default": "#FFFFFF"}),
                "color2": ("STRING", {"default": "#000000"}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 16}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_pattern"
    CATEGORY = "Purz/Patterns/Basic"
    
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def generate_pattern(self, width, height, stripe_width, direction, color1, color2, batch_size):
        result = []
        
        rgb1 = self.hex_to_rgb(color1)
        rgb2 = self.hex_to_rgb(color2)
        
        for _ in range(batch_size):
            img = Image.new('RGB', (width, height))
            draw = ImageDraw.Draw(img)
            
            if direction == "horizontal":
                for y in range(0, height, stripe_width * 2):
                    draw.rectangle([0, y, width, y + stripe_width], fill=rgb1)
                    if y + stripe_width < height:
                        draw.rectangle([0, y + stripe_width, width, min(y + stripe_width * 2, height)], fill=rgb2)
            
            elif direction == "vertical":
                for x in range(0, width, stripe_width * 2):
                    draw.rectangle([x, 0, x + stripe_width, height], fill=rgb1)
                    if x + stripe_width < width:
                        draw.rectangle([x + stripe_width, 0, min(x + stripe_width * 2, width), height], fill=rgb2)
            
            elif direction == "diagonal_right":
                # Draw diagonal stripes (top-left to bottom-right)
                for i in range(-height, width, stripe_width * 2):
                    points = [(i, 0), (i + stripe_width, 0), 
                             (i + stripe_width + height, height), (i + height, height)]
                    draw.polygon(points, fill=rgb1)
                    
                    points2 = [(i + stripe_width, 0), (i + stripe_width * 2, 0),
                              (i + stripe_width * 2 + height, height), (i + stripe_width + height, height)]
                    draw.polygon(points2, fill=rgb2)
            
            else:  # diagonal_left
                # Draw diagonal stripes (top-right to bottom-left)
                for i in range(0, width + height, stripe_width * 2):
                    points = [(i, 0), (i - height, height), 
                             (max(0, i - height - stripe_width), height), (max(0, i - stripe_width), 0)]
                    draw.polygon(points, fill=rgb1)
                    
                    points2 = [(min(width, i + stripe_width), 0), (i + stripe_width - height, height),
                              (max(0, i - height), height), (i, 0)]
                    draw.polygon(points2, fill=rgb2)
            
            img_np = np.array(img).astype(np.float32) / 255.0
            img_tensor = torch.from_numpy(img_np)
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


class PolkaDotPattern:
    """
    Generate polka dot patterns
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "dot_radius": ("INT", {"default": 10, "min": 2, "max": 100, "step": 1}),
                "spacing": ("INT", {"default": 40, "min": 10, "max": 200, "step": 5}),
                "background_color": ("STRING", {"default": "#FFFFFF"}),
                "dot_color": ("STRING", {"default": "#000000"}),
                "stagger": ("BOOLEAN", {"default": True}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 16}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_pattern"
    CATEGORY = "Purz/Patterns/Basic"
    
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def generate_pattern(self, width, height, dot_radius, spacing, background_color, dot_color, stagger, batch_size):
        result = []
        
        bg_rgb = self.hex_to_rgb(background_color)
        dot_rgb = self.hex_to_rgb(dot_color)
        
        for _ in range(batch_size):
            img = Image.new('RGB', (width, height), bg_rgb)
            draw = ImageDraw.Draw(img)
            
            y = spacing // 2
            row = 0
            while y < height + dot_radius:
                x = spacing // 2
                if stagger and row % 2 == 1:
                    x += spacing // 2
                
                while x < width + dot_radius:
                    draw.ellipse([x - dot_radius, y - dot_radius, 
                                 x + dot_radius, y + dot_radius], fill=dot_rgb)
                    x += spacing
                
                y += spacing
                row += 1
            
            img_np = np.array(img).astype(np.float32) / 255.0
            img_tensor = torch.from_numpy(img_np)
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


class GridPattern:
    """
    Generate grid patterns
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "grid_size": ("INT", {"default": 32, "min": 8, "max": 256, "step": 8}),
                "line_width": ("INT", {"default": 2, "min": 1, "max": 20, "step": 1}),
                "background_color": ("STRING", {"default": "#FFFFFF"}),
                "line_color": ("STRING", {"default": "#000000"}),
                "style": (["solid", "dashed", "dotted"], {"default": "solid"}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 16}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_pattern"
    CATEGORY = "Purz/Patterns/Basic"
    
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def generate_pattern(self, width, height, grid_size, line_width, background_color, line_color, style, batch_size):
        result = []
        
        bg_rgb = self.hex_to_rgb(background_color)
        line_rgb = self.hex_to_rgb(line_color)
        
        for _ in range(batch_size):
            img = Image.new('RGB', (width, height), bg_rgb)
            draw = ImageDraw.Draw(img)
            
            # Draw vertical lines
            for x in range(0, width + 1, grid_size):
                if style == "solid":
                    draw.rectangle([x - line_width//2, 0, x + line_width//2, height], fill=line_rgb)
                elif style == "dashed":
                    for y in range(0, height, 20):
                        draw.rectangle([x - line_width//2, y, x + line_width//2, min(y + 10, height)], fill=line_rgb)
                else:  # dotted
                    for y in range(0, height, 10):
                        draw.ellipse([x - line_width, y - line_width, x + line_width, y + line_width], fill=line_rgb)
            
            # Draw horizontal lines
            for y in range(0, height + 1, grid_size):
                if style == "solid":
                    draw.rectangle([0, y - line_width//2, width, y + line_width//2], fill=line_rgb)
                elif style == "dashed":
                    for x in range(0, width, 20):
                        draw.rectangle([x, y - line_width//2, min(x + 10, width), y + line_width//2], fill=line_rgb)
                else:  # dotted
                    for x in range(0, width, 10):
                        draw.ellipse([x - line_width, y - line_width, x + line_width, y + line_width], fill=line_rgb)
            
            img_np = np.array(img).astype(np.float32) / 255.0
            img_tensor = torch.from_numpy(img_np)
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


class SimpleNoisePattern:
    """
    Generate simple noise patterns using random values
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "noise_type": (["random", "smooth", "cloudy"], {"default": "smooth"}),
                "intensity": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 2.0, "step": 0.1}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 9999, "step": 1}),
                "colored": ("BOOLEAN", {"default": False}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 16}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_pattern"
    CATEGORY = "Purz/Patterns/Noise"
    
    def smooth_noise(self, width, height, seed):
        """Generate smooth noise using interpolation"""
        np.random.seed(seed)
        # Generate low-res noise
        low_res = 8
        low_width = width // low_res
        low_height = height // low_res
        
        # Create random values
        low_noise = np.random.random((low_height + 1, low_width + 1))
        
        # Interpolate to full size
        from scipy.ndimage import zoom
        try:
            noise = zoom(low_noise, (height / low_height, width / low_width), order=1)
            return noise[:height, :width]
        except ImportError:
            # Fallback if scipy not available - simple bilinear interpolation
            noise = np.zeros((height, width))
            for y in range(height):
                for x in range(width):
                    # Find the surrounding low-res points
                    lx = (x * low_width) // width
                    ly = (y * low_height) // height
                    fx = ((x * low_width) % width) / width
                    fy = ((y * low_height) % height) / height
                    
                    # Bilinear interpolation
                    lx = min(lx, low_width - 1)
                    ly = min(ly, low_height - 1)
                    
                    tl = low_noise[ly, lx]
                    tr = low_noise[ly, min(lx + 1, low_width)]
                    bl = low_noise[min(ly + 1, low_height), lx]
                    br = low_noise[min(ly + 1, low_height), min(lx + 1, low_width)]
                    
                    top = tl * (1 - fx) + tr * fx
                    bottom = bl * (1 - fx) + br * fx
                    noise[y, x] = top * (1 - fy) + bottom * fy
            
            return noise
    
    def generate_pattern(self, width, height, noise_type, intensity, seed, colored, batch_size):
        result = []
        
        for b in range(batch_size):
            current_seed = seed + b * 100
            
            if noise_type == "random":
                np.random.seed(current_seed)
                if colored:
                    noise_array = np.random.random((height, width, 3)) * intensity
                else:
                    noise_array = np.random.random((height, width)) * intensity
                    noise_array = np.stack([noise_array] * 3, axis=2)
            
            elif noise_type == "smooth":
                if colored:
                    channels = []
                    for c in range(3):
                        channel_noise = self.smooth_noise(width, height, current_seed + c * 33)
                        channels.append(channel_noise * intensity)
                    noise_array = np.stack(channels, axis=2)
                else:
                    noise_array = self.smooth_noise(width, height, current_seed) * intensity
                    noise_array = np.stack([noise_array] * 3, axis=2)
            
            else:  # cloudy
                # Generate multiple octaves for cloud-like effect
                if colored:
                    channels = []
                    for c in range(3):
                        cloud = np.zeros((height, width))
                        for octave in range(4):
                            scale = 2 ** octave
                            octave_noise = self.smooth_noise(width // scale, height // scale, current_seed + c * 33 + octave * 7)
                            # Resize back to full size
                            if octave_noise.shape != (height, width):
                                # Simple nearest neighbor upscaling
                                temp = np.zeros((height, width))
                                for y in range(height):
                                    for x in range(width):
                                        src_y = min(y * octave_noise.shape[0] // height, octave_noise.shape[0] - 1)
                                        src_x = min(x * octave_noise.shape[1] // width, octave_noise.shape[1] - 1)
                                        temp[y, x] = octave_noise[src_y, src_x]
                                octave_noise = temp
                            
                            cloud += octave_noise / (2 ** octave)
                        channels.append(cloud * intensity)
                    noise_array = np.stack(channels, axis=2)
                else:
                    cloud = np.zeros((height, width))
                    for octave in range(4):
                        scale = 2 ** octave
                        octave_noise = self.smooth_noise(width // scale, height // scale, current_seed + octave * 7)
                        # Simple nearest neighbor upscaling
                        if octave_noise.shape != (height, width):
                            temp = np.zeros((height, width))
                            for y in range(height):
                                for x in range(width):
                                    src_y = min(y * octave_noise.shape[0] // height, octave_noise.shape[0] - 1)
                                    src_x = min(x * octave_noise.shape[1] // width, octave_noise.shape[1] - 1)
                                    temp[y, x] = octave_noise[src_y, src_x]
                            octave_noise = temp
                        
                        cloud += octave_noise / (2 ** octave)
                    
                    noise_array = np.stack([cloud * intensity] * 3, axis=2)
            
            # Clamp values to 0-1
            noise_array = np.clip(noise_array, 0, 1)
            
            img_tensor = torch.from_numpy(noise_array.astype(np.float32))
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


class GradientPattern:
    """
    Generate gradient patterns
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "gradient_type": (["linear", "radial", "diagonal", "corner"], {"default": "linear"}),
                "direction": (["horizontal", "vertical"], {"default": "horizontal"}),
                "color1": ("STRING", {"default": "#000000"}),
                "color2": ("STRING", {"default": "#FFFFFF"}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 16}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_pattern"
    CATEGORY = "Purz/Patterns/Basic"
    
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def generate_pattern(self, width, height, gradient_type, direction, color1, color2, batch_size):
        result = []
        
        rgb1 = np.array(self.hex_to_rgb(color1)) / 255.0
        rgb2 = np.array(self.hex_to_rgb(color2)) / 255.0
        
        for _ in range(batch_size):
            img_np = np.zeros((height, width, 3), dtype=np.float32)
            
            if gradient_type == "linear":
                if direction == "horizontal":
                    for x in range(width):
                        t = x / (width - 1)
                        img_np[:, x] = rgb1 * (1 - t) + rgb2 * t
                else:  # vertical
                    for y in range(height):
                        t = y / (height - 1)
                        img_np[y, :] = rgb1 * (1 - t) + rgb2 * t
            
            elif gradient_type == "radial":
                center_x, center_y = width // 2, height // 2
                max_dist = math.sqrt(center_x**2 + center_y**2)
                
                for y in range(height):
                    for x in range(width):
                        dist = math.sqrt((x - center_x)**2 + (y - center_y)**2)
                        t = min(dist / max_dist, 1.0)
                        img_np[y, x] = rgb1 * (1 - t) + rgb2 * t
            
            elif gradient_type == "diagonal":
                for y in range(height):
                    for x in range(width):
                        t = (x + y) / (width + height - 2)
                        img_np[y, x] = rgb1 * (1 - t) + rgb2 * t
            
            else:  # corner
                for y in range(height):
                    for x in range(width):
                        t = math.sqrt((x / (width - 1))**2 + (y / (height - 1))**2) / math.sqrt(2)
                        t = min(t, 1.0)
                        img_np[y, x] = rgb1 * (1 - t) + rgb2 * t
            
            img_tensor = torch.from_numpy(img_np)
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


# Pattern node mappings
PATTERN_NODE_CLASS_MAPPINGS = {
    "PurzCheckerboardPattern": CheckerboardPattern,
    "PurzStripesPattern": StripesPattern,
    "PurzPolkaDotPattern": PolkaDotPattern,
    "PurzGridPattern": GridPattern,
    "PurzSimpleNoisePattern": SimpleNoisePattern,
    "PurzGradientPattern": GradientPattern,
}

PATTERN_NODE_DISPLAY_NAME_MAPPINGS = {
    "PurzCheckerboardPattern": "Checkerboard Pattern (Purz)",
    "PurzStripesPattern": "Stripes Pattern (Purz)",
    "PurzPolkaDotPattern": "Polka Dot Pattern (Purz)",
    "PurzGridPattern": "Grid Pattern (Purz)",
    "PurzSimpleNoisePattern": "Simple Noise Pattern (Purz)",
    "PurzGradientPattern": "Gradient Pattern (Purz)",
}