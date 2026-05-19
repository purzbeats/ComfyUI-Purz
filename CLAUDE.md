# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ComfyUI-Purz is a custom node pack for ComfyUI providing image effects, pattern generation, and animated pattern creation. It is installed as a custom node in ComfyUI's `custom_nodes/` directory.

**Key Features**:
- 120+ real-time WebGL filter effects via Interactive Image Filter
- Video batch processing with live preview
- External shader system for custom user effects
- 40+ professional presets for common looks
- Static and animated pattern generators
- Traditional image processing effects

**Project Stats** (v1.8.0): ~4800 lines of Python, ~5050 lines of JavaScript, 120+ GLSL shader effects

## Architecture

### File Structure
```
ComfyUI-Purz/
├── __init__.py                       # Auto-detects V3 API; exports comfy_entrypoint (V3) OR NODE_CLASS_MAPPINGS (V1)
├── nodes.py                          # V1 fallback: aggregates legacy NODE_CLASS_MAPPINGS from source modules
├── utils.py                          # Shared helpers (hex_to_rgb, tensor/numpy/PIL conversion, vectorized HSV)
├── image_effects.py                  # V1: traditional image processing nodes + shared _pixelate_image()
├── image_effects_v3.py               # V3: same nodes via io.ComfyNode with slider UI
├── pattern_generators.py             # V1: static pattern generation nodes
├── pattern_generators_v3.py          # V3: same patterns via io.ComfyNode with slider UI
├── animated_patterns.py              # V1: animated pattern nodes with math utilities
├── animated_patterns_v3.py           # V3: same animated patterns with slider UI
├── interactive_filters.py            # Backend: FILTER_REGISTRY, process_interactive_filter(), API routes (V1 + V3 share this)
├── interactive_filters_v3.py         # V3 thin wrapper (~52 lines) delegating to process_interactive_filter()
├── media_extractor.py                # V1: BOTH MediaExtractor (client-side) + MediaExtractorUpload (server-side) + shared helpers + routes
├── media_extractor_v3.py             # V3 wrappers for both
├── video_trim.py                     # V1: BOTH VideoTrim (client-side bake) + VideoTrimUpload (as_trimmed) + /set_baked route
├── video_trim_v3.py                  # V3 wrappers for both
├── web/js/                           # Frontend ES modules
│   ├── purz_interactive.js           # Filter Live entry point, widget class, extension registration
│   ├── purz_filter_engine.js         # FilterEngine: WebGL shaders, ping-pong rendering, batch processing
│   ├── purz_layer_manager.js         # EffectPicker (search/favorites/recent), UndoManager, layout utils
│   ├── purz_preset_manager.js        # Built-in preset data (40+ presets, was JSON files)
│   ├── purz_styles.js                # CSS injection (Filter Live)
│   ├── purz_media_extractor.js       # Media Extractor — client-side video, file picker + <video> + <canvas>
│   ├── purz_media_extractor_upload.js # Media Extractor Upload — combo + upload + <video>-from-/view scrubber
│   ├── purz_video_trim.js            # Video Trim — client-side bake via captureStream() + MediaRecorder
│   └── purz_video_trim_upload.js     # Video Trim Upload — server-side trim via VideoFromFile.as_trimmed()
├── shaders/
│   ├── effects.json                  # Shader manifest with metadata
│   ├── core/                         # Shared vertex/passthrough shaders
│   ├── basic/, color/, tone/, detail/, effects/, artistic/, creative/, lens/
│   │   └── *.glsl                    # Categorized shader effect files
│   └── custom/
│       ├── _template.glsl            # Template for creating custom effects
│       └── *.glsl                    # User-created custom shaders
├── presets/                          # User-saved preset JSON files only (built-ins live in purz_preset_manager.js)
├── pyproject.toml                    # Project metadata and version
├── requirements.txt                  # Python dependencies
├── CLAUDE.md                         # This file - development guidance for AI assistants
├── CHANGELOG.md                      # All changes (including ephemeral)
├── README.md                         # User-facing documentation
├── plan.md                           # Development roadmap
└── painpoints.md                     # Documentation gaps and development challenges
```

### Node Registration System
`__init__.py` auto-detects which ComfyUI API is available:

- **V3 path** (preferred): if `from comfy_api.latest import io, ComfyExtension` succeeds, it defines a `PurzExtension(ComfyExtension)` that returns all V3 node classes from `get_node_list()`, exposes `comfy_entrypoint()`, and **deliberately does not export `NODE_CLASS_MAPPINGS`** so ComfyUI uses the V3 entrypoint. It still imports `interactive_filters` at module load to register the V1 server routes (decorator side-effects).
- **V1 fallback**: on ImportError, exports `NODE_CLASS_MAPPINGS` / `NODE_DISPLAY_NAME_MAPPINGS` from `nodes.py`, which aggregates the four V1 source modules.

Each V1 source module defines its own `*_NODE_CLASS_MAPPINGS` and `*_NODE_DISPLAY_NAME_MAPPINGS` dicts. Each V3 module defines `io.ComfyNode` subclasses directly imported by `__init__.py`.

### Source Modules

Each functional area has a V1 and V3 module. **Edit shared logic in the V1 module — V3 modules are thin wrappers.**

**image_effects.py / image_effects_v3.py** - Image processing nodes (Purz/Image/* categories)
- Color: Black & white conversion, color adjustment (brightness/contrast/saturation)
- Transform: Rotation, flip/mirror
- Effects: Blur (gaussian/box/motion), edge detection (sobel/canny/laplacian)
- **Pixelate**: shared `_pixelate_image()` pipeline supporting area/nearest/median downsample, posterize + retro palettes (Game Boy, NES, C64, PICO-8, CGA, Endesga 32), ordered Bayer + Floyd-Steinberg dithering, grid lines, non-square pixels, mask. Both V1 and V3 call the same pipeline.

**pattern_generators.py / pattern_generators_v3.py** - Static pattern generation nodes (Purz/Patterns/Basic, Purz/Patterns/Noise)
- Checkerboard, stripes, polka dots, grid, gradient, hexagon, noise patterns
- All patterns support batch_size for multiple output images

**animated_patterns.py / animated_patterns_v3.py** - Animated pattern nodes (Purz/Patterns/Animated)
- Contains mathematical utility classes: `TextureMath`, `ColorRamp`, `WaveTextureGenerator`, `PatternTextureGenerator`
- Animated versions of checkerboard, stripes, polka dots, and noise
- Supports wave modulation with configurable wave types, directions, and math operations
- frame_count parameter controls animation length

**media_extractor.py / media_extractor_v3.py** - Two single-frame video pickers (Purz/Interactive). Both output a `[1, H, W, 3]` tensor.

- **`PurzMediaExtractor`** (Path A — client-side, fast)
  - No `IMAGE` input. Self-contained.
  - Frontend uses `<input type="file">` + `URL.createObjectURL()` so the video file **never reaches the server**. HTML5 `<video>` for playback + scrub.
  - On commit (file-load, First/Last, scrubber release): draws current frame to a `<canvas>`, `toDataURL("image/png")`, POSTs to `/purz/media_extractor/set_frame`. Backend keeps a per-node cache in `PURZ_MEDIA_FRAMES[node_id]` and decodes on execute (`decode_frame_b64`).
  - Caveat: the video itself does not persist across browser reloads (only the cached PNG does, until the node is removed). For persistence use the Upload variant.

- **`PurzMediaExtractorUpload`** (Path B — server-side, persistent)
  - Node has standard widgets `video` (Combo populated from `input/` dir) and `frame_index` (Int) — both serialize into the workflow.
  - "Upload Video" button POSTs the file to `/purz/media_extractor/upload` (streamed multipart write into `input/`); the combo refreshes via `/purz/media_extractor/list`.
  - In-browser scrub still uses `<video>` against `/view?filename=...&type=input`, so scrubbing is local. `frame_index` is the source of truth and is two-way-bound to the scrubber.
  - Backend opens with cv2 at execute time (`extract_frame_from_video`), seeks `cv2.CAP_PROP_POS_FRAMES`, converts BGR→RGB.
  - `IS_CHANGED` / `fingerprint_inputs` mix file mtime with `frame_index` so same-name re-uploads invalidate the cache.

Both flavors share `decode_frame_b64` / `extract_frame_from_video` / `list_input_videos` helpers in `media_extractor.py`. The V3 wrappers are thin and just call those helpers.

**video_trim.py / video_trim_v3.py** - Two single-clip trim nodes (Purz/Interactive). Both output a `VIDEO` (`comfy_api.input_impl.VideoInput`).

- **`PurzVideoTrim`** (Path A — client-side bake, auto on queue)
  - No node inputs. Self-contained widget with file picker.
  - **No manual bake button** — the bake fires automatically on workflow queue. Protocol mirrors Interactive Filter's batch handoff:
    1. Backend `process()` (V1) / `execute()` (V3) sets `PURZ_TRIM_BAKE_READY[node_id] = False`, sends WebSocket event `purz.video_trim.bake_requested`, and enters a poll loop (≤10 min, 100 ms interval).
    2. Frontend's `setup()` listens for the event. The node's widget either bakes fresh (`<video>.captureStream()` → `MediaRecorder` webm vp9/vp8+opus → `POST /purz/video_trim/set_baked?node_id=…`) or, if the cached bake matches the current trim handles, short-circuits via `POST /purz/video_trim/bake_ready`. Either endpoint sets the ready flag.
    3. Backend exits the poll loop, reads `PURZ_TRIM_BAKED[node_id]`, returns `VideoFromFile(path)`.
  - `bakeFresh` flag on the widget flips to `false` whenever the user moves a handle or loads a new video, so re-queues with the same trim skip re-baking.
  - Bake duration = trim duration (real-time playback — `captureStream` only emits while playing). Audio is captured.

- **`PurzVideoTrimUpload`** (Path B — server-side trim)
  - Widgets: `video` (Combo from `input/`), `trim_start_seconds` (Float), `trim_end_seconds` (Float). All serialize with the workflow.
  - Reuses `POST /purz/media_extractor/upload` for the actual file upload.
  - Process: `VideoFromFile(path).as_trimmed(start_time=start, duration=end-start, strict_duration=False)`. Lazy windowed read — no re-encode, instant.
  - `IS_CHANGED` / `fingerprint_inputs` mix file mtime with both trim points.

Fallback for both: `_empty_video()` returns `VideoFromComponents` with one 64×64 black frame at 24 fps so downstream nodes never receive `None`.

**utils.py** - Shared helpers; import from here rather than reimplementing
- `hex_to_rgb()`, `hex_to_rgb_normalized()`
- `tensor_to_numpy()`, `tensor_to_numpy_uint8()`, `numpy_to_tensor()`
- `tensor_to_pil()`, `pil_to_tensor()`, `pil_to_numpy()`, `numpy_uint8_to_pil()`
- `rgb_to_hsv_vectorized()`, `hsv_to_rgb_vectorized()` — vectorized NumPy HSV conversion (much faster than per-pixel Python loops; used by `hueShift` and `colorize` filters)

### ComfyUI Node Structure

**V1 (legacy) pattern** — used by `*.py` modules without `_v3` suffix:
- `INPUT_TYPES` classmethod defines parameters with types and constraints
- `RETURN_TYPES` tuple specifies output types (usually `("IMAGE",)`)
- `FUNCTION` string names the processing method
- `CATEGORY` string sets the node's location in ComfyUI menu
- Processing methods return tuple of outputs

**V3 pattern** — used by `*_v3.py` modules:
- Subclass `io.ComfyNode`
- `define_schema()` classmethod returns `io.Schema(node_id=..., display_name=..., category=..., inputs=[io.Image.Input(...), io.Float.Input(..., display_mode=io.NumberDisplay.slider), ...], outputs=[io.Image.Output(...)], hidden=[io.Hidden.unique_id, ...])`
- `execute()` classmethod returns `io.NodeOutput(image, ui={...})`
- `fingerprint_inputs()` replaces `IS_CHANGED()` (return `float("nan")` for always-re-execute)
- Hidden params accessed via `cls.hidden.unique_id` (not function args)
- **V3 nodes are immutable** — use local variables inside `execute()`, never `self.x = ...` (instance is reused)
- Typed inputs: `io.Int.Input`, `io.Float.Input`, `io.Boolean.Input`, `io.Combo.Input`, `io.Image.Input`, `io.Mask.Input`. Use `display_mode=io.NumberDisplay.slider` for slider widgets.

### Image Format
ComfyUI images are PyTorch tensors in format `[batch, height, width, channels]` with float32 values in 0-1 range.

**Prefer the helpers in `utils.py`** over hand-rolled conversion. Raw conversion (when needed at module boundaries):
- PyTorch → NumPy: `img_np = img_tensor.cpu().numpy()`
- NumPy → PyTorch: `img_tensor = torch.from_numpy(img_np)`
- NumPy → PIL: `pil_img = Image.fromarray((img_np * 255).astype(np.uint8))`
- PIL → NumPy: `img_np = np.array(pil_img).astype(np.float32) / 255.0`

## Dependencies
- PyTorch >= 1.9.0
- NumPy >= 1.19.0
- Pillow >= 8.0.0
- OpenCV (opencv-python) >= 4.5.0
- Optional: scipy (for smooth noise interpolation, falls back to manual implementation)

## Development

### Setup
Install dependencies:
```bash
pip install -r requirements.txt
```

### Testing
This node pack has no automated test suite. To test changes:
1. Make code changes to the Python files
2. Restart ComfyUI (or use ComfyUI's reload custom nodes feature if available)
3. Verify nodes appear under the "Purz/" category hierarchy
4. Load a workflow using the nodes and test functionality
5. For Interactive Filter changes, test both WebGL preview and workflow output

### Development Workflow
1. Edit Python node code in the V1 module (`image_effects.py`, `pattern_generators.py`, `animated_patterns.py`, `interactive_filters.py`). V3 modules generally only need a matching schema update — the V3 `interactive_filters_v3.py` is a 52-line wrapper that calls back into the V1 module's shared helpers (`process_interactive_filter`, `FILTER_REGISTRY`, `_pixelate_image`), so changing logic in V3 alone won't take effect when V1 is selected.
2. For frontend changes, edit the appropriate ES module in `web/js/` (engine vs. layer-manager vs. presets vs. styles vs. main entry)
3. For shader changes, edit files in `shaders/` directory or add custom shaders to `shaders/custom/`
4. Update CHANGELOG.md immediately with every change (even experimental ones)
5. When ready to release, update version in `pyproject.toml`, move CHANGELOG entries, and update README.md

## Official ComfyUI Documentation

**Reference**: https://docs.comfy.org (fetch llms.txt for full navigation)

Key documentation pages for custom node development:
- **JavaScript Overview**: `/custom-nodes/js/javascript_overview` - Extension registration basics
- **JavaScript Hooks**: `/custom-nodes/js/javascript_hooks` - Lifecycle hooks reference
- **JavaScript Objects**: `/custom-nodes/js/javascript_objects_and_hijacking` - Core objects and APIs
- **V3 Migration Guide**: `/custom-nodes/v3_migration` - Backend schema changes (Python only)
- **JavaScript Examples**: `/custom-nodes/js/javascript_examples` - Code samples

## Frontend JavaScript Extensions

### Official Extension Framework
**Docs**: https://docs.comfy.org/custom-nodes/js/javascript_overview

1. Export `WEB_DIRECTORY = "./web"` in `__init__.py`
2. Create `.js` files in that directory (auto-loaded by browser)
3. Register extensions:
```javascript
import { app } from "../../scripts/app.js";
app.registerExtension({
    name: "purz.extensionname",
    async setup() { /* runs at end of startup, good for event listeners */ },
    async beforeRegisterNodeDef(nodeType, nodeData, app) { /* modify node type before registration */ },
    async nodeCreated(node) { /* runs when individual node instance created */ },
    async init() { /* runs on page load, before node registration */ }
});
```

### Available Hooks (Execution Order)
**Docs**: https://docs.comfy.org/custom-nodes/js/javascript_hooks

**Web page load**: `init` → `addCustomNodeDefs` → `getCustomWidgets` → `beforeRegisterNodeDef` (per node type) → `afterConfigureGraph` → `setup`

**Loading workflow**: `beforeConfigureGraph` → `beforeRegisterNodeDef` (optional) → `nodeCreated` (per instance) → `afterConfigureGraph`

**Adding new node**: `nodeCreated`

### Core Objects Reference
**Docs**: https://docs.comfy.org/custom-nodes/js/javascript_objects_and_hijacking

**app object** (import from `../../scripts/app.js`):
- `app.canvas` - LGraphCanvas (UI)
- `app.graph` - LGraph (node/link state)
- `app.graph._nodes_by_id[id]` - Get node by ID (may need string or int)
- `app.runningNodeId` - Currently executing node
- `app.registerExtension()` - Register extension
- `app.queuePrompt()` - Submit to execution queue
- `app.graphToPrompt()` - Convert graph to prompt

**ComfyNode properties**:
- `id`, `type`, `title`, `pos`, `size`
- `inputs`, `outputs`, `widgets`
- `mode` - 0=normal, 2=muted, 4=bypassed
- `comfyClass` - The node class name

**Widget types**: BOOLEAN, INT, FLOAT, STRING, COMBO, IMAGEUPLOAD

### Backend-to-Frontend Messaging
```python
# Backend (Python)
PromptServer.instance.send_sync("event.type", {"data": value})
```
```javascript
// Frontend (JavaScript)
import { api } from "../../scripts/api.js";
api.addEventListener("execution_start", (event) => { /* event.detail contains data */ });
```

### Deprecation Warning
**From official docs**: "Hijacking/monkey-patching functions on `app` or prototypes is deprecated and subject to change."

However, for complex widgets we still need patterns like overriding `onExecuted` because no official hooks exist for all use cases. See `painpoints.md` for details.

## Nodes 2.0 and V3 Schema

This pack ships **both V1 and V3** node definitions side-by-side. `__init__.py` picks at import time. V3 is the path forward; V1 remains as a fallback for older ComfyUI installs.

**Docs**: https://docs.comfy.org/custom-nodes/v3_migration

| Aspect | V1 | V3 |
|--------|------|-----|
| Base class | Plain class | `io.ComfyNode` |
| Schema | `INPUT_TYPES()` | `define_schema()` returning `io.Schema` |
| Returns | `RETURN_TYPES` tuple | `outputs=[...]` in Schema |
| Cache control | `IS_CHANGED()` | `fingerprint_inputs()` |
| Execution | Custom-named method via `FUNCTION` | `execute()` classmethod |
| Hidden params | function args (`unique_id`, ...) | `cls.hidden.unique_id` |
| Instance state | `self.x = ...` OK | Immutable — use locals only |
| Numeric UI | Default number widget | Slider via `display_mode=io.NumberDisplay.slider` |

**Frontend / DOM widgets in Nodes 2.0**: still partially uncharted. Our `addDOMWidget()` + `onExecuted` patterns currently work on the Vue rendering system, but no official Vue-native widget API exists yet. See `painpoints.md` for open questions.

## Node Naming Convention
- Class names: PascalCase descriptive names (e.g., `CheckerboardPattern`)
- Registry keys: Prefixed with "Purz" (e.g., `PurzCheckerboardPattern`)
- Display names: Descriptive with "(Purz)" suffix (e.g., `Checkerboard Pattern (Purz)`)

## Interactive Filter System (interactive_filters.py)

The Interactive Filter node demonstrates advanced patterns for real-time preview with workflow output.

### Architecture
- **Frontend**: WebGL shaders for real-time preview in browser
- **Backend**: Numpy/PIL implementations of same filters for workflow output
- **Sync**: Frontend sends filter state to backend via REST API, backend applies on execution
- **V1/V3 share one backend**: `interactive_filters.py` defines `process_interactive_filter()` and the `FILTER_REGISTRY` dict. Both `interactive_filters.py` (V1) and `interactive_filters_v3.py` (V3) call into the same helper — V3 is a ~52-line wrapper.

### Key Files
- `interactive_filters.py` - V1 node + shared `process_interactive_filter()` helper + `FILTER_REGISTRY` + API routes
- `interactive_filters_v3.py` - V3 thin wrapper, delegates to `process_interactive_filter()`
- `web/js/purz_interactive.js` - Main entry, widget class, extension registration
- `web/js/purz_filter_engine.js` - `FilterEngine` (WebGL shaders, ping-pong, batch processing)
- `web/js/purz_layer_manager.js` - `EffectPicker` (search/favorites/recent), `UndoManager`, layout

### Filter Registry Pattern
The 400-line if/elif chain in `apply_filter()` was replaced with a dispatch table. To add a new filter:

1. Write a handler with the standard signature: `_filter_<name>(result, params, original) -> np.ndarray`
2. Register it: `FILTER_REGISTRY["<name>"] = _filter_<name>`
3. Reuse shared helpers in the same module: `_compute_luminance()`, `_to_grayscale_rgb()`, `LUMA_COEFFS`, and the vectorized HSV helpers in `utils.py`

### Critical Patterns Learned

#### Preventing ComfyUI Default Preview
To show custom preview instead of ComfyUI's default image preview at bottom of node:
```python
return {
    "ui": {
        "purz_images": results,  # Custom key (not "images") prevents default preview
    },
    "result": (output_image,)
}
```
Frontend reads from `message.purz_images` instead of `message.images`.

#### Forcing Node Re-execution (Disabling Cache)
ComfyUI caches node outputs by default. For nodes that need fresh execution every time:
```python
# V1
@classmethod
def IS_CHANGED(cls, image, **kwargs):
    return float("nan")  # NaN always triggers re-execution

# V3 — same idea, renamed method
@classmethod
def fingerprint_inputs(cls, **kwargs) -> float:
    return float("nan")
```

#### Hidden Parameters
```python
# V1 — declare in INPUT_TYPES, receive as function args
@classmethod
def INPUT_TYPES(cls):
    return {
        "required": { "image": ("IMAGE",) },
        "hidden": {
            "unique_id": "UNIQUE_ID",
            "prompt": "PROMPT",
            "extra_pnginfo": "EXTRA_PNGINFO",
        }
    }

# V3 — declare in Schema, access via cls.hidden.*
inputs=[io.Image.Input("image")],
hidden=[io.Hidden.unique_id, io.Hidden.prompt, io.Hidden.extra_pnginfo],
# In execute():
node_id = str(cls.hidden.unique_id) if cls.hidden and cls.hidden.unique_id else None
```

#### Frontend-Backend State Sync
Store state in module-level dict (persists across executions):
```python
PURZ_FILTER_LAYERS = {}  # Global storage

# API endpoint to receive state from frontend
@PromptServer.instance.routes.post("/purz/interactive/set_layers")
async def set_filter_layers(request):
    data = await request.json()
    node_id = str(data.get("node_id", ""))
    PURZ_FILTER_LAYERS[node_id] = data.get("layers", [])
    return web.json_response({"success": True})
```

Frontend syncs on every change:
```javascript
api.fetchApi("/purz/interactive/set_layers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: this.node.id, layers: layerData })
});
```

### v1.8.0 Frontend Features

These features live entirely in the frontend ES modules and require no backend coordination unless noted.

- **Effect search + favorites + recently used** (`purz_layer_manager.js`'s `EffectPicker`): fuzzy text search across 120+ effects, per-effect star (persisted to `localStorage`), recently used section (last 10), keyboard nav. Replaces the flat dropdown.
- **Undo / redo** (`UndoManager` in `purz_layer_manager.js`): command pattern with JSON state snapshots, 50-state stack, debounced slider changes, Ctrl+Z / Ctrl+Shift+Z.
- **A/B split preview**: WebGL-scissor-based vertical divider on the preview canvas (left = original, right = filtered). Pure frontend — **no backend changes**, no extra render pass for the source image.
- **Mask support**: optional `MASK` input on the Interactive Filter node. Backend blends per-pixel: `output = original * (1-mask) + filtered * mask`. Implemented in both V1 and V3 schemas; applied inside `process_interactive_filter()`.

## Backend API Endpoints

Interactive Filter endpoints are registered in `interactive_filters.py`; Media Extractor in `media_extractor.py`.

- `POST /purz/media_extractor/set_frame` - Cache current frame for `PurzMediaExtractor` (client-side variant)
  - Body: `{ node_id: string|number, frame: "data:image/png;base64,..." | "" }`
  - Empty `frame` clears the cache. Returns: `{ success: true }`

- `POST /purz/media_extractor/upload` - Multipart upload of a video into `input/` (for `PurzMediaExtractorUpload`)
  - Form field `video`. Streamed in 64KB chunks. Auto-renames on collision.
  - Returns: `{ name, total_frames, fps, width, height }`

- `GET /purz/media_extractor/info/{filename}` - cv2-derived metadata for a video in `input/`
  - Returns: `{ total_frames, fps, width, height }`

- `GET /purz/media_extractor/list` - List video files currently in `input/`
  - Returns: `{ videos: array<string> }`

- `POST /purz/video_trim/set_baked?node_id=…` - Receive a Path-A baked trim segment
  - `node_id` is a query parameter; the raw request body is the webm bytes (streamed to disk).
  - Sets `PURZ_TRIM_BAKE_READY[node_id] = True` so the backend's poll loop unblocks.
  - Empty body clears the cached blob (still marks ready). Returns: `{ success: true, bytes?: number }`

- `POST /purz/video_trim/bake_ready` - Ack a bake request without writing a new blob
  - Body: `{ node_id }`. Used when the frontend's cached bake matches the current trim, or when bake failed and we want to unblock the backend so it falls back to an empty video.
  - Returns: `{ success: true }`

- `POST /purz/interactive/set_layers` - Store filter layer configuration from frontend
  - Body: `{ node_id: string, layers: array }`
  - Returns: `{ success: true }`

- `POST /purz/interactive/set_rendered_batch` - Upload WebGL-rendered frames for batch output
  - Body: `{ node_id: string, frames: array<base64>, chunk_index?: number, total_chunks?: number, is_final?: boolean }`
  - Supports chunked uploads for large video batches
  - Returns: `{ success: true }`

- `GET /purz/interactive/batch_pending/{node_id}` - Poll for pending batch processing status
  - Returns: `{ pending: boolean, count?: number }`
  - Used as fallback when WebSocket events don't arrive

- `GET /purz/shaders/manifest` - Get effects.json merged with custom shader metadata
  - Returns: `{ effects: array }`

- `GET /purz/shaders/file/{path}` - Serve individual .glsl shader files
  - Path is sanitized to prevent directory traversal
  - Returns: shader source code as text

- `GET /purz/shaders/custom/list` - List available custom shader files
  - Returns: `{ files: array<string> }`

## WebGL Shader Development

### Import Path for Extensions
When `WEB_DIRECTORY = "./web"` in `__init__.py`:
```javascript
import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
```

### GLSL WebGL 1.0 Limitations
WebGL 1.0 (most compatible) has restrictions:
- **No dynamic array indexing**: `array[variable]` fails, must use constants or loop indices
- **No integer division**: Use `float(x) / float(y)`
- **Loop bounds must be constant**: `for (int i = 0; i < 10; i++)` works, variable bounds don't

Example fix for dynamic indexing (bad → good):
```glsl
// BAD - won't compile
int idx = x >= 0 ? 1 : 0;
array[idx] += value;

// GOOD - unroll or restructure
if (x >= 0) { array1 += value; } else { array0 += value; }
```

### Texture Coordinate Y-Flip
WebGL has origin at bottom-left, images at top-left:
```javascript
// Flip Y only when loading source image
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageElement);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);  // Reset for framebuffers
```

### Multi-Pass Rendering (Ping-Pong)
For stacking multiple filter effects:
```javascript
let inputTexture = this.sourceTexture;
let pingPong = 0;

for (let i = 0; i < layers.length; i++) {
    const isLast = (i === layers.length - 1);

    // Render to framebuffer or screen
    if (isLast) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[pingPong].framebuffer);
    }

    // Render with inputTexture...

    if (!isLast) {
        inputTexture = this.framebuffers[pingPong].texture;
        pingPong = 1 - pingPong;  // Swap buffers
    }
}
```

### Preview Quality
Render canvas at higher resolution, use CSS to scale display:
```javascript
// Render at up to 1024px
const maxRenderSize = 1024;
canvas.width = renderW;   // High res
canvas.height = renderH;
canvas.style.width = displayW + "px";   // CSS scales down
canvas.style.height = displayH + "px";
```

## DOM Widgets in ComfyUI Nodes

### Adding Custom Widget
```javascript
const domWidget = this.addDOMWidget("widget_name", "preview", containerElement, {
    serialize: false,
    hideOnZoom: false,
});
domWidget.computeSize = (width) => [width, calculatedHeight];
```

### Auto-Resize Node Height
```javascript
function fitHeight(node) {
    node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]]);
    node?.graph?.setDirtyCanvas(true);
}
```

### Receiving Execution Results
```javascript
const onExecuted = nodeType.prototype.onExecuted;
nodeType.prototype.onExecuted = function(message) {
    if (onExecuted) onExecuted.apply(this, arguments);

    if (message?.purz_images?.length > 0) {
        const imgInfo = message.purz_images[0];
        // Load image from /view?filename=...&type=temp
    }
};
```

### Widget Cleanup and Disposal
Proper cleanup is essential to prevent memory leaks, especially for WebGL contexts.

**Track widget instances:**
```javascript
const widgetInstances = new Map();  // node.id -> widget instance
```

**Add onRemove handler to DOM widget:**
```javascript
domWidget.onRemove = () => {
    const instance = widgetInstances.get(node.id);
    if (instance) {
        instance.dispose();
        widgetInstances.delete(node.id);
    }
};
```

**Implement dispose() in widget class:**
```javascript
dispose() {
    // Stop animations
    this._stopAnimationLoop();
    this._stopPlayback();

    // Clean up WebGL
    if (this.engine) {
        this.engine.cleanup();
        this.engine = null;
    }

    // Clear caches
    this.loadedFrames = [];
    this.sourceImage = null;

    // Remove DOM
    if (this.container?.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
}
```

**FilterEngine.cleanup() releases WebGL resources:**
```javascript
cleanup() {
    const gl = this.gl;
    if (!gl) return;

    // Delete framebuffers and textures
    for (const fb of this.framebuffers) {
        gl.deleteFramebuffer(fb.framebuffer);
        gl.deleteTexture(fb.texture);
    }

    // Delete buffers and programs
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    for (const program of Object.values(this.programs)) {
        gl.deleteProgram(program);
    }

    // Lose context to free GPU memory
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) loseContext.loseContext();
}
```

## Planning & Roadmap

Development plans are tracked in `plan.md` at the project root. Keep `plan.md` and the Roadmap section in `README.md` synchronized when making updates to either.

## Documentation Requirements

### Changelog Management
- **CHANGELOG.md**: Track EVERY SINGLE CHANGE here, even ephemeral ones that may break things. Use Keep a Changelog format with [Unreleased] section at top.
- **README.md**: Update the Changelog section for version releases only (user-facing summary)
- When making any code change, add an entry to CHANGELOG.md immediately

### Version Updates
When releasing a new version:
1. Update `pyproject.toml` version
2. Move [Unreleased] items in CHANGELOG.md to new version section
3. Add summary to README.md Changelog section
4. Update any relevant feature documentation in README.md

## Video Batch Processing Architecture

### Backend-Frontend Synchronization
The Interactive Filter supports video batch processing with this flow:

1. **Backend signals waiting**: When `process()` is called with filters active, backend:
   - Sets `PURZ_BATCH_PENDING[node_id] = batch_size`
   - Sets `PURZ_BATCH_READY[node_id] = False`
   - Sends WebSocket event `purz.batch_pending` via `PromptServer.instance.send_sync()`
   - Enters polling loop waiting for `PURZ_BATCH_READY[node_id]` to become True

2. **Frontend processes frames**: Upon receiving event or via polling fallback:
   - Processes all frames through WebGL shaders
   - Uploads results in chunks (10 frames per request) to avoid size limits
   - Final chunk sets `is_final: true` which triggers `PURZ_BATCH_READY[node_id] = True`

3. **Backend continues**: Polling loop exits, retrieves rendered frames, outputs to workflow

### Key Implementation Details
- **Chunked uploads**: Required because aiohttp has ~1MB default request size limit. 96 frames of base64 PNG easily exceeds this.
- **Node ID type mismatch**: `app.graph._nodes_by_id` may use string or int keys. Always try both:
  ```javascript
  let node = app.graph._nodes_by_id[node_id];
  if (!node) node = app.graph._nodes_by_id[parseInt(node_id)];
  ```
- **Polling fallback**: WebSocket events may not arrive reliably. `onExecuted` includes 500ms delayed poll to `/purz/interactive/batch_pending/{node_id}` as backup.
- **Skip waiting when no filters**: If no filter layers are active, backend returns input directly without waiting for frontend.

### Global State Dictionaries
```python
PURZ_FILTER_LAYERS = {}      # Filter layer config per node
PURZ_RENDERED_IMAGES = {}    # Rendered frames from frontend
PURZ_BATCH_PENDING = {}      # Number of frames backend is waiting for
PURZ_BATCH_READY = {}        # Flag set True when all chunks received
```

## External Shader System

### Effect Categories (120+ total effects)
- **Basic** (16): Desaturate, Brightness, Contrast, Exposure, Gamma, Vibrance, Saturation, Lift, Gain, Offset, Auto Contrast, Normalize, Equalize, Solarize, Fade, Cross Process
- **Color** (15): Hue Shift, Temperature, Tint, Colorize, Channel Mixer, Split Tone, Color Balance, Selective Color, HSL Adjust, Gradient Map, Color Lookup, Vibrance Pro, RGB Curves, CMYK Adjust, Color Harmony
- **Tone** (16): Highlights, Shadows, Whites, Blacks, Levels, Curves, Tone Curve, HDR Tone, Shadow Recovery, Highlight Recovery, Midtone Contrast, Luminosity Mask, Zone System, Dynamic Range, Tone Split, Local Contrast
- **Detail** (15): Blur, Sharpen, Unsharp Mask, Clarity, Dehaze, High Pass, Low Pass, Bilateral Filter, Surface Blur, Smart Sharpen, Micro Contrast, Texture Enhance, Noise Reduction, Detail Extract, Frequency Separation
- **Effects** (17): Vignette, Grain, Posterize, Threshold, Invert, Sepia, Duotone, Light Leak, Lens Flare, Bokeh, Film Burn, Scratch, Dust, Water Droplets, Frosted Glass, Heat Distortion, CRT Scanlines
- **Artistic** (14): Emboss, Edge Detect, Sketch, Oil Paint, Watercolor, Pencil Sketch, Charcoal, Woodcut, Linocut, Pop Art, Comic Book, Stained Glass, Mosaic, Pointillism
- **Creative** (14): Pixelate, Chromatic Aberration, Glitch, Halftone, Mirror, Kaleidoscope, Tunnel, Ripple, Wave Distortion, Twirl, Spherize, Pinch, Stretch, Fisheye
- **Lens** (13): Lens Distortion, Tilt Shift, Radial Blur, Depth of Field, Focus Stack, Miniature, Anamorphic, Barrel Distortion, Pincushion, Mustache Distortion, CA Red/Cyan, CA Blue/Yellow, Lens Vignette

### Architecture
The Interactive Filter uses a hybrid shader approach:
- **Built-in shaders**: ~40 core effects defined inline in `EFFECT_SHADERS` object for reliability (no network latency)
- **External shaders**: 80+ additional effects loaded from `shaders/` directory via `effects.json` manifest (marked with `isCustom: true`)
- **User custom shaders**: Created in `shaders/custom/` directory, auto-discovered at startup

### Directory Structure
```
shaders/
├── effects.json          # Master manifest with effect metadata
├── core/                 # Shared shaders (vertex, passthrough)
├── basic/                # Basic effects (desaturate, brightness, etc.)
├── color/                # Color effects (hue, temperature, etc.)
├── tone/                 # Tone effects (highlights, shadows, etc.)
├── detail/               # Detail effects (blur, sharpen, etc.)
├── effects/              # Visual effects (vignette, grain, etc.)
├── artistic/             # Artistic effects (emboss, sketch, etc.)
├── creative/             # Creative effects (pixelate, glitch, etc.)
├── lens/                 # Lens effects (distortion, tilt shift, etc.)
└── custom/               # User-created effects
    └── _template.glsl    # Template for creating new effects
```

### Backend Endpoints
- `GET /purz/shaders/manifest` - Returns effects.json merged with custom effects
- `GET /purz/shaders/file/{path}` - Serves individual .glsl files (path-secured)
- `GET /purz/shaders/custom/list` - Lists custom shader files

### Frontend Shader Loading
```javascript
// CustomShaderLoader module handles dynamic loading
await CustomShaderLoader.loadManifest();  // Fetches manifest + discovers custom effects
const effect = await CustomShaderLoader.getEffect("myeffect");  // Loads shader source

// FilterEngine compiles on demand
this.filterEngine.loadCustomShader(effectKey, shaderSource);
```

### Creating Custom Effects
1. Copy `shaders/custom/_template.glsl` to `shaders/custom/myeffect.glsl`
2. Edit shader code (WebGL 1.0 GLSL)
3. Optionally create `shaders/custom/myeffect.json` for custom params:
   ```json
   {
     "name": "My Effect",
     "category": "Custom",
     "params": [
       { "name": "amount", "label": "Amount", "min": 0, "max": 1, "default": 0.5, "step": 0.01 }
     ]
   }
   ```
4. Restart ComfyUI - effect appears in the dropdown under "Custom" category

### Key Implementation Patterns
- **Async layer operations**: `_addLayer()` and `_loadPreset()` are async to support shader loading
- **Effect definition abstraction**: `_getEffectDef(key)` checks both `EFFECTS` and `CustomShaderLoader.customEffects`
- **On-demand compilation**: Custom shaders are compiled only when first used
- **Cached shader source**: `CustomShaderLoader.shaderCache` prevents redundant fetches
- **isCustom flag**: Effects in `effects.json` must have `"isCustom": true` to be loaded by `CustomShaderLoader`

### Batch Processing with Custom Shaders
When processing video batches, a separate `FilterEngine` is created for batch processing. This engine only compiles built-in shaders by default. Custom shaders must be pre-compiled before batch processing:

```javascript
// In _processBatchWebGL() before processing frames:
for (const layer of this.layers) {
    if (layer.enabled && CustomShaderLoader.isCustomEffect(layer.effect)) {
        const effect = await CustomShaderLoader.getEffect(layer.effect);
        if (effect && effect.shader) {
            batchEngine.loadCustomShader(layer.effect, effect.shader);
        }
    }
}
```

Without this pre-compilation, custom effects render black frames because `batchEngine.programs[effectKey]` returns undefined.

## Preset System

### Built-in Presets (40+)
**Built-in presets live in `web/js/purz_preset_manager.js`** as inline JavaScript data — not as JSON files. They ship with the frontend bundle and load instantly.

**User-saved custom presets** are written to the `presets/` directory at the root of this node pack as JSON files. When a user clicks Save in the Interactive Filter UI, a JSON file is created here. These files can be lost during uninstall/reinstall, so users should back them up. The README.md warns users about this.

Built-in preset categories (defined in `purz_preset_manager.js`):
- **Film**: Classic, Vintage Film, Cinematic, Noir, etc.
- **Portrait**: Soft Skin, Warm Portrait, Cool Portrait, etc.
- **Landscape**: Vivid Nature, Golden Hour, Misty Morning, etc.
- **Black & White**: High Contrast B&W, Film Noir B&W, Soft B&W, etc.
- **Mood**: Dreamy, Moody Blue, Warm Sunset, etc.
- **Creative**: Cross Process, Duotone Pop, Retro Gaming, etc.
- **Cinematic** (v1.5.0): Blockbuster, Noir Modern, Sci-Fi, Horror
- **Vintage** (v1.5.0): Kodachrome, Polaroid, 70s, Daguerreotype
- **Stylized** (v1.5.0): Neon Nights, Anime, Watercolor Dream, Comic
- **Enhancement** (v1.5.0): Portrait Pro, Landscape HDR, Detail Pop, Auto Fix

### Preset File Format
```json
{
  "name": "Preset Name",
  "category": "Category",
  "layers": [
    { "effect": "effectKey", "opacity": 100, "enabled": true, "params": { "param1": 0.5 } }
  ]
}
```

### Layer Reordering (v1.5.0)
Effect layers can be reordered via drag and drop:
- Drag handle (⋮⋮) on each layer initiates drag
- Visual drop indicators (blue border) show insertion point
- Layers are applied in order from top to bottom

### Checkbox Parameters
Effects can define checkbox (boolean) parameters:
```javascript
// In effect definition
params: [
    { name: "amount", label: "Amount", min: 0, max: 1, default: 0.5, step: 0.01 },
    { name: "animate", label: "Animate", type: "checkbox", default: false }
]
```

The UI builder in `_createLayerElement()` detects `type: "checkbox"` and renders a checkbox instead of a slider. Checkbox params are stored as boolean in `layer.params`.

### Animated Effects (Preview Animation Loop)
For effects that should animate in the preview (like animated grain):

```javascript
// State variables in constructor
this.animationFrameId = null;
this.animationTime = 0;

// Check if any layer needs animation
_hasAnimatedLayers() {
    return this.layers.some(l => l.enabled && l.params.animate);
}

// Start/stop loop based on animate flags
_updateAnimationLoop() {
    const needsAnimation = this._hasAnimatedLayers();
    if (needsAnimation && !this.animationFrameId) {
        this._startAnimationLoop();
    } else if (!needsAnimation && this.animationFrameId) {
        this._stopAnimationLoop();
    }
}

// Animation loop updates seeds and re-renders
_startAnimationLoop() {
    const animate = (timestamp) => {
        if (!this._hasAnimatedLayers()) {
            this._stopAnimationLoop();
            return;
        }
        // Update seeds for animated layers
        for (const layer of this.layers) {
            if (layer.enabled && layer.params.animate && layer.params.seed !== undefined) {
                layer.params.seed += (timestamp - this.animationTime) * 0.1;
            }
        }
        this.animationTime = timestamp;
        this.engine.render(this.layers);
        this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
}
```

For batch processing, seeds are varied per frame:
```javascript
// Store original seeds before batch loop
const originalSeeds = {};
for (const layer of this.layers) {
    if (layer.params.seed !== undefined) {
        originalSeeds[layer.id] = layer.params.seed;
    }
}

// In batch loop, update seeds for animated layers
for (const layer of this.layers) {
    if (layer.enabled && layer.params.animate && originalSeeds[layer.id] !== undefined) {
        layer.params.seed = originalSeeds[layer.id] + frameIndex * 100;
    }
}

// Restore after batch completes
```
