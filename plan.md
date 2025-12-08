# ComfyUI-Purz Development Plan

## Roadmap

### Interactive Image Filter Enhancements

- [x] **Custom WebGL Effects** - Break out Interactive Image Filter effects into separate shader files, allowing users to create and share their own custom WebGL effects
  - Shaders extracted to `shaders/` directory by category
  - Custom shaders go in `shaders/custom/` with optional .json metadata
  - Template provided at `shaders/custom/_template.glsl`
- [x] **More Effects** - Expanded to 120+ effects with 80 new shader effects (v1.5.0)
  - [x] **Basic** (9 new): Lift, Gain, Offset, Auto Contrast, Normalize, Equalize, Solarize, Fade, Cross Process
  - [x] **Color** (10 new): Split Tone, Color Balance, Selective Color, HSL Adjust, Gradient Map, Color Lookup, Vibrance Pro, RGB Curves, CMYK Adjust, Color Harmony
  - [x] **Tone** (10 new): Tone Curve, HDR Tone, Shadow Recovery, Highlight Recovery, Midtone Contrast, Luminosity Mask, Zone System, Dynamic Range, Tone Split, Local Contrast
  - [x] **Detail** (10 new): High Pass, Low Pass, Bilateral Filter, Surface Blur, Smart Sharpen, Micro Contrast, Texture Enhance, Noise Reduction, Detail Extract, Frequency Separation
  - [x] **Effects** (10 new): Light Leak, Lens Flare, Bokeh, Film Burn, Scratch, Dust, Water Droplets, Frosted Glass, Heat Distortion, CRT Scanlines
  - [x] **Artistic** (10 new): Watercolor, Pencil Sketch, Charcoal, Woodcut, Linocut, Pop Art, Comic Book, Stained Glass, Mosaic, Pointillism
  - [x] **Creative** (10 new): Mirror, Kaleidoscope, Tunnel, Ripple, Wave Distortion, Twirl, Spherize, Pinch, Stretch, Fisheye
  - [x] **Lens** (10 new): Depth of Field, Focus Stack, Miniature, Anamorphic, Barrel Distortion, Pincushion, Mustache Distortion, CA Red/Cyan, CA Blue/Yellow, Lens Vignette
- [x] **More Presets** - 16 new presets added (v1.5.0)
  - [x] Cinematic presets: Blockbuster, Noir Modern, Sci-Fi, Horror
  - [x] Vintage presets: Kodachrome, Polaroid, 70s, Daguerreotype
  - [x] Stylized presets: Neon Nights, Anime, Watercolor Dream, Comic
  - [x] Enhancement presets: Portrait Pro, Landscape HDR, Detail Pop, Auto Fix
- [x] **Layer Reordering** - Drag and drop to re-arrange effect layers
  - Drag handle (⋮⋮) added to each layer
  - Visual feedback with drop indicators above/below target
- [ ] **Native UI Refactor** - Refactor effects layers window to use native ComfyUI elements
  - Use proper ComfyUI widget system instead of custom DOM elements
  - Fix resize behavior to work correctly on both V1 and V2 frontends
  - Better integration with ComfyUI's node sizing and layout
- [ ] **Mask Support** - Apply filter effects selectively using masks

## Future Ideas

- Animation keyframes for effects (animate parameters over time)
- LUT import/export support
- Effect favorites/pinning
- Undo/redo stack for effect changes
