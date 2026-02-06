# ComfyUI-Purz Development Plan — 10 Radical Improvements

All 10 improvements listed in priority order (best effort-to-impact ratio first). Each is self-contained and shippable independently.

---

## Phase A — Quick Wins

### 1. Effect Search + Favorites + Recently Used
**Files**: `web/js/purz_interactive.js`
**Effort**: Small (~150 lines JS)

Replace the flat `<select>` dropdown (120+ effects across 8 optgroups) with a searchable panel:
- Text input that fuzzy-matches effect names ("chr" → Chromatic Aberration)
- "Favorites" section (star icon per effect, persisted to localStorage as `purz_favorites`)
- "Recently Used" section (last 10 effects, stored in localStorage as `purz_recent_effects`)
- Collapsible categories (current optgroup structure preserved)
- Keyboard navigation (arrow keys + Enter)

### 2. Undo/Redo System
**Files**: `web/js/purz_interactive.js`
**Effort**: Small (~100 lines JS)

Command pattern with JSON state snapshots:
- Every layer mutation (add/remove/reorder/param-change/preset-load) pushes `JSON.parse(JSON.stringify(this.layers))` to undo stack
- Ctrl+Z undoes, Ctrl+Shift+Z redoes
- Stack depth: 50 states (layer configs are <1KB each)
- "Undo" / "Redo" buttons in toolbar
- Debounce slider changes (snapshot after 300ms idle, not every pixel drag)

### 3. A/B Split Preview (Before/After)
**Files**: `web/js/purz_interactive.js`, `FilterEngine` class
**Effort**: Small (~100 lines JS)

Draggable vertical divider on preview canvas:
- Left of divider = original image, right = filtered result
- Drag handle with cursor change
- Toggle button cycles: Split | Original | Filtered
- Implementation: render original to framebuffer A, filtered to framebuffer B, use WebGL scissor test or two draw calls split at divider X position
- Zero backend changes

---

## Phase B — Pro Features

### 4. Mask Support for Selective Filtering
**Files**: `interactive_filters.py`, `interactive_filters_v3.py`, `web/js/purz_interactive.js`, new shader uniform
**Effort**: Medium

Add optional MASK input to the Interactive Filter node:
- **Python** (~30 lines): Add `io.Mask.Input("mask", optional=True)` to V3 schema, `"mask": ("MASK",)` to V1. In `process_interactive_filter`, if mask provided, pass to frontend and apply per-pixel blend: `output = original * (1-mask) + filtered * mask`
- **JS** (~50 lines): Upload mask as a WebGL texture. Add `uniform sampler2D u_mask; uniform bool u_hasMask;` to each shader's render pass. In the final opacity blend: `float maskVal = u_hasMask ? texture2D(u_mask, v_texCoord).r : 1.0;` then `mix(inputColor, filteredColor, opacity * maskVal)`
- **Per-layer toggle**: Each layer gets a "Use Mask" checkbox (default: on when mask is connected)

### 5. Automated Test Suite (pytest)
**Files**: New `tests/` directory, `.github/workflows/publish.yml` update
**Effort**: Medium (~300 lines)

Test categories:
- **Filter unit tests**: Feed 64x64 solid-color tensors through each of 41 `FILTER_REGISTRY` handlers. Assert output shape matches input, values in [0,1], known effects produce expected changes (e.g., `_filter_invert` on white → black)
- **Registry completeness**: Assert every key in `FILTER_REGISTRY` is callable, has correct `(result, params, original)` signature
- **API endpoint tests**: Mock aiohttp request/response for `/purz/interactive/set_layers`, `/purz/shaders/manifest`, preset CRUD
- **Batch processing**: Test `process_interactive_filter` with mocked `PromptServer` and `PURZ_BATCH_READY` state
- **Preset validation**: Load every JSON in `presets/`, verify schema, verify all referenced effects exist

Fixtures: `conftest.py` with `solid_red_tensor`, `gradient_tensor`, `checkerboard_tensor` factories.

---

## Phase C — Architecture & Features

### 6. Modular Frontend (ES Modules)
**Files**: Split `web/js/purz_interactive.js` (4,179 lines) into 6 files
**Effort**: Medium (pure refactoring, zero behavior change)

Target structure:
```
web/js/
├── purz_interactive.js      — Main entry: extension registration, widget creation (~400 lines)
├── purz_filter_engine.js    — FilterEngine class: WebGL, shaders, ping-pong (~370 lines)
├── purz_layer_manager.js    — Layer state: add/remove/reorder/duplicate (~300 lines)
├── purz_preset_manager.js   — Preset load/save/browse, built-in PRESETS (~650 lines)
├── purz_batch_processor.js  — Batch orchestration, chunked upload (~200 lines)
└── purz_playback.js         — Video playback, scrubber, FPS control (~150 lines)
```

Note: ComfyUI auto-loads all `.js` from `WEB_DIRECTORY`. Use `export`/`import` between modules. The main file imports from others and registers the extension.

### 7. Keyframe Animation System
**Files**: `web/js/purz_interactive.js` (or `purz_layer_manager.js` after split), `interactive_filters.py`
**Effort**: Medium (~200 lines JS, ~50 lines Python)

Data model — extend layer params:
```json
{
  "effect": "brightness",
  "params": {
    "amount": { "value": 0.5, "keyframes": [{"frame": 0, "value": 0}, {"frame": 30, "value": 0.5}], "interpolation": "ease" }
  }
}
```

- **JS UI**: Diamond icon next to each slider. Click at current scrubber frame to add keyframe. Keyframed params show colored slider track. Mini timeline dots below scrubber.
- **JS interpolation**: Linear and ease (cubic bezier). Evaluate `getValueAtFrame(param, frameIndex)` before rendering each batch frame.
- **Python**: In `process_interactive_filter`, pass `frame_index` to frontend batch signal. Frontend already loops over frames — just interpolate params per frame before WebGL render.
- **Backwards compatible**: Layers without keyframes work exactly as before (plain `value` field).

### 8. LUT Import/Export (.cube)
**Files**: `web/js/purz_interactive.js`, new `shaders/core/lut.glsl`, new API endpoint
**Effort**: Medium (~180 lines total)

**Export** (~60 lines JS):
1. Generate 64x64x64 identity LUT as a flat RGB image (64 slices of 64x64)
2. Render through current filter stack via FilterEngine
3. Read back pixels, format as `.cube` text (`LUT_3D_SIZE 64` header + RGB triplets)
4. Trigger browser download

**Import** (~80 lines JS + 20 lines GLSL):
1. Parse `.cube` file (simple line-by-line: skip comments, read `LUT_3D_SIZE`, read RGB triplets)
2. Pack into 2D texture atlas (WebGL 1.0 has no 3D textures): 64 slices in an 8x8 grid = 512x512 texture
3. New `lut.glsl` shader: sample the 2D atlas with trilinear interpolation from input RGB
4. Add as a special "LUT" effect layer

**Backend** (~40 lines Python):
- `POST /purz/lut/upload` — receive .cube file, store temporarily
- `GET /purz/lut/file/{name}` — serve uploaded LUT for WebGL

---

## Phase D — Performance

### 9. GPU-Accelerated Filters (PyTorch)
**Files**: `interactive_filters.py` (FILTER_REGISTRY handlers)
**Effort**: Large (~300 lines rewritten)

Images arrive as PyTorch tensors and currently get converted to NumPy immediately. Instead:
- **Simple math filters** (brightness, contrast, exposure, gamma, saturation, invert, sepia, etc. — ~25 filters): Rewrite as pure PyTorch tensor ops. These run on GPU if available, CPU otherwise. Example: `_filter_brightness = lambda result, params, _: torch.clamp(result + params.get("amount", 0.0), 0, 1)`
- **PIL-dependent filters** (blur, sharpen, unsharp mask, emboss, edge detect, pixelate — ~10 filters): Keep NumPy/PIL path. These use `ImageFilter` which has no PyTorch equivalent without kornia.
- **Hybrid filters** (halftone, glitch — ~6 filters): Vectorize with PyTorch where possible, fall back to NumPy for complex ops.

Refactor `apply_filter()` to detect tensor type and dispatch accordingly. Keep backward compatibility.

### 10. Async Batch Processing
**Files**: `interactive_filters.py`
**Effort**: Medium (~40 lines changed), High risk (depends on ComfyUI async support)

Replace synchronous poll loop:
```python
# Current (blocking):
while not PURZ_BATCH_READY.get(node_id):
    time.sleep(0.1)  # Burns CPU, blocks thread

# New (async):
import asyncio
batch_event = asyncio.Event()
PURZ_BATCH_EVENTS[node_id] = batch_event
await asyncio.wait_for(batch_event.wait(), timeout=300)  # Zero CPU, yields thread
```

The batch upload endpoint does `PURZ_BATCH_EVENTS[node_id].set()` instead of setting a flag.

**Risk**: Need to verify ComfyUI's execution engine supports async `process()`/`execute()`. If not, use `threading.Event` instead of `asyncio.Event` (still better than polling).

---

## Completed (Previous Versions)

- [x] Extract common utilities to `utils.py`
- [x] Vectorize pixel loops (HSV conversion)
- [x] Filter registry pattern (replace if/elif chain)
- [x] V3 Interactive Filter rewrite (657 → 51 lines)
- [x] Custom WebGL effects system (120+ shaders)
- [x] Layer reordering (drag and drop)
- [x] Video batch processing
- [x] Preset system (40+ built-in)
- [x] Memory leak fixes (WebGL cleanup)

## Dropped / Deferred

- ~~Native UI Refactor~~ — Deferred until ComfyUI Nodes 2.0 stabilizes Vue widget system
- ~~Clean Up Orphaned V3 Files~~ — V3 files are active and used by `__init__.py`
- ~~Document Magic Numbers~~ — Low priority, tackle during GPU filter rewrite
- ~~Global State Cleanup~~ — Addressed partially by async batch processing (#10)
