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

**Project Stats**: ~1400 lines of Python, ~3500 lines of JavaScript, 120+ GLSL shader effects

## Architecture

### File Structure
```
ComfyUI-Purz/
├── __init__.py                   # Entry point, exports NODE_CLASS_MAPPINGS and WEB_DIRECTORY
├── nodes.py                      # Aggregates all node mappings from source modules
├── image_effects.py              # Traditional image processing nodes
├── pattern_generators.py         # Static pattern generation nodes
├── animated_patterns.py          # Animated pattern nodes with math utilities
├── interactive_filters.py        # Interactive filter node with backend API and filter implementations
├── web/
│   └── js/
│       └── purz_interactive.js   # Frontend WebGL renderer, UI, and batch processing
├── shaders/
│   ├── effects.json              # Shader manifest with metadata
│   ├── core/                     # Shared vertex/passthrough shaders
│   ├── basic/, color/, tone/, detail/, effects/, artistic/, creative/, lens/
│   │   └── *.glsl                # Categorized shader effect files
│   └── custom/
│       ├── _template.glsl        # Template for creating custom effects
│       └── *.glsl                # User-created custom shaders
├── presets/
│   └── *.json                    # Built-in and user-saved presets
├── pyproject.toml                # Project metadata and version
├── requirements.txt              # Python dependencies
├── CLAUDE.md                     # This file - development guidance for AI assistants
├── CHANGELOG.md                  # All changes (including ephemeral)
├── README.md                     # User-facing documentation
├── plan.md                       # Development roadmap
└── painpoints.md                 # Documentation gaps and development challenges
```

### Node Registration System
- `__init__.py` exports `NODE_CLASS_MAPPINGS` and `NODE_DISPLAY_NAME_MAPPINGS` from `nodes.py`
- `nodes.py` aggregates node mappings from four source modules (`image_effects`, `pattern_generators`, `animated_patterns`, `interactive_filters`)
- Each source module defines its own `*_NODE_CLASS_MAPPINGS` and `*_NODE_DISPLAY_NAME_MAPPINGS` dicts

### Source Modules

**image_effects.py** - Image processing nodes (Purz/Image/* categories)
- Color: Black & white conversion, color adjustment (brightness/contrast/saturation)
- Transform: Rotation, flip/mirror
- Effects: Blur (gaussian/box/motion), pixelate, edge detection (sobel/canny/laplacian)

**pattern_generators.py** - Static pattern generation nodes (Purz/Patterns/Basic, Purz/Patterns/Noise)
- Checkerboard, stripes, polka dots, grid, gradient, hexagon, noise patterns
- All patterns support batch_size for multiple output images

**animated_patterns.py** - Animated pattern nodes (Purz/Patterns/Animated)
- Contains mathematical utility classes: `TextureMath`, `ColorRamp`, `WaveTextureGenerator`, `PatternTextureGenerator`
- Animated versions of checkerboard, stripes, polka dots, and noise
- Supports wave modulation with configurable wave types, directions, and math operations
- frame_count parameter controls animation length

### ComfyUI Node Structure
Each node class follows this pattern:
- `INPUT_TYPES` classmethod defines parameters with types and constraints
- `RETURN_TYPES` tuple specifies output types (usually `("IMAGE",)`)
- `FUNCTION` string names the processing method
- `CATEGORY` string sets the node's location in ComfyUI menu
- Processing methods return tuple of outputs

### Image Format
ComfyUI images are PyTorch tensors in format `[batch, height, width, channels]` with float32 values in 0-1 range.

**Important**: When converting between formats:
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
1. Edit Python node code in `image_effects.py`, `pattern_generators.py`, `animated_patterns.py`, or `interactive_filters.py`
2. For frontend changes, edit `web/js/purz_interactive.js`
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

### Current Status
- **Nodes 2.0** is the new Vue-based rendering system (toggle in ComfyUI menu)
- **V3 Schema** is documented for **backend only** (Python node definitions)
- **No frontend migration guide exists** - our DOM widget approach may or may not work

### V3 Backend Changes (for future reference)
**Docs**: https://docs.comfy.org/custom-nodes/v3_migration

| Aspect | V1 (Current) | V3 |
|--------|--------------|-----|
| Base class | Generic | `io.ComfyNode` |
| Schema | `INPUT_TYPES()` | `define_schema()` returning `Schema` |
| Returns | `RETURN_TYPES` tuple | `outputs` in Schema |
| Cache control | `IS_CHANGED()` | `fingerprint_inputs()` |
| Execution | Custom function name | `execute()` method |

**We currently use V1 patterns.** V3 migration is optional but may become required.

### What We Don't Know About Nodes 2.0
- Does `addDOMWidget()` work?
- Do our event propagation hacks work?
- Is there a Vue-native widget system?
- When will legacy patterns break?

See `painpoints.md` for full discussion of documentation gaps.

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

### Key Files
- `interactive_filters.py` - Python backend with filter implementations and API routes
- `web/js/purz_interactive.js` - JavaScript frontend with WebGL shaders and UI

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
@classmethod
def IS_CHANGED(cls, image, **kwargs):
    return float("nan")  # NaN always triggers re-execution
```

#### Hidden Parameters
Access node ID and other metadata via hidden inputs:
```python
@classmethod
def INPUT_TYPES(cls):
    return {
        "required": { "image": ("IMAGE",) },
        "hidden": {
            "unique_id": "UNIQUE_ID",  # Node's unique ID
            "prompt": "PROMPT",
            "extra_pnginfo": "EXTRA_PNGINFO",
        }
    }
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

## Backend API Endpoints

All Interactive Filter backend endpoints are registered in `interactive_filters.py`:

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
Presets are stored as JSON files in the `presets/` directory and organized by category.

**Important**: User-saved custom presets are also stored in `presets/` directory at the root of this node pack. When a user saves a preset in the Interactive Filter UI, it creates a JSON file here. These files may be lost during uninstall/reinstall, so users should back them up. The README.md warns users about this.
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
