"""
ComfyUI-Purz Animated Patterns - V3 Schema
Modernized node definitions using the V3 API with proper slider UI elements.
"""

import torch
import numpy as np
import math

from comfy_api.latest import io

# Use slider display for numeric inputs
SLIDER = io.NumberDisplay.slider


def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


class TextureMath:
    """Mathematical operations for combining textures, like Blender's Math node."""

    @staticmethod
    def apply_operation(texture1, texture2, operation, clamp=True):
        if operation == "add":
            result = texture1 + texture2
        elif operation == "subtract":
            result = texture1 - texture2
        elif operation == "multiply":
            result = texture1 * texture2
        elif operation == "divide":
            result = np.divide(texture1, texture2, out=np.zeros_like(texture1), where=texture2!=0)
        elif operation == "power":
            result = np.power(np.abs(texture1), texture2)
        elif operation == "minimum":
            result = np.minimum(texture1, texture2)
        elif operation == "maximum":
            result = np.maximum(texture1, texture2)
        elif operation == "modulo":
            result = np.mod(texture1, np.where(texture2 == 0, 1, texture2))
        elif operation == "sine":
            result = np.sin(texture1 + texture2)
        elif operation == "cosine":
            result = np.cos(texture1 + texture2)
        elif operation == "smooth_min":
            k = 0.1
            h = np.maximum(k - np.abs(texture1 - texture2), 0) / k
            result = np.minimum(texture1, texture2) - h * h * k * 0.25
        elif operation == "smooth_max":
            k = 0.1
            h = np.maximum(k - np.abs(texture1 - texture2), 0) / k
            result = np.maximum(texture1, texture2) + h * h * k * 0.25
        else:
            result = texture1 + texture2

        if clamp:
            result = np.clip(result, 0.0, 1.0)
        return result


class ColorRamp:
    """Color ramp functionality like Blender's ColorRamp node."""

    @staticmethod
    def apply_color_ramp(texture, color1, color2, ramp_type="linear"):
        height, width = texture.shape
        result = np.zeros((height, width, 3))

        color1 = np.array(color1) / 255.0
        color2 = np.array(color2) / 255.0

        if ramp_type == "linear":
            for c in range(3):
                result[:, :, c] = color1[c] * (1 - texture) + color2[c] * texture
        elif ramp_type == "ease":
            smooth_texture = texture * texture * (3.0 - 2.0 * texture)
            for c in range(3):
                result[:, :, c] = color1[c] * (1 - smooth_texture) + color2[c] * smooth_texture
        elif ramp_type == "b_spline":
            t = texture
            smooth_texture = t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
            for c in range(3):
                result[:, :, c] = color1[c] * (1 - smooth_texture) + color2[c] * smooth_texture
        elif ramp_type == "cardinal":
            t = texture
            smooth_texture = t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
            for c in range(3):
                result[:, :, c] = color1[c] * (1 - smooth_texture) + color2[c] * smooth_texture
        elif ramp_type == "constant":
            for c in range(3):
                result[:, :, c] = np.where(texture < 0.5, color1[c], color2[c])

        return result


class WaveTextureGenerator:
    """Helper class for generating wave textures as mathematical values."""

    @staticmethod
    def generate_wave_texture(width, height, wave_type, scale, phase, direction="horizontal", shape="sine"):
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
        if wave_type == "sine":
            base_wave = math.sin(value)
        elif wave_type == "cosine":
            base_wave = math.cos(value)
        elif wave_type == "square":
            base_wave = 1.0 if (value % (2 * math.pi)) < math.pi else -1.0
        elif wave_type == "triangle":
            normalized = (value % (2 * math.pi)) / (2 * math.pi)
            base_wave = 4 * normalized - 1 if normalized < 0.5 else 3 - 4 * normalized
        elif wave_type == "sawtooth":
            base_wave = 2 * ((value % (2 * math.pi)) / (2 * math.pi)) - 1
        else:
            base_wave = math.sin(value)

        if shape == "square":
            return 1.0 if base_wave > 0 else -1.0
        elif shape == "triangle":
            return math.copysign(abs(base_wave) ** 0.5, base_wave)
        return base_wave


class PatternTextureGenerator:
    """Generate base pattern textures as mathematical values (0-1)."""

    @staticmethod
    def generate_checkerboard(width, height, square_size):
        pattern = np.zeros((height, width))
        for y in range(height):
            for x in range(width):
                if ((x // square_size) + (y // square_size)) % 2 == 0:
                    pattern[y, x] = 1.0
        return pattern

    @staticmethod
    def generate_stripes(width, height, stripe_width, direction):
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
        else:
            for y in range(height):
                for x in range(width):
                    pattern[y, x] = 1.0 if ((x - y) // stripe_width) % 2 == 0 else 0.0

        return pattern

    @staticmethod
    def generate_polka_dots(width, height, dot_radius, spacing, stagger):
        pattern = np.zeros((height, width))

        y = spacing // 2
        row = 0
        while y < height:
            x = spacing // 2
            if stagger and row % 2 == 1:
                x += spacing // 2

            while x < width:
                for py in range(max(0, y - dot_radius), min(height, y + dot_radius + 1)):
                    for px in range(max(0, x - dot_radius), min(width, x + dot_radius + 1)):
                        if (px - x)**2 + (py - y)**2 <= dot_radius**2:
                            pattern[py, px] = 1.0
                x += spacing

            y += spacing
            row += 1

        return pattern


# Common options for animated pattern nodes
WAVE_TYPES = ["sine", "cosine", "square", "triangle", "sawtooth"]
WAVE_DIRECTIONS = ["horizontal", "vertical", "diagonal", "radial"]
WAVE_SHAPES = ["sine", "square", "triangle"]
MATH_OPERATIONS = ["add", "subtract", "multiply", "divide", "power", "minimum", "maximum",
                   "modulo", "sine", "cosine", "smooth_min", "smooth_max"]
COLOR_RAMP_TYPES = ["linear", "ease", "b_spline", "cardinal", "constant"]


class AnimatedCheckerboardPattern(io.ComfyNode):
    """Generate animated checkerboard pattern with mathematical wave texture combination."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzAnimatedCheckerboard",
            display_name="Animated Checkerboard (Purz)",
            category="Purz/Patterns/Animated",
            description="Generate animated checkerboard with wave modulation",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("square_size", default=32, min=8, max=256, step=8, display_mode=SLIDER),
                io.String.Input("color1", default="#FFFFFF"),
                io.String.Input("color2", default="#000000"),
                io.Int.Input("frame_count", default=30, min=1, max=300, step=1, display_mode=SLIDER),
                io.Combo.Input("wave_type", options=WAVE_TYPES, default="sine"),
                io.Float.Input("wave_scale", default=0.1, min=0.01, max=1.0, step=0.01, display_mode=SLIDER),
                io.Combo.Input("wave_direction", options=WAVE_DIRECTIONS, default="horizontal"),
                io.Combo.Input("wave_shape", options=WAVE_SHAPES, default="sine"),
                io.Combo.Input("math_operation", options=MATH_OPERATIONS, default="add"),
                io.Float.Input("wave_factor", default=0.5, min=0.0, max=2.0, step=0.05, display_mode=SLIDER),
                io.Boolean.Input("reverse_phase", default=False),
                io.Combo.Input("color_ramp_type", options=COLOR_RAMP_TYPES, default="linear"),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, width, height, square_size, color1, color2, frame_count,
                wave_type, wave_scale, wave_direction, wave_shape, math_operation,
                wave_factor, reverse_phase, color_ramp_type) -> io.NodeOutput:
        result = []
        rgb1 = hex_to_rgb(color1)
        rgb2 = hex_to_rgb(color2)

        base_pattern = PatternTextureGenerator.generate_checkerboard(width, height, square_size)

        for frame in range(frame_count):
            phase = -2 * math.pi * frame / frame_count if reverse_phase else 2 * math.pi * frame / frame_count

            wave_texture = WaveTextureGenerator.generate_wave_texture(
                width, height, wave_type, wave_scale, phase, wave_direction, wave_shape
            )
            wave_texture = (wave_texture + 1) / 2 * wave_factor

            combined_texture = TextureMath.apply_operation(base_pattern, wave_texture, math_operation, clamp=True)
            img_np = ColorRamp.apply_color_ramp(combined_texture, rgb1, rgb2, color_ramp_type)

            img_tensor = torch.from_numpy(img_np.astype(np.float32))
            result.append(img_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


class AnimatedStripesPattern(io.ComfyNode):
    """Generate animated stripes pattern with mathematical wave texture combination."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzAnimatedStripes",
            display_name="Animated Stripes (Purz)",
            category="Purz/Patterns/Animated",
            description="Generate animated stripes with wave modulation",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("stripe_width", default=20, min=1, max=256, step=1, display_mode=SLIDER),
                io.Combo.Input("direction", options=["horizontal", "vertical", "diagonal_right", "diagonal_left"], default="vertical"),
                io.String.Input("color1", default="#FFFFFF"),
                io.String.Input("color2", default="#000000"),
                io.Int.Input("frame_count", default=30, min=1, max=300, step=1, display_mode=SLIDER),
                io.Combo.Input("wave_type", options=WAVE_TYPES, default="sine"),
                io.Float.Input("wave_scale", default=0.1, min=0.01, max=1.0, step=0.01, display_mode=SLIDER),
                io.Combo.Input("wave_direction", options=WAVE_DIRECTIONS, default="horizontal"),
                io.Combo.Input("wave_shape", options=WAVE_SHAPES, default="sine"),
                io.Combo.Input("math_operation", options=MATH_OPERATIONS, default="add"),
                io.Float.Input("wave_factor", default=0.5, min=0.0, max=2.0, step=0.05, display_mode=SLIDER),
                io.Boolean.Input("reverse_phase", default=False),
                io.Combo.Input("color_ramp_type", options=COLOR_RAMP_TYPES, default="linear"),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, width, height, stripe_width, direction, color1, color2, frame_count,
                wave_type, wave_scale, wave_direction, wave_shape, math_operation,
                wave_factor, reverse_phase, color_ramp_type) -> io.NodeOutput:
        result = []
        rgb1 = hex_to_rgb(color1)
        rgb2 = hex_to_rgb(color2)

        base_pattern = PatternTextureGenerator.generate_stripes(width, height, stripe_width, direction)

        for frame in range(frame_count):
            phase = -2.0 * math.pi * float(frame) / float(frame_count) if reverse_phase else 2.0 * math.pi * float(frame) / float(frame_count)

            wave_texture = WaveTextureGenerator.generate_wave_texture(
                width, height, wave_type, wave_scale, phase, wave_direction, wave_shape
            )
            wave_texture = (wave_texture + 1.0) * 0.5 * wave_factor

            combined_texture = TextureMath.apply_operation(base_pattern, wave_texture, math_operation, clamp=True)
            img_np = ColorRamp.apply_color_ramp(combined_texture, rgb1, rgb2, color_ramp_type)

            img_tensor = torch.from_numpy(img_np.astype(np.float32))
            result.append(img_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


class AnimatedPolkaDotPattern(io.ComfyNode):
    """Generate animated polka dot pattern with mathematical wave texture combination."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzAnimatedPolkaDots",
            display_name="Animated Polka Dots (Purz)",
            category="Purz/Patterns/Animated",
            description="Generate animated polka dots with wave modulation",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("dot_radius", default=10, min=2, max=100, step=1, display_mode=SLIDER),
                io.Int.Input("spacing", default=40, min=10, max=200, step=5, display_mode=SLIDER),
                io.String.Input("background_color", default="#FFFFFF"),
                io.String.Input("dot_color", default="#000000"),
                io.Boolean.Input("stagger", default=True),
                io.Int.Input("frame_count", default=30, min=1, max=300, step=1, display_mode=SLIDER),
                io.Combo.Input("wave_type", options=WAVE_TYPES, default="sine"),
                io.Float.Input("wave_scale", default=0.1, min=0.01, max=1.0, step=0.01, display_mode=SLIDER),
                io.Combo.Input("wave_direction", options=WAVE_DIRECTIONS, default="radial"),
                io.Combo.Input("wave_shape", options=WAVE_SHAPES, default="sine"),
                io.Combo.Input("math_operation", options=MATH_OPERATIONS, default="add"),
                io.Float.Input("wave_factor", default=0.5, min=0.0, max=2.0, step=0.05, display_mode=SLIDER),
                io.Boolean.Input("reverse_phase", default=False),
                io.Combo.Input("color_ramp_type", options=COLOR_RAMP_TYPES, default="linear"),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, width, height, dot_radius, spacing, background_color, dot_color,
                stagger, frame_count, wave_type, wave_scale, wave_direction, wave_shape,
                math_operation, wave_factor, reverse_phase, color_ramp_type) -> io.NodeOutput:
        result = []
        bg_rgb = hex_to_rgb(background_color)
        dot_rgb = hex_to_rgb(dot_color)

        base_pattern = PatternTextureGenerator.generate_polka_dots(width, height, dot_radius, spacing, stagger)

        for frame in range(frame_count):
            phase = -2.0 * math.pi * float(frame) / float(frame_count) if reverse_phase else 2.0 * math.pi * float(frame) / float(frame_count)

            wave_texture = WaveTextureGenerator.generate_wave_texture(
                width, height, wave_type, wave_scale, phase, wave_direction, wave_shape
            )
            wave_texture = (wave_texture + 1.0) * 0.5 * wave_factor

            combined_texture = TextureMath.apply_operation(base_pattern, wave_texture, math_operation, clamp=True)
            img_np = ColorRamp.apply_color_ramp(combined_texture, bg_rgb, dot_rgb, color_ramp_type)

            img_tensor = torch.from_numpy(img_np.astype(np.float32))
            result.append(img_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


class AnimatedNoisePattern(io.ComfyNode):
    """Generate animated noise pattern with mathematical wave texture combination."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzAnimatedNoise",
            display_name="Animated Noise (Purz)",
            category="Purz/Patterns/Animated",
            description="Generate animated noise with wave modulation",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Combo.Input("noise_type", options=["random", "smooth", "cloudy"], default="smooth"),
                io.Float.Input("intensity", default=1.0, min=0.1, max=2.0, step=0.1, display_mode=SLIDER),
                io.Int.Input("seed", default=0, min=0, max=9999, step=1, display_mode=SLIDER),
                io.Int.Input("frame_count", default=30, min=1, max=300, step=1, display_mode=SLIDER),
                io.Combo.Input("wave_type", options=WAVE_TYPES, default="sine"),
                io.Float.Input("wave_scale", default=0.1, min=0.01, max=1.0, step=0.01, display_mode=SLIDER),
                io.Combo.Input("wave_direction", options=WAVE_DIRECTIONS, default="radial"),
                io.Combo.Input("wave_shape", options=WAVE_SHAPES, default="sine"),
                io.Combo.Input("math_operation", options=MATH_OPERATIONS, default="add"),
                io.Float.Input("wave_factor", default=0.5, min=0.0, max=2.0, step=0.05, display_mode=SLIDER),
                io.Boolean.Input("reverse_phase", default=False),
                io.String.Input("color1", default="#000000"),
                io.String.Input("color2", default="#FFFFFF"),
                io.Combo.Input("color_ramp_type", options=COLOR_RAMP_TYPES, default="linear"),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def _smooth_noise(cls, width, height, seed):
        """Generate smooth noise using nearest-neighbor sampling."""
        np.random.seed(seed)
        low_res = 8
        low_width = max(1, width // low_res)
        low_height = max(1, height // low_res)

        low_noise = np.random.random((low_height, low_width))

        noise = np.zeros((height, width))
        for y in range(height):
            for x in range(width):
                lx = min((x * low_width) // width, low_width - 1)
                ly = min((y * low_height) // height, low_height - 1)
                noise[y, x] = low_noise[ly, lx]

        return noise

    @classmethod
    def execute(cls, width, height, noise_type, intensity, seed, frame_count,
                wave_type, wave_scale, wave_direction, wave_shape, math_operation,
                wave_factor, reverse_phase, color1, color2, color_ramp_type) -> io.NodeOutput:
        result = []
        rgb1 = hex_to_rgb(color1)
        rgb2 = hex_to_rgb(color2)

        for frame in range(frame_count):
            current_seed = seed + frame * 10

            if noise_type == "random":
                np.random.seed(current_seed)
                base_pattern = np.random.random((height, width)) * intensity
            elif noise_type == "smooth":
                base_pattern = cls._smooth_noise(width, height, current_seed) * intensity
            else:  # cloudy
                cloud = np.zeros((height, width))
                for octave in range(4):
                    scale = max(1, 2 ** octave)
                    octave_width = max(1, width // scale)
                    octave_height = max(1, height // scale)
                    octave_noise = cls._smooth_noise(octave_width, octave_height, current_seed + octave * 7)

                    temp = np.zeros((height, width))
                    for y in range(height):
                        for x in range(width):
                            src_y = min(y * octave_height // height, octave_height - 1)
                            src_x = min(x * octave_width // width, octave_width - 1)
                            temp[y, x] = octave_noise[src_y, src_x]
                    cloud += temp / (2 ** octave)
                base_pattern = cloud * intensity

            base_pattern = np.clip(base_pattern, 0, 1)

            phase = -2.0 * math.pi * float(frame) / float(frame_count) if reverse_phase else 2.0 * math.pi * float(frame) / float(frame_count)

            wave_texture = WaveTextureGenerator.generate_wave_texture(
                width, height, wave_type, wave_scale, phase, wave_direction, wave_shape
            )
            wave_texture = (wave_texture + 1.0) * 0.5 * wave_factor

            combined_texture = TextureMath.apply_operation(base_pattern, wave_texture, math_operation, clamp=True)
            img_np = ColorRamp.apply_color_ramp(combined_texture, rgb1, rgb2, color_ramp_type)

            img_tensor = torch.from_numpy(img_np.astype(np.float32))
            result.append(img_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


# V3 Extension for Animated Patterns
from comfy_api.latest import ComfyExtension


class PurzAnimatedPatternsExtension(ComfyExtension):
    """V3 Extension containing all Purz animated pattern nodes."""

    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [
            AnimatedCheckerboardPattern,
            AnimatedStripesPattern,
            AnimatedPolkaDotPattern,
            AnimatedNoisePattern,
        ]


async def comfy_entrypoint() -> PurzAnimatedPatternsExtension:
    """Entry point for the V3 extension system."""
    return PurzAnimatedPatternsExtension()
