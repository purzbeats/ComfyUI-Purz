# ComfyUI Custom Node Development Pain Points

This document captures the challenges and struggles encountered while developing ComfyUI-Purz, particularly around creating UI elements that work across both legacy ComfyUI and the newer Nodes 2.0 (Vue-based) system.

## The Dual-System Problem

ComfyUI is transitioning from a legacy LiteGraph-based frontend to a new Vue-based system called "Nodes 2.0". Custom node developers are caught in the middle, needing to support both systems with virtually no documentation on how to do so.

### What We Know

**Legacy System (LiteGraph):**
- Uses `app.registerExtension()` with `beforeRegisterNodeDef` hooks
- DOM widgets via `node.addDOMWidget()`
- Direct canvas manipulation
- Reasonably documented through community examples and source diving

**Nodes 2.0 (Vue):**
- Will use a "v3 schema" for defining widgets
- Vue components instead of raw DOM manipulation
- Supposedly allows Vue widgets without JavaScript
- **Almost completely undocumented for third-party developers**

## Specific Struggles

### 1. DOM Widget Event Handling

One of our biggest challenges was getting sliders, checkboxes, and other input elements to work without triggering unwanted node behavior (like dragging the node when trying to adjust a slider).

**The problem:** LiteGraph captures mouse events at the canvas level. Any mousedown inside a node can trigger node dragging.

**Our solution:** Aggressive event capturing on every interactive element:

```javascript
slider.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    slider.focus();
}, true);  // capture phase is critical

slider.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    slider.setPointerCapture(e.pointerId);
    slider.focus();
}, true);

slider.addEventListener("touchstart", (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
}, true);
```

We have to do this for **every single interactive element**. There's no documented way to tell ComfyUI "this region should not trigger node interactions."

**Unknown:** Will this approach work in Nodes 2.0? Will Vue's event system conflict with these handlers? No documentation exists to answer this.

### 2. Node Height/Size Calculation

Getting nodes to properly resize when adding dynamic content (like our layer list) required trial and error:

```javascript
function fitHeight(node) {
    node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]]);
    node?.graph?.setDirtyCanvas(true);
}
```

**Pain points:**
- `computeSize` behavior is not documented
- When to call `setDirtyCanvas` is unclear
- Different behavior when node is collapsed vs expanded
- No guidance on how DOM widget height calculation interacts with native widgets

**Unknown:** How does sizing work in Nodes 2.0? Do Vue components auto-size? Is there a reactive system?

### 3. Preventing Default Image Preview

ComfyUI automatically shows a preview for any node that returns images. We wanted a custom preview (our WebGL canvas) instead.

**The trick we discovered:** Use a custom key instead of `"images"` in the return dict:

```python
return {
    "ui": {
        "purz_images": results,  # NOT "images" - prevents default preview
    },
    "result": (output_image,)
}
```

**This is completely undocumented.** We found it through source diving and experimentation.

**Unknown:** Will this hack work in Nodes 2.0? Is there a proper API for custom previews?

### 4. Backend-to-Frontend Communication

We needed real-time communication for batch processing status. ComfyUI provides WebSocket events but:

```python
PromptServer.instance.send_sync("purz.batch_pending", {"node_id": node_id, "count": batch_size})
```

**Problems encountered:**
- Events don't always arrive (hence our polling fallback)
- No documentation on event naming conventions
- No documentation on payload limitations
- Node ID type inconsistencies (`app.graph._nodes_by_id` uses both string and int keys)

```javascript
// We have to try both because it's inconsistent
let node = app.graph._nodes_by_id[node_id];
if (!node) node = app.graph._nodes_by_id[parseInt(node_id)];
```

**Unknown:** Does Nodes 2.0 have a proper event system? Is there a Vue-native way to handle backend events?

### 5. CSS Isolation

Our styles can potentially conflict with ComfyUI's styles or other extensions. We use prefixed class names (`purz-*`) but there's no official guidance on:

- CSS scoping best practices
- Z-index management (what z-index values are "safe"?)
- Theme compatibility (dark mode, custom themes)

**Unknown:** Does Nodes 2.0 provide CSS scoping? Vue's scoped styles? CSS custom properties for theming?

### 6. Widget Serialization

We set `serialize: false` on our DOM widget to prevent ComfyUI from trying to save our complex UI state:

```javascript
const domWidget = this.addDOMWidget("preview", "preview", container, {
    serialize: false,
    hideOnZoom: false,
});
```

**Undocumented behaviors:**
- What exactly gets serialized if we set `true`?
- How does serialization interact with workflow saving?
- Can we provide custom serialization logic?

**Unknown:** How does Nodes 2.0 handle widget state persistence?

### 7. Import Paths

The correct import path depends on directory structure and is fragile:

```javascript
// From web/js/purz_interactive.js
import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
```

**Problems:**
- Path changes if ComfyUI restructures
- No module aliasing or proper module system
- Different paths for different deployment scenarios

**Unknown:** Does Nodes 2.0 provide proper ES module imports? npm packages?

## The Documentation Gap

### What Documentation Actually Exists

After deeper investigation, ComfyUI has more documentation than initially apparent at https://docs.comfy.org:

1. **JavaScript Extension Framework** - `registerExtension()`, hooks like `beforeRegisterNodeDef`, `nodeCreated`, `setup`
2. **Core Objects Reference** - `app`, `app.graph`, `LGraph`, `LLink`, `ComfyNode` properties
3. **Widget System Basics** - Widget types (BOOLEAN, INT, FLOAT, STRING, COMBO, IMAGEUPLOAD), conversion patterns
4. **V3 Schema Migration Guide** - Backend migration from V1 to V3 (class-based schemas, `ComfyNode` base class)
5. **Context Menu Examples** - Adding menu items, submenus
6. **API Events** - `api.addEventListener("execution_start", ...)` pattern

### What's Still Missing for Complex UI Development

Despite the documentation that exists, **building rich interactive widgets like ours** still requires significant guesswork:

1. **DOM Widget Deep Dive** - `addDOMWidget()` is mentioned but not documented:
   - What options are available? (`serialize`, `hideOnZoom`, others?)
   - How does `computeSize` work?
   - How to prevent event propagation properly?

2. **Custom Preview/Output Handling** - We discovered the `purz_images` trick through source diving. No docs explain:
   - How to replace default image preview
   - Custom UI return patterns
   - What keys in the return dict are special

3. **Node Sizing/Layout** - Nothing explains:
   - How `computeSize` interacts with widgets
   - When to call `setDirtyCanvas`
   - Dynamic height calculation

4. **Backend-Frontend Sync** - Partial docs on events, but nothing on:
   - WebSocket reliability issues
   - Chunked upload patterns
   - State persistence across executions

5. **CSS/Theming** - Zero guidance on:
   - Safe z-index ranges
   - Theme compatibility
   - CSS isolation best practices

### The Nodes 2.0 Problem Remains

The V3 migration guide covers **backend** changes (Python node definitions), but says nothing about **frontend** implications:

- Does `addDOMWidget()` work in Nodes 2.0?
- Do our event propagation hacks still work?
- Is there a Vue-native way to create widgets?
- What about the mentioned "v3 schema" for frontend?

The Nodes 2.0 user documentation still just says:

> "Some custom nodes may require updates to be fully supported."

**The V3 migration guide is backend-only. There is no frontend migration guide.**

### The Deprecation Warning

The docs explicitly state:

> "Hijacking/monkey-patching functions on `app` or prototypes is deprecated and subject to change."

But for complex widgets, we're forced to use patterns like overriding `onExecuted` because there's no documented alternative. The docs say "use official extension hooks" but don't provide hooks for all the functionality we need.

## Our Workarounds

Given the lack of documentation, we've adopted these strategies:

1. **Source diving** - Reading ComfyUI's source is often the only way to understand behavior
2. **Trial and error** - Many "discoveries" came from experimentation
3. **Defensive coding** - Try multiple approaches, add fallbacks
4. **Isolation** - Prefix everything, avoid global state
5. **Documentation** - We document our findings in CLAUDE.md for future reference

## Recommendations for ComfyUI Team

The existing documentation at docs.comfy.org is a good start. Here's what would help most:

1. **Document `addDOMWidget()` thoroughly** - This is the foundation for complex UI, but it's barely mentioned. We need:
   - All available options and their effects
   - Event handling best practices
   - Sizing/layout interaction

2. **Frontend migration guide for Nodes 2.0** - The V3 guide covers backend only. We need:
   - What works/breaks in Vue-based rendering
   - Vue-native widget alternatives (if any)
   - Timeline for deprecating legacy patterns

3. **Complex widget examples** - The current examples show menus and basic hooks. We need:
   - Interactive canvas/WebGL widgets
   - Custom preview replacements
   - Backend-frontend state sync patterns
   - Video/batch processing UI

4. **Document the "special" return keys** - What keys in the return dict have special meaning?
   - We discovered `purz_images` vs `images` by accident
   - Are there others?

5. **Hooks for everything we currently hijack** - If monkey-patching is deprecated, provide hooks for:
   - `onExecuted` customization
   - Preview rendering override
   - Widget value interception

## Conclusion

ComfyUI's documentation has improved significantly - the JavaScript extension framework, hooks system, and core objects are now reasonably documented at docs.comfy.org. **Simple to moderate extensions are well-supported.**

However, **building rich, interactive widgets** (WebGL canvases, video players, complex state management) still requires significant reverse-engineering. The gap isn't in basic documentation but in:

1. **Advanced DOM widget patterns** - The foundation we build on (`addDOMWidget`) is barely documented
2. **Frontend migration path** - V3 covers backend; frontend developers are left guessing about Nodes 2.0
3. **Complex examples** - Current examples don't approach the complexity of real-world interactive nodes

We've documented our discoveries in CLAUDE.md so future development (by us or AI assistants) doesn't require re-learning these patterns. We hope this painpoints document helps the ComfyUI team prioritize documentation efforts where they'd have the most impact.

---

*Last updated: 2025-12-08*
*ComfyUI-Purz version: 1.5.0*
