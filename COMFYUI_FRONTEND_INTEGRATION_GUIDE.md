# ComfyUI Custom Node Frontend Integration Guide

A comprehensive guide for implementing frontend JavaScript/TypeScript extensions for ComfyUI custom nodes, compatible with both the **legacy frontend** and the **new Vue-based frontend**.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Python Backend Setup](#python-backend-setup)
5. [Frontend Extension Development](#frontend-extension-development)
6. [TypeScript Build Configuration](#typescript-build-configuration)
7. [ComfyUI API Integration](#comfyui-api-integration)
8. [DOM Widget Pattern](#dom-widget-pattern)
   - [Node Cleanup and Disposal](#node-cleanup-and-disposal)
9. [Communication Between Python and JavaScript](#communication-between-python-and-javascript)
10. [Styling Best Practices](#styling-best-practices)
11. [Complete Example](#complete-example)
12. [Testing and Debugging](#testing-and-debugging)

---

## Overview

ComfyUI supports custom frontend extensions that can:
- Add custom widgets to nodes (3D viewers, image editors, graphs, etc.)
- Listen to execution events and update UI dynamically
- Sync state bidirectionally between sliders/inputs and custom widgets
- Inject custom CSS styles
- Support internationalization (i18n)

**Key Compatibility Note:** The approach documented here works with both:
- **Legacy frontend** (the original ComfyUI web interface)
- **New Vue-based frontend** (the modern ComfyUI interface)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ComfyUI Frontend                         │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │   app.js         │    │   api.js         │              │
│  │  (LiteGraph)     │    │  (WebSocket API) │              │
│  └────────┬─────────┘    └────────┬─────────┘              │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌────────────────────────────────────────────┐            │
│  │          Your Extension (main.js)          │            │
│  │  - app.registerExtension()                 │            │
│  │  - api.addEventListener('executed', ...)   │            │
│  │  - node.addDOMWidget()                     │            │
│  └────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Python Backend                           │
│  ┌──────────────────────────────────────────────┐          │
│  │  __init__.py                                 │          │
│  │  - Register js directory                     │          │
│  │  - nodes.EXTENSION_WEB_DIRS["name"] = path   │          │
│  └──────────────────────────────────────────────┘          │
│  ┌──────────────────────────────────────────────┐          │
│  │  nodes.py                                    │          │
│  │  - Node classes with OUTPUT_NODE = True      │          │
│  │  - Return {"ui": {...}, "result": (...)}     │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
ComfyUI/custom_nodes/your-node-pack/
├── __init__.py              # Python: Register JS directory + node mappings
├── nodes.py                 # Python: Node class definitions
├── requirements.txt         # Python dependencies
├── package.json             # Node.js: Build dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.mts          # Vite bundler configuration
├── src/                     # TypeScript source files
│   ├── main.ts              # Extension entry point
│   ├── MyWidget.ts          # Custom widget class
│   ├── types.ts             # TypeScript interfaces
│   └── styles.ts            # CSS styles as template literals
└── js/                      # Compiled output (served to browser)
    ├── main.js              # Bundled JavaScript
    └── main.js.map          # Source map for debugging
```

---

## Python Backend Setup

### `__init__.py` - Registering the JavaScript Directory

```python
"""
Your Node Pack: Description here
"""

import os
import nodes

# CRITICAL: Register the js directory for web extensions
# This makes ComfyUI serve your JS files to the browser
custom_node_dir = os.path.dirname(os.path.realpath(__file__))
js_dir = os.path.join(custom_node_dir, "js")
nodes.EXTENSION_WEB_DIRS["YourNodePackName"] = js_dir

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
```

**Key Points:**
- The `nodes.EXTENSION_WEB_DIRS` dictionary maps extension names to JS directories
- ComfyUI will automatically serve files from this directory at `/extensions/YourNodePackName/`
- The extension name should be unique to avoid conflicts

### `nodes.py` - Node with UI Output

To send data from Python to your frontend widget, use the `OUTPUT_NODE = True` flag and return a dictionary with `"ui"` and `"result"` keys:

```python
class MyCustomNode:
    """Node that sends data to frontend widget"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": ("INT", {"default": 0, "min": 0, "max": 100}),
            },
            "optional": {
                "image": ("IMAGE",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",  # Get node's unique ID
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("output",)
    FUNCTION = "process"
    CATEGORY = "MyCategory"
    OUTPUT_NODE = True  # IMPORTANT: Required to send UI data

    def process(self, value, image=None, unique_id=None):
        result = f"Processed: {value}"

        # Convert image to base64 for frontend (if needed)
        image_base64 = ""
        if image is not None:
            import base64
            import io
            from PIL import Image
            import numpy as np

            img_np = image[0].cpu().numpy()
            img_np = (np.clip(img_np, 0, 1) * 255).astype(np.uint8)
            pil_image = Image.fromarray(img_np)

            buffer = io.BytesIO()
            pil_image.save(buffer, format="PNG")
            image_base64 = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("utf-8")

        # Return BOTH ui data AND the actual result
        return {
            "ui": {
                "my_custom_data": [value],           # Will be in event.detail.output.my_custom_data
                "image_base64": [image_base64],      # Will be in event.detail.output.image_base64
            },
            "result": (result,)  # The actual node output
        }

    @classmethod
    def IS_CHANGED(cls, value, image=None, unique_id=None):
        """Return unique hash to control when node re-executes"""
        import hashlib
        img_hash = ""
        if image is not None:
            img_hash = hashlib.md5(image[0].cpu().numpy().tobytes()).hexdigest()
        return f"{value}_{img_hash}"


NODE_CLASS_MAPPINGS = {
    "MyCustomNode": MyCustomNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MyCustomNode": "My Custom Node",
}
```

**Important:**
- `OUTPUT_NODE = True` is required for the `"ui"` data to be sent to the frontend
- The `"result"` key contains the actual outputs that go to other nodes
- The `"ui"` key contains data sent to the frontend via WebSocket
- Arrays are used in `"ui"` for batch compatibility: `[value]` not `value`

---

## Frontend Extension Development

### `src/main.ts` - Extension Entry Point

```typescript
import { app } from '../../../scripts/app.js'
import { api } from '../../../scripts/api.js'
import { MyWidget } from './MyWidget'
import type { MyNode, DOMWidget } from './types'

// Store widget instances for cleanup
const widgetInstances = new Map<number, MyWidget>()

function createWidget(node: MyNode): { widget: DOMWidget } {
  // Create container element
  const container = document.createElement('div')
  container.id = `my-widget-${node.id}`
  container.style.width = '100%'
  container.style.height = '100%'
  container.style.minHeight = '200px'

  // Get initial values from existing node widgets (sliders, etc.)
  const getWidgetValue = (name: string, defaultValue: number): number => {
    const widget = node.widgets?.find(w => w.name === name)
    return widget ? Number(widget.value) : defaultValue
  }

  const initialValue = getWidgetValue('value', 0)

  // Create DOM widget using ComfyUI's API
  const widget = node.addDOMWidget(
    'my_widget_preview',     // Widget name
    'my-widget-type',        // Widget type identifier
    container,               // DOM element
    {
      getMinHeight: () => 220,  // Minimum height callback
      hideOnZoom: false,        // Keep visible when zoomed out
      serialize: false          // Don't save widget state to workflow
    }
  ) as DOMWidget

  // Create the actual widget after container is mounted
  setTimeout(() => {
    const myWidget = new MyWidget({
      node,
      container,
      initialValue,
      onValueChange: (newValue: number) => {
        // Update the original slider widget when our widget changes
        const valueWidget = node.widgets?.find(w => w.name === 'value')
        if (valueWidget) {
          valueWidget.value = newValue
        }
        // Force canvas refresh
        app.graph?.setDirtyCanvas(true, true)
      }
    })

    widgetInstances.set(node.id, myWidget)

    // Sync: When slider changes, update our widget
    const setupWidgetSync = (widgetName: string) => {
      const w = node.widgets?.find(widget => widget.name === widgetName)
      if (w) {
        const origCallback = w.callback
        w.callback = (value: unknown) => {
          if (origCallback) origCallback.call(w, value)
          myWidget.setValue(Number(value))
        }
      }
    }
    setupWidgetSync('value')
  }, 100)

  // Cleanup when node is removed
  widget.onRemove = () => {
    const instance = widgetInstances.get(node.id)
    if (instance) {
      instance.dispose()
      widgetInstances.delete(node.id)
    }
  }

  return { widget }
}

// Register the extension with ComfyUI
app.registerExtension({
  name: 'ComfyUI.MyExtension',

  // Called when any node is created
  nodeCreated(node: MyNode) {
    // Only handle our specific node type
    if (node.constructor?.comfyClass !== 'MyCustomNode') {
      return
    }

    // Adjust default node size
    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 400)])

    // Create the custom widget
    createWidget(node)
  }
})

// Listen for node execution results (data from Python's "ui" dict)
api.addEventListener('executed', (event: CustomEvent) => {
  const detail = event.detail
  if (!detail?.node || !detail?.output) return

  const nodeId = parseInt(detail.node, 10)
  const widget = widgetInstances.get(nodeId)
  if (!widget) return

  // Access the ui data sent from Python
  const myData = detail.output?.my_custom_data as number[] | undefined
  const imageBase64 = detail.output?.image_base64 as string[] | undefined

  if (myData && myData.length > 0) {
    widget.setValue(myData[0])
  }

  if (imageBase64 && imageBase64.length > 0 && imageBase64[0]) {
    widget.updateImage(imageBase64[0])
  }
})

export { MyWidget }
```

### `src/types.ts` - TypeScript Interfaces

```typescript
import type { LGraphNode } from '@comfyorg/comfyui-frontend-types'

export interface MyNode extends LGraphNode {
  widgets?: Array<{
    name: string
    value: unknown
    callback?: (value: unknown) => void
  }>
}

export interface DOMWidgetOptions {
  getMinHeight?: () => number
  hideOnZoom?: boolean
  serialize?: boolean
}

export interface DOMWidget {
  name: string
  type: string
  element: HTMLElement
  options: DOMWidgetOptions
  onRemove?: () => void
  serializeValue?: () => Promise<string> | string
}

export interface MyWidgetOptions {
  node: LGraphNode
  container: HTMLElement
  initialValue?: number
  onValueChange?: (value: number) => void
}
```

### `src/MyWidget.ts` - Custom Widget Class

```typescript
import type { MyWidgetOptions } from './types'
import { injectStyles } from './styles'

export class MyWidget {
  private container: HTMLElement
  private value: number
  private onValueChange?: (value: number) => void
  private display!: HTMLElement

  constructor(options: MyWidgetOptions) {
    injectStyles()  // Inject CSS once

    this.container = options.container
    this.value = options.initialValue ?? 0
    this.onValueChange = options.onValueChange

    this.createDOM()
    this.bindEvents()
    this.updateDisplay()
  }

  private createDOM(): void {
    this.container.innerHTML = `
      <div class="my-widget-container">
        <div class="my-widget-display">0</div>
        <button class="my-widget-btn increase">+</button>
        <button class="my-widget-btn decrease">-</button>
      </div>
    `

    this.display = this.container.querySelector('.my-widget-display') as HTMLElement
  }

  private bindEvents(): void {
    const increaseBtn = this.container.querySelector('.increase')
    const decreaseBtn = this.container.querySelector('.decrease')

    increaseBtn?.addEventListener('click', () => {
      this.value = Math.min(100, this.value + 1)
      this.updateDisplay()
      this.notifyChange()
    })

    decreaseBtn?.addEventListener('click', () => {
      this.value = Math.max(0, this.value - 1)
      this.updateDisplay()
      this.notifyChange()
    })
  }

  private updateDisplay(): void {
    this.display.textContent = String(this.value)
  }

  private notifyChange(): void {
    if (this.onValueChange) {
      this.onValueChange(this.value)
    }
  }

  // Public API
  public setValue(newValue: number): void {
    this.value = newValue
    this.updateDisplay()
  }

  public getValue(): number {
    return this.value
  }

  public updateImage(url: string | null): void {
    // Handle image updates from backend
  }

  public dispose(): void {
    // Cleanup resources
    this.container.innerHTML = ''
  }
}
```

### `src/styles.ts` - CSS Injection

```typescript
export const WIDGET_STYLES = `
  .my-widget-container {
    width: 100%;
    height: 100%;
    background: #1a1a2e;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .my-widget-display {
    font-size: 48px;
    font-weight: bold;
    color: #E93D82;
  }

  .my-widget-btn {
    padding: 8px 24px;
    border: 1px solid #E93D82;
    background: transparent;
    color: #E93D82;
    border-radius: 4px;
    cursor: pointer;
    font-size: 18px;
    transition: background 0.2s;
  }

  .my-widget-btn:hover {
    background: rgba(233, 61, 130, 0.2);
  }
`

export function injectStyles(): void {
  // Prevent duplicate injection
  if (document.getElementById('my-widget-styles')) {
    return
  }

  const style = document.createElement('style')
  style.id = 'my-widget-styles'
  style.textContent = WIDGET_STYLES
  document.head.appendChild(style)
}
```

---

## TypeScript Build Configuration

### `package.json`

```json
{
  "name": "your-node-pack",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@comfyorg/comfyui-frontend-types": "^1.35.4",
    "@types/node": "^22.10.1",
    "typescript": "^5.7.2",
    "vite": "^6.3.5"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"]
}
```

### `vite.config.mts`

```typescript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, './src/main.ts'),
      formats: ['es'],
      fileName: 'main'
    },
    rollupOptions: {
      // CRITICAL: Mark ComfyUI scripts as external
      // These are provided by ComfyUI at runtime
      external: [
        '../../../scripts/app.js',
        '../../../scripts/api.js'
      ],
      output: {
        dir: 'js',
        entryFileNames: 'main.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    sourcemap: true,
    minify: false  // Keep readable for debugging
  }
})
```

**Key Points:**
- Mark `app.js` and `api.js` as external - they're provided by ComfyUI
- Output to `js/` directory which is registered in Python
- Use ES module format (`formats: ['es']`)
- Enable sourcemaps for debugging

---

## ComfyUI API Integration

### Available APIs

```typescript
// Import from ComfyUI's script files (relative path from js/ folder)
import { app } from '../../../scripts/app.js'
import { api } from '../../../scripts/api.js'
```

### `app` Object

```typescript
// Register your extension
app.registerExtension({
  name: 'ComfyUI.MyExtension',

  // Called when extension loads
  async setup() {
    console.log('Extension setup')
  },

  // Called when any node is created
  nodeCreated(node) {
    if (node.constructor?.comfyClass === 'MyCustomNode') {
      // Initialize your widget
    }
  },

  // Called before node definition is registered
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    // Modify node definition before registration
  }
})

// Force canvas redraw
app.graph?.setDirtyCanvas(true, true)

// Access UI settings
const locale = app.ui?.settings?.getSettingValue?.('Comfy.Locale')
```

### `api` Object

```typescript
// Listen to execution events
api.addEventListener('executed', (event: CustomEvent) => {
  const nodeId = event.detail.node      // Node ID as string
  const output = event.detail.output    // The "ui" dict from Python

  // Access your custom data
  const myData = output?.my_custom_data
})

// Other events
api.addEventListener('executing', (event) => { /* node starting */ })
api.addEventListener('progress', (event) => { /* progress update */ })
api.addEventListener('status', (event) => { /* queue status */ })
```

---

## DOM Widget Pattern

### Adding a DOM Widget to a Node

```typescript
const widget = node.addDOMWidget(
  'widget_name',           // Internal name
  'widget-type',           // Type identifier
  containerElement,        // HTMLElement
  {
    getMinHeight: () => 200,   // Minimum height
    hideOnZoom: false,         // Visible when zoomed out
    serialize: false           // Don't save to workflow JSON
  }
)

// Cleanup callback
widget.onRemove = () => {
  // Dispose resources
}
```

### Node Cleanup and Disposal

When a node is deleted from the canvas, you must properly clean up resources to prevent memory leaks and errors. There are two approaches:

**Approach 1: Using `widget.onRemove` (simpler)**

```typescript
const widget = node.addDOMWidget('name', 'type', container, options)

widget.onRemove = () => {
  const instance = widgetInstances.get(node.id)
  if (instance) {
    instance.dispose()  // Your cleanup method
    widgetInstances.delete(node.id)
  }
}
```

**Approach 2: Using `node.onRemoved` (more control)**

Use this when you need to clean up resources not tied to a specific widget:

```typescript
// Store the original handler
const originalOnRemoved = node.onRemoved

// Override with cleanup logic
node.onRemoved = function() {
  const widget = widgetInstances.get(this)
  if (widget) {
    widget.dispose()  // Call your cleanup method
    widgetInstances.delete(this)
  }

  // Call original handler if it existed
  if (originalOnRemoved) {
    originalOnRemoved.call(this)
  }
}
```

**Important:** Use a `WeakMap` for storing widget instances when keying by node object:

```typescript
// WeakMap allows garbage collection when node is removed
const widgetInstances = new WeakMap<LGraphNode, MyWidget>()
```

**Your widget class should implement a `dispose()` method:**

```typescript
export class MyWidget {
  private animationId: number | null = null
  private keyHandler: (e: KeyboardEvent) => void

  constructor() {
    this.keyHandler = this.handleKeyDown.bind(this)
    document.addEventListener('keydown', this.keyHandler)
  }

  public dispose(): void {
    // Remove event listeners
    document.removeEventListener('keydown', this.keyHandler)

    // Cancel any animations
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    // Clear DOM
    this.container.innerHTML = ''

    // Release any other resources (WebGL contexts, etc.)
  }
}
```

### Syncing with Native Widgets

```typescript
// When your widget changes, update the slider
onMyWidgetChange(newValue) {
  const slider = node.widgets?.find(w => w.name === 'my_slider')
  if (slider) {
    slider.value = newValue
  }
  app.graph?.setDirtyCanvas(true, true)  // Refresh display
}

// When slider changes, update your widget
const slider = node.widgets?.find(w => w.name === 'my_slider')
if (slider) {
  const origCallback = slider.callback
  slider.callback = (value) => {
    if (origCallback) origCallback.call(slider, value)
    myWidget.setValue(Number(value))
  }
}
```

---

## Communication Between Python and JavaScript

### Python to JavaScript (via `"ui"` dict)

**Python (nodes.py):**
```python
OUTPUT_NODE = True  # Required!

def process(self, ...):
    return {
        "ui": {
            "my_data": [42],            # Use arrays for batch compat
            "my_string": ["hello"],
            "my_image": [base64_string]
        },
        "result": (output,)
    }
```

**JavaScript (main.ts):**
```typescript
api.addEventListener('executed', (event: CustomEvent) => {
  const output = event.detail.output
  const myData = output?.my_data?.[0]        // 42
  const myString = output?.my_string?.[0]    // "hello"
  const myImage = output?.my_image?.[0]      // base64 string
})
```

### JavaScript to Python (via widget values)

Modify native widget values; they'll be passed to Python on next execution:

```typescript
const slider = node.widgets?.find(w => w.name === 'my_value')
if (slider) {
  slider.value = 50  // This goes to Python as my_value=50
}
```

---

## Styling Best Practices

1. **Prefix all CSS classes** to avoid conflicts:
   ```css
   .my-extension-container { }
   .my-extension-button { }
   ```

2. **Inject styles once** using a guard:
   ```typescript
   if (document.getElementById('my-styles')) return
   ```

3. **Use CSS variables** for theming (optional):
   ```css
   .my-widget {
     background: var(--comfy-input-bg, #1a1a2e);
     color: var(--input-text, #e0e0e0);
   }
   ```

4. **Handle dark mode** - ComfyUI is dark by default

---

## Complete Example

See the **ComfyUI-qwenmultiangle** node pack for a production example:
- Location: `ComfyUI/custom_nodes/ComfyUI-qwenmultiangle/`
- Features: Three.js 3D scene, bidirectional sync, i18n, image display

---

## Testing and Debugging

### Build Commands

```bash
# Install dependencies
npm install

# Build once
npm run build

# Watch mode (rebuild on changes)
npm run dev

# Type check
npm run typecheck
```

### Debugging Tips

1. **Browser DevTools**: Open Console to see errors
2. **Source maps**: Enable in vite config for TypeScript debugging
3. **Console logging**: Add `console.log` statements
4. **Check network tab**: Verify JS files are loaded from `/extensions/YourName/`

### Common Issues

| Issue | Solution |
|-------|----------|
| JS not loading | Check `EXTENSION_WEB_DIRS` registration in `__init__.py` |
| Widget not appearing | Verify `nodeCreated` checks `comfyClass` correctly |
| No data from Python | Add `OUTPUT_NODE = True` to node class |
| Type errors | Install `@comfyorg/comfyui-frontend-types` |
| Build fails | Check `external` paths in vite config match your imports |

---

## Summary Checklist

- [ ] Register JS directory in `__init__.py` using `nodes.EXTENSION_WEB_DIRS`
- [ ] Set `OUTPUT_NODE = True` on Python nodes that send UI data
- [ ] Return `{"ui": {...}, "result": (...)}` from node's process function
- [ ] Import `app` and `api` from relative paths in JS
- [ ] Use `app.registerExtension()` to hook into node creation
- [ ] Use `api.addEventListener('executed', ...)` to receive data
- [ ] Mark ComfyUI scripts as `external` in Vite config
- [ ] Inject CSS with duplicate prevention
- [ ] Implement `dispose()` method in widget class (remove listeners, cancel animations, clear DOM)
- [ ] Clean up resources via `widget.onRemove` or `node.onRemoved`

---

*Document created from analysis of ComfyUI-qwenmultiangle node pack, which demonstrates best practices for frontend integration compatible with both legacy and new ComfyUI frontends.*
