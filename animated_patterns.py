import torch
import numpy as np
import math
from PIL import Image, ImageDraw


class TextureMath:
    """Mathematical operations for combining textures, like Blender's Math node"""
    
    @staticmethod
    def apply_operation(texture1, texture2, operation, clamp=True):
        """
        Apply mathematical operation between two textures
        
        Args:
            texture1, texture2: numpy arrays with texture values
            operation: mathematical operation to apply
            clamp: whether to clamp result to 0-1 range
        """
        if operation == "add":
            result = texture1 + texture2
        elif operation == "subtract":
            result = texture1 - texture2
        elif operation == "multiply":
            result = texture1 * texture2
        elif operation == "divide":
            # Avoid division by zero
            result = np.divide(texture1, texture2, out=np.zeros_like(texture1), where=texture2!=0)
        elif operation == "power":
            result = np.power(np.abs(texture1), texture2)
        elif operation == "minimum":
            result = np.minimum(texture1, texture2)
        elif operation == "maximum":
            result = np.maximum(texture1, texture2)
        elif operation == "round":
            result = np.round(texture1 + texture2)
        elif operation == "floor":
            result = np.floor(texture1 + texture2)
        elif operation == "ceil":
            result = np.ceil(texture1 + texture2)
        elif operation == "modulo":
            result = np.mod(texture1, np.where(texture2 == 0, 1, texture2))
        elif operation == "absolute":
            result = np.abs(texture1 + texture2)
        elif operation == "greater_than":
            result = (texture1 > texture2).astype(float)
        elif operation == "less_than":
            result = (texture1 < texture2).astype(float)
        elif operation == "sine":
            result = np.sin(texture1 + texture2)
        elif operation == "cosine":
            result = np.cos(texture1 + texture2)
        elif operation == "tangent":
            result = np.tan(texture1 + texture2)
        elif operation == "smooth_min":
            # Smooth minimum function
            k = 0.1  # smoothing factor
            h = np.maximum(k - np.abs(texture1 - texture2), 0) / k
            result = np.minimum(texture1, texture2) - h * h * k * 0.25
        elif operation == "smooth_max":
            # Smooth maximum function
            k = 0.1  # smoothing factor
            h = np.maximum(k - np.abs(texture1 - texture2), 0) / k
            result = np.maximum(texture1, texture2) + h * h * k * 0.25
        else:  # default to add
            result = texture1 + texture2
        
        if clamp:
            result = np.clip(result, 0.0, 1.0)
        
        return result


class ColorRamp:
    """Color ramp functionality like Blender's ColorRamp node"""
    
    @staticmethod
    def apply_color_ramp(texture, color1, color2, ramp_type="linear"):
        """
        Apply color ramp to a grayscale texture
        
        Args:
            texture: grayscale texture values (0-1)
            color1, color2: RGB tuples for start and end colors
            ramp_type: interpolation type
        """
        height, width = texture.shape
        result = np.zeros((height, width, 3))
        
        color1 = np.array(color1) / 255.0
        color2 = np.array(color2) / 255.0
        
        if ramp_type == "linear":
            for c in range(3):
                result[:, :, c] = color1[c] * (1 - texture) + color2[c] * texture
        elif ramp_type == "ease":
            # Smooth step interpolation
            smooth_texture = texture * texture * (3.0 - 2.0 * texture)
            for c in range(3):
                result[:, :, c] = color1[c] * (1 - smooth_texture) + color2[c] * smooth_texture
        elif ramp_type == "b_spline":
            # B-spline interpolation
            t = texture
            t2 = t * t
            t3 = t2 * t
            smooth_texture = t3 * (t * (t * 6.0 - 15.0) + 10.0)
            for c in range(3):
                result[:, :, c] = color1[c] * (1 - smooth_texture) + color2[c] * smooth_texture
        elif ramp_type == "cardinal":
            # Cardinal spline
            t = texture
            smooth_texture = t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
            for c in range(3):
                result[:, :, c] = color1[c] * (1 - smooth_texture) + color2[c] * smooth_texture
        elif ramp_type == "constant":
            # Hard transition at 50% with no interpolation
            for c in range(3):
                result[:, :, c] = np.where(texture < 0.5, color1[c], color2[c])
        
        return result


class WaveTextureGenerator:
    """Helper class for generating wave textures as mathematical values"""
    
    @staticmethod
    def generate_wave_texture(width, height, wave_type, scale, phase, direction="horizontal", shape="sine"):
        """
        Generate a wave texture with values from -1 to 1 (before normalization)
        
        Args:
            width, height: texture dimensions
            wave_type: "sine", "cosine", "square", "triangle", "sawtooth"
            scale: wave frequency (higher = more waves)
            phase: phase offset (0 to 2*pi for full cycle)
            direction: "horizontal", "vertical", "diagonal", "radial"
            shape: "sine", "square", "triangle" for wave shape modification
        """
        wave_texture = np.zeros((height, width))
        
        if direction == "horizontal":
            for x in range(width):
                wave_val = WaveTextureGenerator._calculate_wave(x * scale + phase, wave_type, shape)
                wave_texture[:, x] = wave_val
        
        elif direction == "vertical":
            for y in range(height):
                wave_val = WaveTextureGenerator._calculate_wave(y * scale + phase, wave_type, shape)
                wave_texture[y, :] = wave_val
        
        elif direction == "diagonal":
            for y in range(height):
                for x in range(width):
                    wave_val = WaveTextureGenerator._calculate_wave((x + y) * scale + phase, wave_type, shape)
                    wave_texture[y, x] = wave_val
        
        elif direction == "radial":
            center_x, center_y = width // 2, height // 2
            for y in range(height):
                for x in range(width):
                    distance = math.sqrt((x - center_x)**2 + (y - center_y)**2)
                    wave_val = WaveTextureGenerator._calculate_wave(distance * scale + phase, wave_type, shape)
                    wave_texture[y, x] = wave_val
        
        return wave_texture
    
    @staticmethod
    def _calculate_wave(value, wave_type, shape):
        """Calculate wave value (-1 to 1 range)"""
        if wave_type == "sine":
            base_wave = math.sin(value)
        elif wave_type == "cosine":
            base_wave = math.cos(value)
        elif wave_type == "square":
            base_wave = 1.0 if (value % (2 * math.pi)) < math.pi else -1.0
        elif wave_type == "triangle":
            normalized = (value % (2 * math.pi)) / (2 * math.pi)
            if normalized < 0.5:
                base_wave = 4 * normalized - 1
            else:
                base_wave = 3 - 4 * normalized
        elif wave_type == "sawtooth":
            base_wave = 2 * ((value % (2 * math.pi)) / (2 * math.pi)) - 1
        else:
            base_wave = math.sin(value)
        
        # Apply shape modification
        if shape == "square":
            return 1.0 if base_wave > 0 else -1.0
        elif shape == "triangle":
            # Convert to triangle-like shape
            return math.copysign(abs(base_wave) ** 0.5, base_wave)
        else:  # sine (default)
            return base_wave


class PatternTextureGenerator:
    """Generate base pattern textures as mathematical values (0-1)"""
    
    @staticmethod
    def generate_checkerboard(width, height, square_size):
        """Generate checkerboard pattern as 0-1 texture"""
        pattern = np.zeros((height, width))
        for y in range(height):
            for x in range(width):
                if ((x // square_size) + (y // square_size)) % 2 == 0:
                    pattern[y, x] = 1.0
        return pattern
    
    @staticmethod
    def generate_stripes(width, height, stripe_width, direction):
        """Generate stripes pattern as 0-1 texture"""
        pattern = np.zeros((height, width))
        
        if direction == "horizontal":
            for y in range(height):
                pattern[y, :] = 1.0 if (y // stripe_width) % 2 == 0 else 0.0
        elif direction == "vertical":
            for x in range(width):
                pattern[:, x] = 1.0 if (x // stripe_width) % 2 == 0 else 0.0
        elif direction == "diagonal_right":
            for y in range(height):
                for x in range(width):
                    pattern[y, x] = 1.0 if ((x + y) // stripe_width) % 2 == 0 else 0.0
        else:  # diagonal_left
            for y in range(height):
                for x in range(width):
                    pattern[y, x] = 1.0 if ((x - y) // stripe_width) % 2 == 0 else 0.0
        
        return pattern
    
    @staticmethod
    def generate_polka_dots(width, height, dot_radius, spacing, stagger):
        """Generate polka dots pattern as 0-1 texture"""
        pattern = np.zeros((height, width))
        
        y = spacing // 2
        row = 0
        while y < height:
            x = spacing // 2
            if stagger and row % 2 == 1:
                x += spacing // 2
            
            while x < width:
                # Create circular dot
                for py in range(max(0, y - dot_radius), min(height, y + dot_radius + 1)):
                    for px in range(max(0, x - dot_radius), min(width, x + dot_radius + 1)):
                        if (px - x)**2 + (py - y)**2 <= dot_radius**2:
                            pattern[py, px] = 1.0
                x += spacing
            
            y += spacing
            row += 1
        
        return pattern


class AnimatedCheckerboardPattern:
    """
    Generate animated checkerboard pattern with mathematical wave texture combination
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
                "frame_count": ("INT", {"default": 30, "min": 1, "max": 300, "step": 1}),
                "wave_type": (["sine", "cosine", "square", "triangle", "sawtooth"], {"default": "sine"}),
                "wave_scale": ("FLOAT", {"default": 0.1, "min": 0.01, "max": 1.0, "step": 0.01}),
                "wave_direction": (["horizontal", "vertical", "diagonal", "radial"], {"default": "horizontal"}),
                "wave_shape": (["sine", "square", "triangle"], {"default": "sine"}),
                "math_operation": (["add", "subtract", "multiply", "divide", "power", "minimum", "maximum", 
                                  "modulo", "sine", "cosine", "smooth_min", "smooth_max"], {"default": "add"}),
                "wave_factor": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 2.0, "step": 0.05}),
                "reverse_phase": ("BOOLEAN", {"default": False}),
                "color_ramp_type": (["linear", "ease", "b_spline", "cardinal", "constant"], {"default": "linear"}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_animated_pattern"
    CATEGORY = "Purz/Patterns/Animated"
    
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def generate_animated_pattern(self, width, height, square_size, color1, color2, frame_count, 
                                wave_type, wave_scale, wave_direction, wave_shape, math_operation, 
                                wave_factor, reverse_phase, color_ramp_type):
        result = []
        
        rgb1 = self.hex_to_rgb(color1)
        rgb2 = self.hex_to_rgb(color2)
        
        # Generate base checkerboard pattern (0-1 texture)
        base_pattern = PatternTextureGenerator.generate_checkerboard(width, height, square_size)
        
        for frame in range(frame_count):
            # Calculate phase (0 to 2*pi or -2*pi to 0 if reversed)
            if reverse_phase:
                phase = -2 * math.pi * frame / frame_count
            else:
                phase = 2 * math.pi * frame / frame_count
            
            # Generate wave texture (-1 to 1, then normalized to 0-1)
            wave_texture = WaveTextureGenerator.generate_wave_texture(
                width, height, wave_type, wave_scale, phase, wave_direction, wave_shape
            )
            # Normalize wave to 0-1 and apply factor
            wave_texture = (wave_texture + 1) / 2 * wave_factor
            
            # Apply mathematical operation between base pattern and wave texture
            combined_texture = TextureMath.apply_operation(
                base_pattern, wave_texture, math_operation, clamp=True
            )
            
            # Apply color ramp to convert grayscale texture to RGB
            img_np = ColorRamp.apply_color_ramp(combined_texture, rgb1, rgb2, color_ramp_type)
            
            img_tensor = torch.from_numpy(img_np.astype(np.float32))
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


class AnimatedStripesPattern:
    """
    Generate animated stripes pattern with mathematical wave texture combination
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
                "frame_count": ("INT", {"default": 30, "min": 1, "max": 300, "step": 1}),
                "wave_type": (["sine", "cosine", "square", "triangle", "sawtooth"], {"default": "sine"}),
                "wave_scale": ("FLOAT", {"default": 0.1, "min": 0.01, "max": 1.0, "step": 0.01}),
                "wave_direction": (["horizontal", "vertical", "diagonal", "radial"], {"default": "horizontal"}),
                "wave_shape": (["sine", "square", "triangle"], {"default": "sine"}),
                "math_operation": (["add", "subtract", "multiply", "divide", "power", "minimum", "maximum", 
                                  "modulo", "sine", "cosine", "smooth_min", "smooth_max"], {"default": "add"}),
                "wave_factor": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 2.0, "step": 0.05}),
                "reverse_phase": ("BOOLEAN", {"default": False}),
                "color_ramp_type": (["linear", "ease", "b_spline", "cardinal", "constant"], {"default": "linear"}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_animated_pattern"
    CATEGORY = "Purz/Patterns/Animated"
    
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def generate_animated_pattern(self, width, height, stripe_width, direction, color1, color2, frame_count,
                                wave_type, wave_scale, wave_direction, wave_shape, math_operation, 
                                wave_factor, reverse_phase, color_ramp_type):
        result = []
        
        rgb1 = self.hex_to_rgb(color1)
        rgb2 = self.hex_to_rgb(color2)
        
        # Generate base stripe pattern (0-1 texture)
        base_pattern = PatternTextureGenerator.generate_stripes(width, height, stripe_width, direction)
        
        for frame in range(frame_count):
            # Calculate phase with high precision to avoid jitter
            if reverse_phase:
                phase = -2.0 * math.pi * float(frame) / float(frame_count)
            else:
                phase = 2.0 * math.pi * float(frame) / float(frame_count)
            
            # Generate wave texture (-1 to 1, then normalized to 0-1)
            wave_texture = WaveTextureGenerator.generate_wave_texture(
                width, height, wave_type, wave_scale, phase, wave_direction, wave_shape
            )
            # Normalize wave to 0-1 and apply factor
            wave_texture = (wave_texture + 1.0) * 0.5 * wave_factor
            
            # Apply mathematical operation between base pattern and wave texture
            combined_texture = TextureMath.apply_operation(
                base_pattern, wave_texture, math_operation, clamp=True
            )
            
            # Apply color ramp to convert grayscale texture to RGB
            img_np = ColorRamp.apply_color_ramp(combined_texture, rgb1, rgb2, color_ramp_type)
            
            img_tensor = torch.from_numpy(img_np.astype(np.float32))
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


class AnimatedPolkaDotPattern:
    """
    Generate animated polka dot pattern with mathematical wave texture combination
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
                "frame_count": ("INT", {"default": 30, "min": 1, "max": 300, "step": 1}),
                "wave_type": (["sine", "cosine", "square", "triangle", "sawtooth"], {"default": "sine"}),
                "wave_scale": ("FLOAT", {"default": 0.1, "min": 0.01, "max": 1.0, "step": 0.01}),
                "wave_direction": (["horizontal", "vertical", "diagonal", "radial"], {"default": "radial"}),
                "wave_shape": (["sine", "square", "triangle"], {"default": "sine"}),
                "math_operation": (["add", "subtract", "multiply", "divide", "power", "minimum", "maximum", 
                                  "modulo", "sine", "cosine", "smooth_min", "smooth_max"], {"default": "add"}),
                "wave_factor": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 2.0, "step": 0.05}),
                "reverse_phase": ("BOOLEAN", {"default": False}),
                "color_ramp_type": (["linear", "ease", "b_spline", "cardinal", "constant"], {"default": "linear"}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_animated_pattern"
    CATEGORY = "Purz/Patterns/Animated"
    
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def generate_animated_pattern(self, width, height, dot_radius, spacing, background_color, dot_color, 
                                stagger, frame_count, wave_type, wave_scale, wave_direction, wave_shape, 
                                math_operation, wave_factor, reverse_phase, color_ramp_type):
        result = []
        
        bg_rgb = self.hex_to_rgb(background_color)
        dot_rgb = self.hex_to_rgb(dot_color)
        
        # Generate base polka dot pattern (0-1 texture)
        base_pattern = PatternTextureGenerator.generate_polka_dots(width, height, dot_radius, spacing, stagger)
        
        for frame in range(frame_count):
            # Calculate phase with high precision to avoid jitter
            if reverse_phase:
                phase = -2.0 * math.pi * float(frame) / float(frame_count)
            else:
                phase = 2.0 * math.pi * float(frame) / float(frame_count)
            
            # Generate wave texture (-1 to 1, then normalized to 0-1)
            wave_texture = WaveTextureGenerator.generate_wave_texture(
                width, height, wave_type, wave_scale, phase, wave_direction, wave_shape
            )
            # Normalize wave to 0-1 and apply factor
            wave_texture = (wave_texture + 1.0) * 0.5 * wave_factor
            
            # Apply mathematical operation between base pattern and wave texture
            combined_texture = TextureMath.apply_operation(
                base_pattern, wave_texture, math_operation, clamp=True
            )
            
            # Apply color ramp to convert grayscale texture to RGB
            img_np = ColorRamp.apply_color_ramp(combined_texture, bg_rgb, dot_rgb, color_ramp_type)
            
            img_tensor = torch.from_numpy(img_np.astype(np.float32))
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


class AnimatedNoisePattern:
    """
    Generate animated noise pattern with mathematical wave texture combination
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
                "frame_count": ("INT", {"default": 30, "min": 1, "max": 300, "step": 1}),
                "wave_type": (["sine", "cosine", "square", "triangle", "sawtooth"], {"default": "sine"}),
                "wave_scale": ("FLOAT", {"default": 0.1, "min": 0.01, "max": 1.0, "step": 0.01}),
                "wave_direction": (["horizontal", "vertical", "diagonal", "radial"], {"default": "radial"}),
                "wave_shape": (["sine", "square", "triangle"], {"default": "sine"}),
                "math_operation": (["add", "subtract", "multiply", "divide", "power", "minimum", "maximum", 
                                  "modulo", "sine", "cosine", "smooth_min", "smooth_max"], {"default": "add"}),
                "wave_factor": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 2.0, "step": 0.05}),
                "reverse_phase": ("BOOLEAN", {"default": False}),
                "color1": ("STRING", {"default": "#000000"}),
                "color2": ("STRING", {"default": "#FFFFFF"}),
                "color_ramp_type": (["linear", "ease", "b_spline", "cardinal", "constant"], {"default": "linear"}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "generate_animated_pattern"
    CATEGORY = "Purz/Patterns/Animated"
    
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def smooth_noise(self, width, height, seed):
        """Generate smooth noise using nearest-neighbor sampling (no interpolation)"""
        np.random.seed(seed)
        low_res = 8
        low_width = max(1, width // low_res)
        low_height = max(1, height // low_res)
        
        low_noise = np.random.random((low_height, low_width))
        
        # Nearest-neighbor upscaling (no interpolation)
        noise = np.zeros((height, width))
        for y in range(height):
            for x in range(width):
                # Use nearest neighbor - no fractional coordinates
                lx = min((x * low_width) // width, low_width - 1)
                ly = min((y * low_height) // height, low_height - 1)
                
                noise[y, x] = low_noise[ly, lx]
        
        return noise
    
    def generate_animated_pattern(self, width, height, noise_type, intensity, seed, frame_count,
                                wave_type, wave_scale, wave_direction, wave_shape, math_operation, 
                                wave_factor, reverse_phase, color1, color2, color_ramp_type):
        result = []
        
        rgb1 = self.hex_to_rgb(color1)
        rgb2 = self.hex_to_rgb(color2)
        
        for frame in range(frame_count):
            current_seed = seed + frame * 10
            
            # Generate base noise pattern (0-1 texture)
            if noise_type == "random":
                np.random.seed(current_seed)
                base_pattern = np.random.random((height, width)) * intensity
            elif noise_type == "smooth":
                base_pattern = self.smooth_noise(width, height, current_seed) * intensity
            else:  # cloudy
                cloud = np.zeros((height, width))
                for octave in range(4):
                    scale = max(1, 2 ** octave)
                    octave_width = max(1, width // scale)
                    octave_height = max(1, height // scale)
                    octave_noise = self.smooth_noise(octave_width, octave_height, current_seed + octave * 7)
                    
                    # Nearest-neighbor upscaling (no interpolation)
                    temp = np.zeros((height, width))
                    for y in range(height):
                        for x in range(width):
                            src_y = min(y * octave_height // height, octave_height - 1)
                            src_x = min(x * octave_width // width, octave_width - 1)
                            temp[y, x] = octave_noise[src_y, src_x]
                    cloud += temp / (2 ** octave)
                base_pattern = cloud * intensity
            
            # Normalize base pattern to 0-1
            base_pattern = np.clip(base_pattern, 0, 1)
            
            # Calculate phase with high precision to avoid jitter
            if reverse_phase:
                phase = -2.0 * math.pi * float(frame) / float(frame_count)
            else:
                phase = 2.0 * math.pi * float(frame) / float(frame_count)
            
            # Generate wave texture (-1 to 1, then normalized to 0-1)
            wave_texture = WaveTextureGenerator.generate_wave_texture(
                width, height, wave_type, wave_scale, phase, wave_direction, wave_shape
            )
            # Normalize wave to 0-1 and apply factor
            wave_texture = (wave_texture + 1.0) * 0.5 * wave_factor
            
            # Apply mathematical operation between base pattern and wave texture
            combined_texture = TextureMath.apply_operation(
                base_pattern, wave_texture, math_operation, clamp=True
            )
            
            # Apply color ramp to convert grayscale texture to RGB
            img_np = ColorRamp.apply_color_ramp(combined_texture, rgb1, rgb2, color_ramp_type)
            
            img_tensor = torch.from_numpy(img_np.astype(np.float32))
            result.append(img_tensor)
        
        result = torch.stack(result)
        return (result,)


# Animated pattern node mappings
ANIMATED_NODE_CLASS_MAPPINGS = {
    "PurzAnimatedCheckerboard": AnimatedCheckerboardPattern,
    "PurzAnimatedStripes": AnimatedStripesPattern,
    "PurzAnimatedPolkaDots": AnimatedPolkaDotPattern,
    "PurzAnimatedNoise": AnimatedNoisePattern,
}

ANIMATED_NODE_DISPLAY_NAME_MAPPINGS = {
    "PurzAnimatedCheckerboard": "Animated Checkerboard (Purz)",
    "PurzAnimatedStripes": "Animated Stripes (Purz)",
    "PurzAnimatedPolkaDots": "Animated Polka Dots (Purz)",
    "PurzAnimatedNoise": "Animated Noise (Purz)",
}