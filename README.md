# ComfyUI-Purz

A comprehensive node pack for ComfyUI that provides powerful image effects, pattern generation, and animated pattern creation capabilities. Perfect for creating dynamic textures, visual effects, and animated sequences.

<img width="3573" height="2177" alt="Example Workflow" src="https://github.com/user-attachments/assets/b9c4c61d-f5f1-49fb-84a9-f47b2f2c9e4a" />

## 🎚️ V3 Schema with Slider UI (NEW in v1.6.0!)

All nodes now support ComfyUI's V3 schema with **slider widgets** for numeric inputs - providing a much better user experience than the default number pickers with increment buttons.

**V3 Features:**
- **Slider Controls** - All numeric parameters use intuitive slider widgets
- **Auto-Detection** - Automatically uses V3 when available, falls back to V1 for older ComfyUI versions
- **Animated Grain** - New checkbox toggle for the Grain effect to enable animated film grain
- **Live Animation Preview** - Effects with animation capabilities preview in real-time

## 🎬 Video Batch Processing

**Apply real-time WebGL filters to entire video sequences!** The Interactive Image Filter now fully supports batch processing, making it perfect for video workflows:

### How It Works
1. **Load your video** - Use any video loader node (like VHS) to load frames into ComfyUI
2. **Connect to Interactive Filter** - Pipe your image batch into the Interactive Image Filter node
3. **Preview & adjust** - Use the built-in playback controls to scrub through your video while adjusting filters in real-time
4. **Run the workflow** - When you execute, all frames are automatically processed through WebGL and output as a filtered batch
5. **Combine with video output** - Connect the output to any video combiner node to export your filtered video

### Video Features
- **Frame Playback** - Built-in play/pause and frame scrubber to preview your video
- **Adjustable FPS** - Choose playback speed (6, 8, 12, 16, 24, 30, 48, 60 fps)
- **Live Preview** - See filter effects applied in real-time as you scrub through frames
- **Automatic Processing** - Backend waits for WebGL processing to complete before outputting
- **Chunked Upload** - Large batches are uploaded efficiently in chunks to handle any video length

## 🚀 Features

### 🎛️ Interactive Image Filter
A powerful real-time image filter system with WebGL preview:
- **120+ Filter Effects** across 8 categories
- **Layer-Based System** - Stack multiple effects with individual opacity
- **Drag & Drop Reordering** - Easily rearrange effect layers
- **Real-Time Preview** - See changes instantly via WebGL shaders
- **Non-Destructive** - Adjust filters without re-running the workflow
- **Pipeline Output** - Filtered result outputs to the workflow for further processing
- **Video Batch Support** - Process entire video sequences with playback preview
- **40+ Built-in Presets** - Professional presets for Film, Portrait, Landscape, B&W, Mood, Creative, Cinematic, Vintage, Stylized, and Enhancement styles
- **Custom Presets** - Save and load your own effect combinations

**Filter Categories:**
- **Basic** (16): Desaturate, Brightness, Contrast, Exposure, Gamma, Vibrance, Saturation, Lift, Gain, Offset, Auto Contrast, Normalize, Equalize, Solarize, Fade, Cross Process
- **Color** (15): Hue Shift, Temperature, Tint, Colorize, Channel Mixer, Split Tone, Color Balance, Selective Color, HSL Adjust, Gradient Map, Color Lookup, Vibrance Pro, RGB Curves, CMYK Adjust, Color Harmony
- **Tone** (16): Highlights, Shadows, Whites, Blacks, Levels, Curves, Tone Curve, HDR Tone, Shadow Recovery, Highlight Recovery, Midtone Contrast, Luminosity Mask, Zone System, Dynamic Range, Tone Split, Local Contrast
- **Detail** (15): Blur, Sharpen, Unsharp Mask, Clarity, Dehaze, High Pass, Low Pass, Bilateral Filter, Surface Blur, Smart Sharpen, Micro Contrast, Texture Enhance, Noise Reduction, Detail Extract, Frequency Separation
- **Effects** (17): Vignette, Grain, Posterize, Threshold, Invert, Sepia, Duotone, Light Leak, Lens Flare, Bokeh, Film Burn, Scratch, Dust, Water Droplets, Frosted Glass, Heat Distortion, CRT Scanlines
- **Artistic** (14): Emboss, Edge Detect, Sketch, Oil Paint, Watercolor, Pencil Sketch, Charcoal, Woodcut, Linocut, Pop Art, Comic Book, Stained Glass, Mosaic, Pointillism
- **Creative** (14): Pixelate, Chromatic Aberration, Glitch, Halftone, Mirror, Kaleidoscope, Tunnel, Ripple, Wave Distortion, Twirl, Spherize, Pinch, Stretch, Fisheye
- **Lens** (13): Lens Distortion, Tilt Shift, Radial Blur, Depth of Field, Focus Stack, Miniature, Anamorphic, Barrel Distortion, Pincushion, Mustache Distortion, CA Red/Cyan, CA Blue/Yellow, Lens Vignette

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
- **Interactive Filter** - Real-time layer-based image filter with 42 effects, WebGL preview, and video batch support

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

1. **Video Workflows**: Load video with VHS or similar, connect to Interactive Filter, preview with playback controls, then output to video combiner
2. **Batch Processing**: All nodes support batch processing for multiple images and video frames
3. **Color Formats**: Use hex color codes (e.g., #FF0000 for red) in pattern generators
4. **Animation**: Set frame_count to create image sequences for video generation
5. **Performance**: Lower resolution patterns render faster - upscale if needed
6. **Experimentation**: Try different mathematical operations for unique effects

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

## 🗺️ Roadmap

Future plans for ComfyUI-Purz:

- [x] **Custom WebGL Effects** - Break out Interactive Image Filter effects into separate shader files, allowing users to create and share their own custom WebGL effects
- [x] **More Effects** - Expanded to 120+ effects with 80 new shader effects in v1.5.0
- [x] **More Presets** - Added 16 new presets (Cinematic, Vintage, Stylized, Enhancement)
- [x] **Layer Reordering** - Drag and drop to re-arrange effect layers
- [ ] **Mask Support** - Apply filter effects selectively using masks

### Creating Custom Effects

You can create your own WebGL filter effects:

1. Copy `shaders/custom/_template.glsl` to a new file like `shaders/custom/myeffect.glsl`
2. Edit the shader code (WebGL 1.0 GLSL)
3. Optionally create `shaders/custom/myeffect.json` for custom parameters:
   ```json
   {
     "name": "My Effect",
     "category": "Custom",
     "params": [
       { "name": "amount", "label": "Amount", "min": 0, "max": 1, "default": 0.5, "step": 0.01 }
     ]
   }
   ```
4. Restart ComfyUI - your effect will appear in the dropdown

## 📋 Changelog

### v1.6.0 (2025-12-08)
- **V3 Schema Support** - All nodes now use ComfyUI V3 schema with slider widgets for better UX
  - Slider controls for all numeric inputs (brightness, contrast, angles, sizes, etc.)
  - Auto-detects V3 API availability, falls back to V1 for older ComfyUI
  - New V3 files: `image_effects_v3.py`, `pattern_generators_v3.py`, `animated_patterns_v3.py`, `interactive_filters_v3.py`
- **Animated Grain** - New checkbox toggle to enable animated film grain effect
- **Live Animation Preview** - Effects with animation now preview continuously in real-time
- **Fixed** - Single image processing now works correctly

### v1.5.0 (2025-12-08)
- **80 New Shader Effects** - Massive expansion to 120+ total effects
  - Basic: Lift, Gain, Offset, Auto Contrast, Normalize, Equalize, Solarize, Fade, Cross Process
  - Color: Split Tone, Color Balance, Selective Color, HSL Adjust, Gradient Map, Color Lookup, Vibrance Pro, RGB Curves, CMYK Adjust, Color Harmony
  - Tone: Tone Curve, HDR Tone, Shadow Recovery, Highlight Recovery, Midtone Contrast, Luminosity Mask, Zone System, Dynamic Range, Tone Split, Local Contrast
  - Detail: High Pass, Low Pass, Bilateral Filter, Surface Blur, Smart Sharpen, Micro Contrast, Texture Enhance, Noise Reduction, Detail Extract, Frequency Separation
  - Effects: Light Leak, Lens Flare, Bokeh, Film Burn, Scratch, Dust, Water Droplets, Frosted Glass, Heat Distortion, CRT Scanlines
  - Artistic: Watercolor, Pencil Sketch, Charcoal, Woodcut, Linocut, Pop Art, Comic Book, Stained Glass, Mosaic, Pointillism
  - Creative: Mirror, Kaleidoscope, Tunnel, Ripple, Wave Distortion, Twirl, Spherize, Pinch, Stretch, Fisheye
  - Lens: Depth of Field, Focus Stack, Miniature, Anamorphic, Barrel Distortion, Pincushion, Mustache Distortion, CA Red/Cyan, CA Blue/Yellow, Lens Vignette
- **16 New Presets** - Cinematic (Blockbuster, Noir, Sci-Fi, Horror), Vintage (Kodachrome, Polaroid, 70s, Daguerreotype), Stylized (Neon Nights, Anime, Watercolor Dream, Comic), Enhancement (Portrait Pro, Landscape HDR, Detail Pop, Auto Fix)
- **Layer Reordering** - Drag and drop layers with visual indicators
- **Fixed** - Custom shaders now work correctly in video batch processing

### v1.4.0 (2025-12-08)
- **NEW: Custom WebGL Effects** - Create and share your own filter effects
  - 42 built-in shaders extracted to `shaders/` directory for reference
  - Custom shaders go in `shaders/custom/` with optional .json metadata
  - Template provided at `shaders/custom/_template.glsl`
  - Backend API endpoints for dynamic shader loading

### v1.3.0 (2025-12-08)
- **NEW: Video Batch Processing** - Full support for processing video sequences
  - Built-in playback controls with play/pause, frame scrubber, and FPS selection
  - Real-time preview of filters on video frames as you scrub through
  - Automatic WebGL batch processing when workflow executes
  - Backend synchronization ensures all frames are processed before output
  - Chunked upload system handles large video batches efficiently
  - Works seamlessly with video loader/combiner nodes (VHS, etc.)

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
