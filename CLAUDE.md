# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ComfyUI-Purz is a custom node pack for ComfyUI providing image effects, pattern generation, and animated pattern creation. It is installed as a custom node in ComfyUI's `custom_nodes/` directory.

## Architecture

### Node Registration System
- `__init__.py` exports `NODE_CLASS_MAPPINGS` and `NODE_DISPLAY_NAME_MAPPINGS` from `nodes.py`
- `nodes.py` aggregates node mappings from three source modules
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

## Dependencies
- PyTorch >= 1.9.0
- NumPy >= 1.19.0
- Pillow >= 8.0.0
- OpenCV (opencv-python) >= 4.5.0
- Optional: scipy (for smooth noise interpolation, falls back to manual implementation)

## Development

Install dependencies:
```bash
pip install -r requirements.txt
```

Test by loading ComfyUI - nodes appear under the "Purz/" category hierarchy.

## Frontend JavaScript Extensions

To add custom UI widgets/interactions:

1. Create `web/js/` directory in the node pack
2. Export `WEB_DIRECTORY = "./web/js"` in `__init__.py`
3. Register extensions using:
```javascript
import { app } from "../../scripts/app.js";
app.registerExtension({
    name: "purz.extensionname",
    async setup() { /* initialization */ },
    async beforeRegisterNodeDef(nodeType, nodeData, app) { /* modify node behavior */ }
});
```

Backend-to-frontend messaging:
- Backend: `PromptServer.instance.send_sync("event.type", {"data": value})`
- Frontend: `app.api.addEventListener("event.type", handler)` receives in `event.detail`

For Nodes 2.0 (Vue-based): v3 schema is in development, will allow Vue widgets without JS. Current approach works with both legacy and Nodes 2.0.

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
