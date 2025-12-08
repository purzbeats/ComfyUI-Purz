"""
ComfyUI-Purz Pattern Generators - V3 Schema
Modernized node definitions using the V3 API with proper slider UI elements.
"""

import torch
import numpy as np
import math
from PIL import Image, ImageDraw

from comfy_api.latest import io

# Use slider display for numeric inputs
SLIDER = io.NumberDisplay.slider


def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


class CheckerboardPattern(io.ComfyNode):
    """Generate a checkerboard pattern."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzCheckerboardPattern",
            display_name="Checkerboard Pattern (Purz)",
            category="Purz/Patterns/Basic",
            description="Generate a checkerboard pattern with customizable colors and size",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("square_size", default=32, min=8, max=256, step=8, display_mode=SLIDER),
                io.String.Input("color1", default="#FFFFFF"),
                io.String.Input("color2", default="#000000"),
                io.Int.Input("batch_size", default=1, min=1, max=16, step=1, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, width, height, square_size, color1, color2, batch_size) -> io.NodeOutput:
        result = []
        rgb1 = hex_to_rgb(color1)
        rgb2 = hex_to_rgb(color2)

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
        return io.NodeOutput(result)


class StripesPattern(io.ComfyNode):
    """Generate various stripe patterns."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzStripesPattern",
            display_name="Stripes Pattern (Purz)",
            category="Purz/Patterns/Basic",
            description="Generate horizontal, vertical, or diagonal stripe patterns",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("stripe_width", default=20, min=1, max=256, step=1, display_mode=SLIDER),
                io.Combo.Input("direction", options=["horizontal", "vertical", "diagonal_right", "diagonal_left"], default="vertical"),
                io.String.Input("color1", default="#FFFFFF"),
                io.String.Input("color2", default="#000000"),
                io.Int.Input("batch_size", default=1, min=1, max=16, step=1, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, width, height, stripe_width, direction, color1, color2, batch_size) -> io.NodeOutput:
        result = []
        rgb1 = hex_to_rgb(color1)
        rgb2 = hex_to_rgb(color2)

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
                for i in range(-height, width, stripe_width * 2):
                    points = [(i, 0), (i + stripe_width, 0),
                             (i + stripe_width + height, height), (i + height, height)]
                    draw.polygon(points, fill=rgb1)
                    points2 = [(i + stripe_width, 0), (i + stripe_width * 2, 0),
                              (i + stripe_width * 2 + height, height), (i + stripe_width + height, height)]
                    draw.polygon(points2, fill=rgb2)

            else:  # diagonal_left
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
        return io.NodeOutput(result)


class PolkaDotPattern(io.ComfyNode):
    """Generate polka dot patterns."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzPolkaDotPattern",
            display_name="Polka Dot Pattern (Purz)",
            category="Purz/Patterns/Basic",
            description="Generate polka dot patterns with optional staggering",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("dot_radius", default=10, min=2, max=100, step=1, display_mode=SLIDER),
                io.Int.Input("spacing", default=40, min=10, max=200, step=5, display_mode=SLIDER),
                io.String.Input("background_color", default="#FFFFFF"),
                io.String.Input("dot_color", default="#000000"),
                io.Boolean.Input("stagger", default=True),
                io.Int.Input("batch_size", default=1, min=1, max=16, step=1, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, width, height, dot_radius, spacing, background_color, dot_color, stagger, batch_size) -> io.NodeOutput:
        result = []
        bg_rgb = hex_to_rgb(background_color)
        dot_rgb = hex_to_rgb(dot_color)

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
        return io.NodeOutput(result)


class GridPattern(io.ComfyNode):
    """Generate grid patterns."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzGridPattern",
            display_name="Grid Pattern (Purz)",
            category="Purz/Patterns/Basic",
            description="Generate solid, dashed, or dotted grid patterns",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("grid_size", default=32, min=8, max=256, step=8, display_mode=SLIDER),
                io.Int.Input("line_width", default=2, min=1, max=20, step=1, display_mode=SLIDER),
                io.String.Input("background_color", default="#FFFFFF"),
                io.String.Input("line_color", default="#000000"),
                io.Combo.Input("style", options=["solid", "dashed", "dotted"], default="solid"),
                io.Int.Input("batch_size", default=1, min=1, max=16, step=1, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, width, height, grid_size, line_width, background_color, line_color, style, batch_size) -> io.NodeOutput:
        result = []
        bg_rgb = hex_to_rgb(background_color)
        line_rgb = hex_to_rgb(line_color)

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
        return io.NodeOutput(result)


class SimpleNoisePattern(io.ComfyNode):
    """Generate simple noise patterns using random values."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzSimpleNoisePattern",
            display_name="Simple Noise Pattern (Purz)",
            category="Purz/Patterns/Noise",
            description="Generate random, smooth, or cloudy noise patterns",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Combo.Input("noise_type", options=["random", "smooth", "cloudy"], default="smooth"),
                io.Float.Input("intensity", default=1.0, min=0.1, max=2.0, step=0.1, display_mode=SLIDER),
                io.Int.Input("seed", default=0, min=0, max=9999, step=1, display_mode=SLIDER),
                io.Boolean.Input("colored", default=False),
                io.Int.Input("batch_size", default=1, min=1, max=16, step=1, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def _smooth_noise(cls, width, height, seed):
        """Generate smooth noise using interpolation."""
        np.random.seed(seed)
        low_res = 8
        low_width = width // low_res
        low_height = height // low_res

        low_noise = np.random.random((low_height + 1, low_width + 1))

        try:
            from scipy.ndimage import zoom
            noise = zoom(low_noise, (height / low_height, width / low_width), order=1)
            return noise[:height, :width]
        except ImportError:
            # Fallback bilinear interpolation
            noise = np.zeros((height, width))
            for y in range(height):
                for x in range(width):
                    lx = (x * low_width) // width
                    ly = (y * low_height) // height
                    fx = ((x * low_width) % width) / width
                    fy = ((y * low_height) % height) / height

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

    @classmethod
    def execute(cls, width, height, noise_type, intensity, seed, colored, batch_size) -> io.NodeOutput:
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
                        channel_noise = cls._smooth_noise(width, height, current_seed + c * 33)
                        channels.append(channel_noise * intensity)
                    noise_array = np.stack(channels, axis=2)
                else:
                    noise_array = cls._smooth_noise(width, height, current_seed) * intensity
                    noise_array = np.stack([noise_array] * 3, axis=2)

            else:  # cloudy
                if colored:
                    channels = []
                    for c in range(3):
                        cloud = np.zeros((height, width))
                        for octave in range(4):
                            scale = 2 ** octave
                            octave_noise = cls._smooth_noise(width // scale, height // scale, current_seed + c * 33 + octave * 7)
                            if octave_noise.shape != (height, width):
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
                        octave_noise = cls._smooth_noise(width // scale, height // scale, current_seed + octave * 7)
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

            noise_array = np.clip(noise_array, 0, 1)
            img_tensor = torch.from_numpy(noise_array.astype(np.float32))
            result.append(img_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


class HexagonPattern(io.ComfyNode):
    """Generate hexagon/honeycomb patterns."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzHexagonPattern",
            display_name="Hexagon Pattern (Purz)",
            category="Purz/Patterns/Basic",
            description="Generate honeycomb hexagon patterns",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("hexagon_size", default=30, min=10, max=200, step=5, display_mode=SLIDER),
                io.Int.Input("line_width", default=2, min=0, max=10, step=1, display_mode=SLIDER),
                io.String.Input("background_color", default="#FFFFFF"),
                io.String.Input("hexagon_color", default="#FFFFFF"),
                io.String.Input("line_color", default="#000000"),
                io.Boolean.Input("filled", default=True),
                io.Int.Input("batch_size", default=1, min=1, max=16, step=1, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def _draw_hexagon(cls, draw, center_x, center_y, size, fill_color, line_color, line_width, filled):
        vertices = []
        for i in range(6):
            angle = math.pi / 3 * i
            x = center_x + size * math.cos(angle)
            y = center_y + size * math.sin(angle)
            vertices.append((x, y))

        if filled and fill_color:
            draw.polygon(vertices, fill=fill_color)

        if line_width > 0:
            for i in range(6):
                next_i = (i + 1) % 6
                draw.line([vertices[i], vertices[next_i]], fill=line_color, width=line_width)

    @classmethod
    def execute(cls, width, height, hexagon_size, line_width,
                background_color, hexagon_color, line_color, filled, batch_size) -> io.NodeOutput:
        result = []
        bg_rgb = hex_to_rgb(background_color)
        hex_rgb = hex_to_rgb(hexagon_color)
        line_rgb = hex_to_rgb(line_color)

        hex_height = hexagon_size * math.sqrt(3)

        for _ in range(batch_size):
            img = Image.new('RGB', (width, height), bg_rgb)
            draw = ImageDraw.Draw(img)

            row = 0
            y = hexagon_size
            while y < height + hexagon_size:
                x = hexagon_size
                if row % 2 == 1:
                    x += hexagon_size * 1.5

                while x < width + hexagon_size:
                    cls._draw_hexagon(draw, x, y, hexagon_size,
                                    hex_rgb if filled else None,
                                    line_rgb, line_width, filled)
                    x += hexagon_size * 3

                y += hex_height / 2
                row += 1

            img_np = np.array(img).astype(np.float32) / 255.0
            img_tensor = torch.from_numpy(img_np)
            result.append(img_tensor)

        result = torch.stack(result)
        return io.NodeOutput(result)


class GradientPattern(io.ComfyNode):
    """Generate gradient patterns."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="PurzGradientPattern",
            display_name="Gradient Pattern (Purz)",
            category="Purz/Patterns/Basic",
            description="Generate linear, radial, diagonal, or corner gradient patterns",
            inputs=[
                io.Int.Input("width", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Int.Input("height", default=512, min=64, max=4096, step=8, display_mode=SLIDER),
                io.Combo.Input("gradient_type", options=["linear", "radial", "diagonal", "corner"], default="linear"),
                io.Combo.Input("direction", options=["horizontal", "vertical"], default="horizontal"),
                io.String.Input("color1", default="#000000"),
                io.String.Input("color2", default="#FFFFFF"),
                io.Int.Input("batch_size", default=1, min=1, max=16, step=1, display_mode=SLIDER),
            ],
            outputs=[
                io.Image.Output(display_name="image"),
            ]
        )

    @classmethod
    def execute(cls, width, height, gradient_type, direction, color1, color2, batch_size) -> io.NodeOutput:
        result = []
        rgb1 = np.array(hex_to_rgb(color1)) / 255.0
        rgb2 = np.array(hex_to_rgb(color2)) / 255.0

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
        return io.NodeOutput(result)


# V3 Extension for Pattern Generators
from comfy_api.latest import ComfyExtension


class PurzPatternGeneratorsExtension(ComfyExtension):
    """V3 Extension containing all Purz pattern generator nodes."""

    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [
            CheckerboardPattern,
            StripesPattern,
            PolkaDotPattern,
            GridPattern,
            SimpleNoisePattern,
            HexagonPattern,
            GradientPattern,
        ]


async def comfy_entrypoint() -> PurzPatternGeneratorsExtension:
    """Entry point for the V3 extension system."""
    return PurzPatternGeneratorsExtension()
