# Changelog

All notable changes to ComfyUI-Purz are documented here. This includes every change, even ephemeral ones that may break things.

## [Unreleased]

## [1.8.0] - 2026-02-05

### Added
- **Effect Search + Favorites + Recently Used** — Searchable effect picker replaces flat dropdown
  - Fuzzy text search across 120+ effects ("chr" -> Chromatic Aberration)
  - Star icon per effect for favorites (persisted to localStorage)
  - Recently Used section (last 10 effects)
  - Collapsible categories, keyboard navigation (arrow keys + Enter)
- **Undo/Redo System** — Command pattern with JSON state snapshots
  - Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts and toolbar buttons
  - 50-state undo stack, debounced slider changes
- **A/B Split Preview (Before/After)** — Draggable vertical divider on preview canvas
  - Left = original, right = filtered; toggle cycles Split / Original / Filtered
  - WebGL scissor-based implementation (zero backend changes)
- **Mask Support for Selective Filtering** — Optional MASK input on Interactive Filter node
  - Per-pixel blend: `output = original * (1-mask) + filtered * mask`
  - Works in both V1 and V3 node schemas

### Changed
- **Modular Frontend (ES Modules)** — Split monolithic JS file into 5 ES modules for maintainability
  - `purz_interactive.js` — Main entry, widget class, extension registration
  - `purz_filter_engine.js` — FilterEngine class, WebGL shaders, ping-pong rendering
  - `purz_layer_manager.js` — EffectPicker, UndoManager, layout utilities
  - `purz_preset_manager.js` — 40+ built-in presets data
  - `purz_styles.js` — CSS injection
  - Zero behavior change — pure structural refactoring

## [1.7.0] - 2026-02-05

### Changed
- Extracted common utilities to `utils.py` module:
  - `hex_to_rgb()`, `hex_to_rgb_normalized()` - consolidated from 10 duplicate implementations
  - `tensor_to_numpy()`, `tensor_to_numpy_uint8()`, `numpy_to_tensor()` - tensor/numpy conversion
  - `tensor_to_pil()`, `pil_to_tensor()`, `pil_to_numpy()`, `numpy_uint8_to_pil()` - PIL conversion
- Updated `pattern_generators.py`, `animated_patterns.py`, and `image_effects.py` to use shared utilities

### Refactored
- **V3 Interactive Filter rewrite** - Reduced `interactive_filters_v3.py` from 657 lines to 51 lines
  - Extracted `process_interactive_filter()` shared helper into `interactive_filters.py` for use by both V1 and V3
  - Eliminated 390 lines of duplicated filter implementations (V3 now imports from V1's registry)
  - Eliminated 80 lines of duplicated batch processing logic (V3 now calls shared helper)
  - Replaced 25 lines of hacky `unique_id` fallback logic with `cls.hidden.unique_id` (correct V3 pattern)
  - Removed 18 debug `print()` statements and unnecessary imports
- **Filter Registry Pattern** - Replaced 400-line if/elif chain in `apply_filter()` with registry-based dispatch
  - Extracted 41 filter effects into individual handler functions (`_filter_desaturate`, `_filter_brightness`, etc.)
  - Created `FILTER_REGISTRY` dict mapping effect names to handler functions
  - Added shared helper functions: `_compute_luminance()`, `_to_grayscale_rgb()`, `LUMA_COEFFS`
  - Each handler has consistent signature: `(result, params, original) -> np.ndarray`

### Performance
- **Vectorized HSV conversion** - `hueShift` and `colorize` effects now use NumPy vectorized operations instead of Python pixel loops
  - Added `rgb_to_hsv_vectorized()` and `hsv_to_rgb_vectorized()` to `utils.py`
  - Eliminates O(h×w) Python function calls per image - massive speedup for large images

## [1.6.1] - 2025-01-26

### Fixed
- **Memory leak fix** - Interactive Filter now properly cleans up WebGL resources when node is deleted
  - Added `cleanup()` method to `FilterEngine` class (deletes textures, buffers, programs, framebuffers, loses WebGL context)
  - Added `dispose()` method to `InteractiveFilterWidget` class (stops animations, clears playback, calls engine cleanup, clears caches)
  - Added `domWidget.onRemove` handler to call dispose when node is removed from canvas
  - Added `widgetInstances` Map to track widget instances by node ID for proper cleanup
  - Follows ComfyUI frontend integration best practices per COMFYUI_FRONTEND_INTEGRATION_GUIDE.md
- **DOM widget overflow fix** - Interactive Filter UI controls no longer break out of node bounds in LiteGraph
  - Added `overflow: hidden` and `height: 100%` to main container CSS
  - Added `max-height: 300px` to layers list to make it scrollable when many effects
  - Improved `computeSize()` to accurately calculate height based on all UI elements
  - Updated `fitHeight()` to set explicit container height
  - Increased padding/buffer values to prevent bottom squishing
- **Batch processing timing fix** - Frames are now properly processed through filters before being output
  - Backend now ALWAYS signals frontend and waits for response (not relying on pre-synced layer state)
  - Frontend immediately responds with empty frames array when no filters are enabled
  - Fixes race condition where layers might not be synced due to 300ms debounce
  - **Fixed in both V1 and V3 versions** of InteractiveImageFilter

## [1.6.0] - 2025-12-08

### Added
- **V3 Schema Support** - All nodes now have V3 versions for modern ComfyUI with improved UI:
  - `image_effects_v3.py` - V3 versions of all image effect nodes
  - `pattern_generators_v3.py` - V3 versions of all pattern generator nodes
  - `animated_patterns_v3.py` - V3 versions of all animated pattern nodes
  - `interactive_filters_v3.py` - V3 version of Interactive Image Filter node
  - Uses `io.ComfyNode`, `io.Schema`, `io.NodeOutput` patterns
  - Uses typed inputs: `io.Int.Input()`, `io.Float.Input()`, `io.Boolean.Input()`, `io.Combo.Input()`
  - **Slider widgets** via `display_mode=io.NumberDisplay.slider` for all numeric inputs
  - Proper `ComfyExtension` classes with `comfy_entrypoint()` async functions
- **Unified V3 entrypoint** in `__init__.py` - ComfyUI auto-detects V3 API availability and uses appropriate system
- **Animated Grain** toggle for Grain effect - when enabled, grain pattern animates in real-time preview and changes per frame during video batch processing, creating a film-like animated static look; when disabled (default), grain stays locked/stationary
- **Live animation preview** - effects with `animate: true` now animate continuously in the preview using requestAnimationFrame
- **Checkbox parameter type** support in Interactive Filter - effects can now define checkbox params via `type: "checkbox"`

### Changed
- `__init__.py` now auto-detects V3 API and only exports `comfy_entrypoint` (V3) or falls back to `NODE_CLASS_MAPPINGS` (V1)
- V3 nodes are immutable - refactored to use local variables instead of instance attributes

### Fixed
- Single image processing now applies filters correctly (was broken by batch processing feature)
- Changed batch processing condition from `batch_size > 1` to `batch_size >= 1` to include single images

## [1.5.0] - 2025-12-08

### Added
- **80 New Shader Effects** across all 8 categories:
  - **Basic** (9 new): Lift, Gain, Offset, Auto Contrast, Normalize, Equalize, Solarize, Fade, Cross Process
  - **Color** (10 new): Split Tone, Color Balance, Selective Color, HSL Adjust, Gradient Map, Color Lookup, Vibrance Pro, RGB Curves, CMYK Adjust, Color Harmony
  - **Tone** (10 new): Tone Curve, HDR Tone, Shadow Recovery, Highlight Recovery, Midtone Contrast, Luminosity Mask, Zone System, Dynamic Range, Tone Split, Local Contrast
  - **Detail** (10 new): High Pass, Low Pass, Bilateral Filter, Surface Blur, Smart Sharpen, Micro Contrast, Texture Enhance, Noise Reduction, Detail Extract, Frequency Separation
  - **Effects** (10 new): Light Leak, Lens Flare, Bokeh, Film Burn, Scratch, Dust, Water Droplets, Frosted Glass, Heat Distortion, CRT Scanlines
  - **Artistic** (10 new): Watercolor, Pencil Sketch, Charcoal, Woodcut, Linocut, Pop Art, Comic Book, Stained Glass, Mosaic, Pointillism
  - **Creative** (10 new): Mirror, Kaleidoscope, Tunnel, Ripple, Wave Distortion, Twirl, Spherize, Pinch, Stretch, Fisheye
  - **Lens** (10 new): Depth of Field, Focus Stack, Miniature, Anamorphic, Barrel Distortion, Pincushion, Mustache Distortion, CA Red/Cyan, CA Blue/Yellow, Lens Vignette
- **16 New Presets** across 4 categories:
  - Cinematic: Blockbuster, Noir Modern, Sci-Fi, Horror
  - Vintage: Kodachrome, Polaroid, 70s, Daguerreotype
  - Stylized: Neon Nights, Anime, Watercolor Dream, Comic
  - Enhancement: Portrait Pro, Landscape HDR, Detail Pop, Auto Fix
- Layer reordering via drag and drop in Interactive Image Filter
- Drag handle (⋮⋮) on each effect layer - drag only initiates from handle
- Visual drop indicators (blue border) showing insert position

### Changed
- Removed asterisk (*) suffix from custom shader names in dropdown - cleaner UI

### Fixed
- Custom shaders now work correctly in video batch processing
- Batch engine now pre-compiles custom shaders before processing frames
- Previously custom effects would render black frames in batch output

## [1.4.0] - 2025-12-08

### Added
- External shader system for Interactive Image Filter
- `shaders/` directory structure with categorized .glsl files
- `shaders/effects.json` manifest for effect metadata
- `shaders/custom/` directory for user-created effects
- `shaders/custom/_template.glsl` template for creating custom effects
- Backend endpoints: `/purz/shaders/manifest`, `/purz/shaders/file/{path}`, `/purz/shaders/custom/list`
- `CustomShaderLoader` frontend module for dynamic shader loading
- Support for custom effect metadata via .json companion files
- Custom effects appear in dropdown with " *" suffix

### Changed
- Built-in shaders are now also available as individual .glsl files for reference
- Effect dropdown now sorts categories with "Custom" at the end
- `_addLayer()` and `_loadPreset()` methods are now async to support custom shader loading

## [1.3.0] - 2025-12-08

### Added
- Video batch processing support for Interactive Image Filter
- Built-in playback controls with play/pause button
- Frame scrubber slider for video preview
- Adjustable FPS selector (6, 8, 12, 16, 24, 30, 48, 60 fps)
- Real-time filter preview while scrubbing through video frames
- Backend-frontend synchronization using WebSocket events (`purz.batch_pending`)
- Polling fallback for reliable event delivery
- Chunked upload system (10 frames per request) for large video batches
- `PURZ_BATCH_PENDING` and `PURZ_BATCH_READY` global state dictionaries
- `/purz/interactive/set_rendered_batch` endpoint with chunk support
- `/purz/interactive/batch_pending/{node_id}` endpoint for polling

### Changed
- Backend `process()` method now waits for frontend WebGL processing to complete
- Frame upload endpoint accepts `chunk_index`, `total_chunks`, and `is_final` parameters

### Fixed
- Node ID lookup now tries both string and parseInt versions for `app.graph._nodes_by_id`
- Large batch uploads no longer fail with `HTTPRequestEntityTooLarge` error

## [1.2.0] - 2025-12-08

### Added
- Preset system for Interactive Image Filter
- 25 built-in professional presets across 6 categories
- Save custom presets as JSON files in `presets/` folder
- Load presets via dropdown menu
- Presets are portable and shareable

## [1.1.0] - 2025-12-07

### Added
- Interactive Image Filter node
- 42 filter effects across 8 categories (Basic, Color, Tone, Detail, Effects, Artistic, Creative, Lens)
- Real-time WebGL preview
- Layer system with per-layer opacity control
- Save button to export filtered images

## [1.0.1] - Initial Release

### Added
- Image effects nodes (Black & White, Rotate, Flip, Blur, Pixelate, Edge Detection, Color Adjust)
- Pattern generation nodes (Checkerboard, Stripes, Polka Dots, Grid, Gradient, Noise)
- Animated pattern nodes (Animated Checkerboard, Stripes, Polka Dots, Noise)
- Mathematical operations for texture combination
- Wave generation with multiple types and directions
- Color ramp interpolation methods
