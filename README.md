# ComfyUI-Purz

A comprehensive node pack for ComfyUI that provides powerful image effects, pattern generation, and animated pattern creation capabilities. Perfect for creating dynamic textures, visual effects, and animated sequences.

<img width="3573" height="2177" alt="Example Workflow" src="https://github.com/user-attachments/assets/b9c4c61d-f5f1-49fb-84a9-f47b2f2c9e4a" />

## 🚀 Features

### 🎛️ Interactive Image Filter (NEW!)
A powerful real-time image filter system with WebGL preview:
- **42 Filter Effects** across 8 categories
- **Layer-Based System** - Stack multiple effects with individual opacity
- **Real-Time Preview** - See changes instantly via WebGL shaders
- **Non-Destructive** - Adjust filters without re-running the workflow
- **Pipeline Output** - Filtered result outputs to the workflow for further processing
- **25 Built-in Presets** - Professional presets for Film, Portrait, Landscape, B&W, Mood, and Creative styles
- **Custom Presets** - Save and load your own effect combinations

**Filter Categories:**
- **Basic**: Desaturate, Brightness, Contrast, Exposure, Gamma, Vibrance, Saturation
- **Color**: Hue Shift, Temperature, Tint, Colorize, Channel Mixer
- **Tone**: Highlights, Shadows, Whites, Blacks, Levels, Curves
- **Detail**: Blur, Sharpen, Unsharp Mask, Clarity, Dehaze
- **Effects**: Vignette, Grain, Posterize, Threshold, Invert, Sepia, Duotone
- **Artistic**: Emboss, Edge Detect, Sketch, Oil Paint
- **Creative**: Pixelate, Chromatic Aberration, Glitch, Halftone
- **Lens**: Lens Distortion, Tilt Shift, Radial Blur

### 📸 Image Effects
Transform your images with professional-grade effects:
- **Black & White Conversion** - High-quality grayscale conversion using luminance weighting
- **Image Rotation** - Rotate images with customizable background colors and transparency support
- **Blur Effects** - Gaussian, box, and motion blur with adjustable intensity
- **Color Adjustments** - Fine-tune brightness, contrast, and saturation
- **Image Flipping** - Horizontal, vertical, and combined flipping options
- **Pixelate Effect** - Create retro-style pixelated images
- **Edge Detection** - Sobel, Canny, and Laplacian edge detection algorithms

### 🎨 Pattern Generation
Create stunning patterns from scratch:
- **Checkerboard** - Classic checkerboard patterns with customizable colors and square sizes
- **Stripes** - Horizontal, vertical, and diagonal stripe patterns
- **Polka Dots** - Circular dot patterns with staggered and regular arrangements
- **Grid Patterns** - Solid, dashed, and dotted grid overlays
- **Noise Patterns** - Random, smooth, and cloudy noise generation
- **Gradients** - Linear, radial, diagonal, and corner gradients

### ✨ Animated Patterns
Bring your patterns to life with mathematical precision:
- **Animated Checkerboards** - Dynamic checkerboard patterns with wave modulation
- **Animated Stripes** - Moving stripe patterns with various wave effects
- **Animated Polka Dots** - Pulsating and morphing dot patterns
- **Animated Noise** - Evolving noise patterns with temporal coherence

## 📦 Installation

1. Navigate to your ComfyUI custom nodes directory:
   ```bash
   cd ComfyUI/custom_nodes/
   ```

2. Clone this repository:
   ```bash
   git clone https://github.com/purzbeats/ComfyUI-Purz.git
   ```

3. Install dependencies:
   ```bash
   cd ComfyUI-Purz
   pip install -r requirements.txt
   ```

4. Restart ComfyUI

## 🎯 Node Categories

### Purz/Interactive
- **Interactive Filter** - Real-time layer-based image filter with 42 effects and WebGL preview

### Purz/Image/Color
- **Image to Black & White** - Convert color images to grayscale
- **Color Adjust** - Adjust brightness, contrast, and saturation

### Purz/Image/Transform
- **Rotate Image** - Rotate images with background options
- **Flip/Mirror Image** - Flip images horizontally, vertically, or both

### Purz/Image/Effects
- **Blur Image** - Apply various blur effects
- **Pixelate Effect** - Create pixelated effects
- **Edge Detection** - Detect edges using multiple algorithms

### Purz/Patterns/Basic
- **Checkerboard Pattern** - Generate checkerboard patterns
- **Stripes Pattern** - Create stripe patterns in multiple directions
- **Polka Dot Pattern** - Generate polka dot patterns
- **Grid Pattern** - Create grid overlays
- **Gradient Pattern** - Generate gradient fills

### Purz/Patterns/Noise
- **Simple Noise Pattern** - Generate various noise types

### Purz/Patterns/Animated
- **Animated Checkerboard** - Dynamic checkerboard with wave modulation
- **Animated Stripes** - Moving stripe patterns
- **Animated Polka Dots** - Animated dot patterns
- **Animated Noise** - Temporal noise patterns

## 🔧 Advanced Features

### Mathematical Operations
The animated pattern nodes support advanced mathematical operations for texture combination:
- **Basic Operations**: Add, Subtract, Multiply, Divide
- **Comparison**: Minimum, Maximum, Greater Than, Less Than
- **Trigonometric**: Sine, Cosine, Tangent
- **Advanced**: Power, Modulo, Smooth Min/Max

### Wave Generation
Multiple wave types and shapes for animation:
- **Wave Types**: Sine, Cosine, Square, Triangle, Sawtooth
- **Directions**: Horizontal, Vertical, Diagonal, Radial
- **Shapes**: Sine, Square, Triangle wave shaping

### Color Ramp Interpolation
Professional color interpolation methods:
- **Linear** - Standard linear interpolation
- **Ease** - Smooth step interpolation
- **B-Spline** - Smooth B-spline curves
- **Cardinal** - Cardinal spline interpolation
- **Constant** - Hard transitions

## 💡 Usage Tips

1. **Batch Processing**: Most nodes support batch processing for multiple images
2. **Color Formats**: Use hex color codes (e.g., #FF0000 for red) in pattern generators
3. **Animation**: Set frame_count to create image sequences for video generation
4. **Performance**: Lower resolution patterns render faster - upscale if needed
5. **Experimentation**: Try different mathematical operations for unique effects

## 💾 Custom Presets

When you save custom presets in the Interactive Image Filter, they are stored as JSON files in:
```
ComfyUI/custom_nodes/ComfyUI-Purz/presets/
```

**Important:** If you uninstall or update this node pack, your custom presets may be deleted. Back up the `presets/` folder before uninstalling to preserve your saved presets.

## 🛠️ Requirements

- ComfyUI
- PyTorch
- NumPy
- PIL (Pillow)
- OpenCV (cv2)

## 📝 License

This project is open source. Feel free to use, modify, and distribute according to your needs.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bug reports and feature requests.

## 📞 Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.

## 📋 Changelog

### v1.2.0 (2025-12-08)
- **NEW: Preset System** for Interactive Image Filter
  - 25 built-in professional presets across 6 categories (Film, Portrait, Landscape, Black & White, Mood, Creative)
  - Save custom presets as JSON files in the `presets/` folder
  - Load presets instantly via dropdown menu
  - Presets are portable and can be shared between installations

### v1.1.0 (2025-12-07)
- **NEW: Interactive Image Filter** - A powerful layer-based real-time filter system
  - 42 filter effects across 8 categories (Basic, Color, Tone, Detail, Effects, Artistic, Creative, Lens)
  - Real-time WebGL preview - see changes instantly without re-running workflow
  - Layer system with per-layer opacity control
  - Stack multiple effects for complex adjustments
  - Filtered output pipes directly into workflow for further processing
  - Save button to export filtered images directly to output folder

### v1.0.1
- Initial release with image effects, pattern generation, and animated patterns
