# ComfyUI-Purz Development Plan

## Roadmap

### Code Quality & Refactoring (Priority: High)

- [x] **Extract Common Utilities** - DRY up duplicated code
  - [x] Create `utils.py` with shared `hex_to_rgb()` function (currently copy-pasted 10 times)
  - [x] Move color conversion helpers to utils module
  - [x] Centralize image format conversion helpers (tensor↔numpy↔PIL)

- [x] **Vectorize Pixel Loops** - Fix critical performance issues
  - [x] Refactor `hueShift` effect to use NumPy vectorized HSV conversion (currently O(n²) Python loop)
  - [x] Refactor `colorize` effect similarly
  - [x] Removed inline `colorsys` imports (replaced with vectorized utils functions)

- [x] **Filter Registry Pattern** - Break up the 35-branch `apply_filter()` monster
  - [x] Create filter registry dict mapping effect names to handler functions
  - [x] Extract each filter into its own function (41 handlers)
  - [x] Enable easier testing of individual effects

- [ ] **Split JavaScript File** - Break up 2000+ line `purz_interactive.js`
  - [ ] Extract `FilterEngine` class to `filter_engine.js`
  - [ ] Extract `CustomShaderLoader` to `shader_loader.js`
  - [ ] Extract `PRESETS` and preset logic to `presets.js`
  - [ ] Extract `EFFECTS` definitions to `effects.js`
  - [ ] Keep widget/UI logic in main file

- [ ] **Clean Up Orphaned Files** - Remove or integrate `_v3.py` files
  - [ ] Evaluate `animated_patterns_v3.py`, `image_effects_v3.py`, `interactive_filters_v3.py`, `pattern_generators_v3.py`
  - [ ] Either complete V3 migration or delete unused files

- [ ] **Document Magic Numbers** - Add constants with meaningful names
  - [ ] Replace inline `0.3`, `0.5` etc with named constants
  - [ ] Document the reasoning behind color correction coefficients

- [ ] **Global State Cleanup** - Add proper lifecycle management
  - [ ] Document which thread/context writes to each global dict
  - [ ] Add cleanup on node deletion to prevent memory leaks
  - [ ] Consider using WeakValueDictionary or explicit cleanup hooks

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
