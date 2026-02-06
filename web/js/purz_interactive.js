/**
 * Purz Interactive Image Filter System
 *
 * A layer-based real-time image filter system with WebGL shaders.
 * Each layer can have its own effect and opacity.
 *
 * Custom shaders can be added to: ComfyUI-Purz/shaders/custom/
 * See shaders/custom/_template.glsl for the format.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { CustomShaderLoader, EFFECTS, FilterEngine } from "./purz_filter_engine.js";
import { PRESETS } from "./purz_preset_manager.js";
import { createStyles } from "./purz_styles.js";
import { EffectPicker, UndoManager, fitHeight } from "./purz_layer_manager.js";

// ============================================================================
// MAIN WIDGET CLASS
// ============================================================================

class InteractiveFilterWidget {
    constructor(node) {
        this.node = node;
        this.engine = null;
        this.layers = [];
        this.layerIdCounter = 0;
        this.originalImageUrl = null;
        this.imageWidth = 0;
        this.imageHeight = 0;
        this.sourceImage = null;
        this.minWidth = 250; // Minimum node width
        this.customPresets = {}; // Will be loaded from server
        this.batchImages = []; // All images in current batch
        this.batchSize = 0;

        // Playback state
        this.isPlaying = false;
        this.currentFrame = 0;
        this.playbackFps = 24;
        this.playbackInterval = null;
        this.loadedFrames = []; // Cache of loaded Image objects

        // Batch processing state
        this.batchProcessing = false;

        // Custom shaders loaded state
        this.customShadersLoaded = false;

        // Animation loop state (for animated grain preview)
        this.animationFrameId = null;
        this.animationTime = 0;

        // Undo/Redo system
        this.undoManager = new UndoManager(50);

        // A/B Split preview state
        this.splitMode = "filtered"; // "filtered" | "split" | "original"
        this.splitPosition = 0.5; // 0..1, position of divider

        createStyles();
        this._buildUI();
        this._initPresets();
        this._initCustomShaders();
        this._initKeyboardShortcuts();
    }

    async _initPresets() {
        await this._loadCustomPresets();
        this._buildPresetDropdown();
    }

    async _initCustomShaders() {
        // Load custom shaders manifest
        await CustomShaderLoader.loadManifest();
        this.customShadersLoaded = true;

        // Re-render layers to include custom effects in dropdown
        if (this.layers.length > 0) {
            this._renderLayers();
        }
    }

    _initKeyboardShortcuts() {
        // Listen for Ctrl+Z / Ctrl+Shift+Z while the node is focused
        this.container.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                this._undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                this._redo();
            }
        });
        // Make container focusable to receive key events
        this.container.tabIndex = -1;
    }

    _pushUndoState() {
        this.undoManager.pushState(this.layers);
        this._updateUndoRedoButtons();
    }

    _pushUndoStateDebounced() {
        this.undoManager.pushStateDebounced(this.layers);
        // Don't update buttons here; too frequent
    }

    _undo() {
        const state = this.undoManager.undo(this.layers);
        if (state) {
            this.layers = state;
            // Restore layerIdCounter to max id in restored layers
            this.layerIdCounter = this.layers.reduce((max, l) => Math.max(max, l.id), this.layerIdCounter);
            this._renderLayers();
            this._updatePreview();
            fitHeight(this.node, this);
        }
        this._updateUndoRedoButtons();
    }

    _redo() {
        const state = this.undoManager.redo(this.layers);
        if (state) {
            this.layers = state;
            this.layerIdCounter = this.layers.reduce((max, l) => Math.max(max, l.id), this.layerIdCounter);
            this._renderLayers();
            this._updatePreview();
            fitHeight(this.node, this);
        }
        this._updateUndoRedoButtons();
    }

    _updateUndoRedoButtons() {
        if (this.undoBtn) this.undoBtn.disabled = !this.undoManager.canUndo();
        if (this.redoBtn) this.redoBtn.disabled = !this.undoManager.canRedo();
    }

    /**
     * Get effect definition, checking both built-in and custom effects.
     */
    _getEffectDef(effectKey) {
        if (EFFECTS[effectKey]) {
            return EFFECTS[effectKey];
        }
        if (CustomShaderLoader.customEffects[effectKey]) {
            return CustomShaderLoader.customEffects[effectKey];
        }
        return null;
    }

    /**
     * Get all effects (built-in + custom) for dropdown.
     */
    _getAllEffects() {
        const allEffects = { ...EFFECTS };
        for (const [key, effect] of Object.entries(CustomShaderLoader.customEffects)) {
            allEffects[key] = effect;
        }
        return allEffects;
    }

    /**
     * Ensure custom shader is compiled before rendering.
     */
    async _ensureCustomShaderCompiled(effectKey) {
        if (!CustomShaderLoader.isCustomEffect(effectKey)) {
            return true; // Built-in shader, already compiled
        }

        if (this.engine && this.engine.hasProgram(effectKey)) {
            return true; // Already compiled
        }

        // Load and compile the custom shader
        const effect = await CustomShaderLoader.getEffect(effectKey);
        if (effect && effect.shader && this.engine) {
            return this.engine.loadCustomShader(effectKey, effect.shader);
        }

        return false;
    }

    // =========================================================================
    // A/B SPLIT PREVIEW
    // =========================================================================

    _cycleSplitMode() {
        const modes = ["filtered", "split", "original"];
        const idx = modes.indexOf(this.splitMode);
        this.splitMode = modes[(idx + 1) % modes.length];
        this._updateSplitUI();
        this._updatePreview();
    }

    _updateSplitUI() {
        const isSplit = this.splitMode === "split";
        this.splitHandle.style.display = isSplit ? "block" : "none";
        this.splitLabelLeft.style.display = isSplit ? "block" : "none";
        this.splitLabelRight.style.display = isSplit ? "block" : "none";
        if (isSplit) {
            this.splitHandle.style.left = `${this.splitPosition * 100}%`;
        }
    }

    _initSplitDrag(canvasWrapper) {
        let dragging = false;

        this.splitHandle.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragging = true;
            this.splitHandle.setPointerCapture(e.pointerId);
        });

        this.splitHandle.addEventListener("pointermove", (e) => {
            if (!dragging) return;
            const rect = canvasWrapper.getBoundingClientRect();
            this.splitPosition = Math.max(0.05, Math.min(0.95,
                (e.clientX - rect.left) / rect.width
            ));
            this.splitHandle.style.left = `${this.splitPosition * 100}%`;
            this._updatePreview();
        });

        this.splitHandle.addEventListener("pointerup", () => {
            dragging = false;
        });

        this.splitHandle.addEventListener("lostpointercapture", () => {
            dragging = false;
        });
    }

    _buildUI() {
        this.container = document.createElement("div");
        this.container.className = "purz-filter-container";

        // Capture pointer events on sliders before they bubble to node
        this.container.addEventListener("pointerdown", (e) => {
            if (e.target.classList.contains("purz-control-slider")) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.target.focus();
                e.target.setPointerCapture(e.pointerId);
            }
        }, true);
        this.container.addEventListener("mousedown", (e) => {
            if (e.target.classList.contains("purz-control-slider")) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.target.focus();
            }
        }, true);

        // Canvas wrapper (visible preview)
        const canvasWrapper = document.createElement("div");
        canvasWrapper.className = "purz-canvas-wrapper";

        this.canvas = document.createElement("canvas");
        this.canvas.className = "purz-canvas";
        this.canvas.width = 200;
        this.canvas.height = 200;
        canvasWrapper.appendChild(this.canvas);

        // A/B Split handle (hidden until split mode)
        this.splitHandle = document.createElement("div");
        this.splitHandle.className = "purz-split-handle";
        this.splitHandle.style.display = "none";
        this.splitHandle.style.left = "50%";
        canvasWrapper.appendChild(this.splitHandle);

        // Split labels
        this.splitLabelLeft = document.createElement("div");
        this.splitLabelLeft.className = "purz-split-label purz-split-label-left";
        this.splitLabelLeft.textContent = "Original";
        this.splitLabelLeft.style.display = "none";
        canvasWrapper.appendChild(this.splitLabelLeft);

        this.splitLabelRight = document.createElement("div");
        this.splitLabelRight.className = "purz-split-label purz-split-label-right";
        this.splitLabelRight.textContent = "Filtered";
        this.splitLabelRight.style.display = "none";
        canvasWrapper.appendChild(this.splitLabelRight);

        // Split handle drag
        this._initSplitDrag(canvasWrapper);

        this.container.appendChild(canvasWrapper);
        this.canvasWrapper = canvasWrapper;

        // Playback controls (hidden until batch loaded)
        this.playbackRow = document.createElement("div");
        this.playbackRow.className = "purz-playback-row hidden";

        this.playBtn = document.createElement("button");
        this.playBtn.className = "purz-play-btn";
        this.playBtn.innerHTML = "\u25B6";
        this.playBtn.title = "Play/Pause";
        this.playBtn.addEventListener("click", () => this._togglePlayback());
        this.playbackRow.appendChild(this.playBtn);

        this.frameSlider = document.createElement("input");
        this.frameSlider.type = "range";
        this.frameSlider.className = "purz-frame-slider purz-control-slider";
        this.frameSlider.min = 0;
        this.frameSlider.max = 0;
        this.frameSlider.value = 0;
        this.frameSlider.addEventListener("input", () => {
            this._stopPlayback();
            this.currentFrame = parseInt(this.frameSlider.value);
            this._showFrame(this.currentFrame);
        });
        this.playbackRow.appendChild(this.frameSlider);

        this.frameCounter = document.createElement("span");
        this.frameCounter.className = "purz-frame-counter";
        this.frameCounter.textContent = "0/0";
        this.playbackRow.appendChild(this.frameCounter);

        this.fpsSelect = document.createElement("select");
        this.fpsSelect.className = "purz-fps-select";
        [6, 8, 12, 16, 24, 30, 48, 60].forEach(fps => {
            const opt = document.createElement("option");
            opt.value = fps;
            opt.textContent = `${fps}fps`;
            if (fps === 24) opt.selected = true;
            this.fpsSelect.appendChild(opt);
        });
        this.fpsSelect.addEventListener("change", () => {
            this.playbackFps = parseInt(this.fpsSelect.value);
            if (this.isPlaying) {
                this._stopPlayback();
                this._startPlayback();
            }
        });
        this.playbackRow.appendChild(this.fpsSelect);

        this.container.appendChild(this.playbackRow);

        // Layers header
        const layersHeader = document.createElement("div");
        layersHeader.className = "purz-layers-header";

        const layersTitle = document.createElement("span");
        layersTitle.className = "purz-layers-title";
        layersTitle.textContent = "Effects";
        layersHeader.appendChild(layersTitle);

        // A/B view toggle
        const viewToggle = document.createElement("button");
        viewToggle.className = "purz-view-toggle";
        viewToggle.textContent = "A|B";
        viewToggle.title = "Toggle: Filtered / Split / Original";
        viewToggle.addEventListener("click", () => this._cycleSplitMode());
        layersHeader.appendChild(viewToggle);

        // Undo/Redo buttons
        const undoRedoGroup = document.createElement("div");
        undoRedoGroup.className = "purz-undo-redo-group";

        this.undoBtn = document.createElement("button");
        this.undoBtn.className = "purz-undo-btn";
        this.undoBtn.textContent = "\u21A9";
        this.undoBtn.title = "Undo (Ctrl+Z)";
        this.undoBtn.disabled = true;
        this.undoBtn.addEventListener("click", () => this._undo());
        undoRedoGroup.appendChild(this.undoBtn);

        this.redoBtn = document.createElement("button");
        this.redoBtn.className = "purz-redo-btn";
        this.redoBtn.textContent = "\u21AA";
        this.redoBtn.title = "Redo (Ctrl+Shift+Z)";
        this.redoBtn.disabled = true;
        this.redoBtn.addEventListener("click", () => this._redo());
        undoRedoGroup.appendChild(this.redoBtn);

        layersHeader.appendChild(undoRedoGroup);

        const addBtn = document.createElement("button");
        addBtn.className = "purz-add-btn";
        addBtn.textContent = "+ Add";
        addBtn.addEventListener("click", () => this._addLayer());
        layersHeader.appendChild(addBtn);

        this.container.appendChild(layersHeader);

        // Preset selector row
        this.presetRow = document.createElement("div");
        this.presetRow.className = "purz-preset-row";

        // Build the preset dropdown (can be rebuilt when custom presets change)
        this._buildPresetDropdown();

        // Save preset button
        const savePresetBtn = document.createElement("button");
        savePresetBtn.className = "purz-preset-save-btn";
        savePresetBtn.textContent = "Save";
        savePresetBtn.title = "Save current effects as a preset";
        savePresetBtn.addEventListener("click", () => this._savePreset());
        this.presetRow.appendChild(savePresetBtn);

        this.container.appendChild(this.presetRow);

        // Layers list
        this.layersList = document.createElement("div");
        this.layersList.className = "purz-layers-list";
        this.container.appendChild(this.layersList);

        // Empty state
        this.emptyState = document.createElement("div");
        this.emptyState.className = "purz-empty-state";
        this.emptyState.textContent = "No effects yet";
        this.layersList.appendChild(this.emptyState);

        // Actions (below main area)
        const actions = document.createElement("div");
        actions.className = "purz-actions";

        const saveBtn = document.createElement("button");
        saveBtn.className = "purz-save-btn";
        saveBtn.textContent = "Save Image";
        saveBtn.addEventListener("click", () => this._saveImage());
        actions.appendChild(saveBtn);

        const resetBtn = document.createElement("button");
        resetBtn.className = "purz-reset-btn";
        resetBtn.textContent = "Reset";
        resetBtn.addEventListener("click", () => this._reset());
        actions.appendChild(resetBtn);

        this.container.appendChild(actions);

        // Status
        this.statusEl = document.createElement("div");
        this.statusEl.className = "purz-status";
        this.statusEl.textContent = "Run workflow to load image";
        this.container.appendChild(this.statusEl);
    }

    async _addLayer(effectType = "desaturate") {
        const effectDef = this._getEffectDef(effectType);
        if (!effectDef) {
            console.warn(`[Purz] Unknown effect: ${effectType}`);
            return;
        }

        this._pushUndoState();

        // Ensure custom shader is compiled before adding layer
        await this._ensureCustomShaderCompiled(effectType);

        const layer = {
            id: ++this.layerIdCounter,
            effect: effectType,
            enabled: true,
            opacity: 1.0,
            params: {}
        };

        // Set default params
        for (const param of effectDef.params) {
            layer.params[param.name] = param.default;
        }

        // Generate and store seed for effects that need it (ensures preview matches output)
        if (effectDef.needsSeed) {
            layer.params.seed = Math.random() * 1000;
        }

        this.layers.push(layer);
        this._renderLayers();
        this._updatePreview();
        fitHeight(this.node, this);
    }

    _removeLayer(id) {
        this._pushUndoState();
        this.layers = this.layers.filter(l => l.id !== id);
        this._renderLayers();
        this._updatePreview();
        fitHeight(this.node, this);
    }

    _reorderLayer(draggedId, targetId, insertBefore) {
        this._pushUndoState();
        const draggedIdx = this.layers.findIndex(l => l.id === draggedId);
        const targetIdx = this.layers.findIndex(l => l.id === targetId);

        if (draggedIdx === -1 || targetIdx === -1) return;

        // Remove dragged layer
        const [draggedLayer] = this.layers.splice(draggedIdx, 1);

        // Calculate new target index (adjust if dragged was before target)
        let newIdx = targetIdx;
        if (draggedIdx < targetIdx) {
            newIdx--; // Target shifted down after removal
        }
        if (!insertBefore) {
            newIdx++; // Insert after target
        }

        // Insert at new position
        this.layers.splice(newIdx, 0, draggedLayer);

        this._renderLayers();
        this._updatePreview();
    }

    async _loadPreset(presetKey) {
        // Check built-in presets first, then custom presets
        let preset = PRESETS[presetKey];
        let isCustom = false;

        if (!preset) {
            preset = this.customPresets[presetKey];
            isCustom = true;
        }

        if (!preset) return;

        this._pushUndoState();

        // Clear existing layers
        this.layers = [];
        this.layerIdCounter = 0;

        // Add layers from preset
        for (const presetLayer of preset.layers) {
            const effectDef = this._getEffectDef(presetLayer.effect);
            if (!effectDef) continue; // Skip unknown effects

            // Ensure custom shader is compiled
            await this._ensureCustomShaderCompiled(presetLayer.effect);

            const layer = {
                id: ++this.layerIdCounter,
                effect: presetLayer.effect,
                enabled: true,
                opacity: presetLayer.opacity ?? 1.0,
                params: {}
            };

            // Set default params first
            for (const param of effectDef.params) {
                layer.params[param.name] = param.default;
            }

            // Override with preset params
            if (presetLayer.params) {
                for (const [paramName, paramValue] of Object.entries(presetLayer.params)) {
                    layer.params[paramName] = paramValue;
                }
            }

            // Generate seed for effects that need it
            if (effectDef.needsSeed) {
                layer.params.seed = Math.random() * 1000;
            }

            this.layers.push(layer);
        }

        this._renderLayers();
        this._updatePreview();
        fitHeight(this.node, this);

        // Show status
        this._setStatus(`Loaded: ${preset.name}`, "success");
    }

    _buildPresetDropdown() {
        // Remove existing select if rebuilding
        const existingSelect = this.presetRow?.querySelector(".purz-preset-select");
        if (existingSelect) {
            existingSelect.remove();
        }

        const presetSelect = document.createElement("select");
        presetSelect.className = "purz-preset-select";

        // Default option
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Load Preset...";
        presetSelect.appendChild(defaultOption);

        // Get custom presets from instance
        const hasCustomPresets = Object.keys(this.customPresets).length > 0;

        // Add custom presets first if any exist
        if (hasCustomPresets) {
            const customOptgroup = document.createElement("optgroup");
            customOptgroup.label = "My Presets";
            for (const [key, preset] of Object.entries(this.customPresets)) {
                const option = document.createElement("option");
                option.value = key;
                option.textContent = preset.name;
                customOptgroup.appendChild(option);
            }
            presetSelect.appendChild(customOptgroup);
        }

        // Group built-in presets by category
        const categories = {};
        for (const [key, preset] of Object.entries(PRESETS)) {
            const cat = preset.category || "Other";
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ key, name: preset.name });
        }

        // Create optgroups for each category
        for (const [category, presets] of Object.entries(categories)) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = category;
            for (const { key, name } of presets) {
                const option = document.createElement("option");
                option.value = key;
                option.textContent = name;
                optgroup.appendChild(option);
            }
            presetSelect.appendChild(optgroup);
        }

        presetSelect.addEventListener("change", () => {
            if (presetSelect.value) {
                this._loadPreset(presetSelect.value);
                presetSelect.value = ""; // Reset to "Load Preset..."
            }
        });

        // Insert at beginning of preset row
        this.presetRow.insertBefore(presetSelect, this.presetRow.firstChild);
    }

    async _savePreset() {
        if (this.layers.length === 0) {
            this._setStatus("Add effects first", "error");
            return;
        }

        // Prompt for preset name
        const name = prompt("Enter a name for your preset:");
        if (!name || !name.trim()) return;

        const trimmedName = name.trim();

        // Build preset data from current layers
        const presetLayers = this.layers.map(layer => {
            const layerData = {
                effect: layer.effect,
                params: { ...layer.params },
                opacity: layer.opacity
            };
            // Remove seed from saved preset (will be regenerated on load)
            delete layerData.params.seed;
            return layerData;
        });

        this._setStatus("Saving...", "");

        try {
            const response = await fetch("/purz/presets/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: trimmedName,
                    layers: presetLayers
                })
            });

            const result = await response.json();
            if (result.success) {
                // Rebuild dropdown to include new preset
                await this._loadCustomPresets();
                this._buildPresetDropdown();
                this._setStatus(`Saved: ${trimmedName}`, "success");
            } else {
                this._setStatus(`Error: ${result.error}`, "error");
            }
        } catch (e) {
            console.error("Failed to save preset:", e);
            this._setStatus("Failed to save preset", "error");
        }
    }

    async _deleteCustomPreset(presetKey) {
        const preset = this.customPresets[presetKey];
        if (!preset) return;

        if (!confirm(`Delete preset "${preset.name}"?`)) return;

        try {
            const response = await fetch("/purz/presets/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: presetKey })
            });

            const result = await response.json();
            if (result.success) {
                // Rebuild dropdown
                await this._loadCustomPresets();
                this._buildPresetDropdown();
                this._setStatus(`Deleted: ${preset.name}`, "success");
            } else {
                this._setStatus(`Error: ${result.error}`, "error");
            }
        } catch (e) {
            console.error("Failed to delete preset:", e);
            this._setStatus("Failed to delete preset", "error");
        }
    }

    async _loadCustomPresets() {
        try {
            const response = await fetch("/purz/presets/list");
            const result = await response.json();
            if (result.success) {
                this.customPresets = result.presets || {};
            } else {
                console.error("Failed to load presets:", result.error);
                this.customPresets = {};
            }
        } catch (e) {
            console.error("Failed to load custom presets:", e);
            this.customPresets = {};
        }
    }

    _renderLayers() {
        this.layersList.innerHTML = "";

        if (this.layers.length === 0) {
            this.layersList.appendChild(this.emptyState);
            return;
        }

        for (const layer of this.layers) {
            const layerEl = this._createLayerElement(layer);
            this.layersList.appendChild(layerEl);
        }
    }

    _createLayerElement(layer) {
        const el = document.createElement("div");
        el.className = `purz-layer ${layer.enabled ? "" : "disabled"}`;
        el.dataset.layerId = layer.id;

        // Drag and drop handlers (drag only enabled when initiated from handle)
        el.addEventListener("dragstart", (e) => {
            if (!this._dragFromHandle) {
                e.preventDefault();
                return;
            }
            el.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", layer.id.toString());
            this._draggedLayerId = layer.id;
        });

        el.addEventListener("dragend", () => {
            el.classList.remove("dragging");
            this._draggedLayerId = null;
            this._dragFromHandle = false;
            // Clean up all drag-over states
            this.layersList.querySelectorAll(".purz-layer").forEach(l => {
                l.classList.remove("drag-over", "drag-over-bottom");
            });
        });

        el.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (this._draggedLayerId === layer.id) return;

            const rect = el.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            // Clean up previous states on this element
            el.classList.remove("drag-over", "drag-over-bottom");

            // Show indicator above or below based on mouse position
            if (e.clientY < midY) {
                el.classList.add("drag-over");
            } else {
                el.classList.add("drag-over-bottom");
            }
        });

        el.addEventListener("dragleave", () => {
            el.classList.remove("drag-over", "drag-over-bottom");
        });

        el.addEventListener("drop", (e) => {
            e.preventDefault();
            el.classList.remove("drag-over", "drag-over-bottom");

            const draggedId = parseInt(e.dataTransfer.getData("text/plain"));
            if (draggedId === layer.id) return;

            const rect = el.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertBefore = e.clientY < midY;

            this._reorderLayer(draggedId, layer.id, insertBefore);
        });

        // Header row
        const header = document.createElement("div");
        header.className = "purz-layer-header";

        // Drag handle - only this element initiates drag
        const dragHandle = document.createElement("span");
        dragHandle.className = "purz-layer-drag-handle";
        dragHandle.draggable = true;
        dragHandle.innerHTML = "\u22EE\u22EE";
        dragHandle.title = "Drag to reorder";
        dragHandle.addEventListener("mousedown", () => {
            this._dragFromHandle = true;
            el.draggable = true;
        });
        dragHandle.addEventListener("dragstart", (e) => {
            // Let the event bubble up to the layer element
            this._dragFromHandle = true;
            el.draggable = true;
        });
        dragHandle.addEventListener("mouseup", () => {
            this._dragFromHandle = false;
            el.draggable = false;
        });
        header.appendChild(dragHandle);

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "purz-layer-toggle";
        toggle.checked = layer.enabled;
        toggle.addEventListener("change", () => {
            layer.enabled = toggle.checked;
            el.className = `purz-layer ${layer.enabled ? "" : "disabled"}`;
            this._updatePreview();
        });
        header.appendChild(toggle);

        // Effect name button — opens searchable effect picker
        const effectBtn = document.createElement("button");
        effectBtn.className = "purz-layer-select";
        effectBtn.style.textAlign = "left";
        effectBtn.style.cursor = "pointer";
        const currentEffectDef = this._getEffectDef(layer.effect);
        effectBtn.textContent = currentEffectDef ? currentEffectDef.name : layer.effect;

        effectBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            // Open effect picker anchored in the layer element
            EffectPicker.open(
                el,
                this._getAllEffects(),
                layer.effect,
                async (newEffectKey) => {
                    this._pushUndoState();
                    layer.effect = newEffectKey;
                    layer.params = {};
                    const effectDef = this._getEffectDef(layer.effect);
                    if (effectDef) {
                        for (const param of effectDef.params) {
                            layer.params[param.name] = param.default;
                        }
                        if (effectDef.needsSeed) {
                            layer.params.seed = Math.random() * 1000;
                        }
                        await this._ensureCustomShaderCompiled(layer.effect);
                    }
                    this._renderLayers();
                    this._updatePreview();
                },
                () => { /* close callback - no action needed */ }
            );
        });
        // Stop event propagation to prevent node drag
        effectBtn.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
        effectBtn.addEventListener("mousedown", (e) => e.stopPropagation(), true);
        header.appendChild(effectBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "purz-layer-delete";
        deleteBtn.textContent = "\u00D7";
        deleteBtn.addEventListener("click", () => this._removeLayer(layer.id));
        header.appendChild(deleteBtn);

        el.appendChild(header);

        // Controls
        const controls = document.createElement("div");
        controls.className = "purz-layer-controls";

        // Effect params (use helper to support custom effects)
        const effect = this._getEffectDef(layer.effect);
        if (!effect) {
            console.warn(`[Purz] Unknown effect: ${layer.effect}`);
            return el;
        }
        for (const param of effect.params) {
            const row = document.createElement("div");
            row.className = "purz-control-row";

            const label = document.createElement("span");
            label.className = "purz-control-label";
            label.textContent = param.label;
            row.appendChild(label);

            // Handle checkbox type params
            if (param.type === "checkbox") {
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.className = "purz-control-checkbox";
                checkbox.checked = layer.params[param.name] ?? param.default ?? false;

                // Prevent node dragging when interacting with checkbox
                checkbox.addEventListener("mousedown", (e) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }, true);
                checkbox.addEventListener("pointerdown", (e) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }, true);

                checkbox.addEventListener("change", () => {
                    this._pushUndoState();
                    layer.params[param.name] = checkbox.checked;
                    this._updatePreview();
                    this._syncLayersToBackend();
                });

                row.appendChild(checkbox);
                controls.appendChild(row);
                continue;
            }

            // Default: slider type
            const slider = document.createElement("input");
            slider.type = "range";
            slider.className = "purz-control-slider";
            slider.min = param.min;
            slider.max = param.max;
            slider.step = param.step;
            slider.value = layer.params[param.name] ?? param.default;

            // Prevent node dragging when interacting with slider (capture phase)
            slider.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
                slider.focus();
            }, true);
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

            const valueSpan = document.createElement("span");
            valueSpan.className = "purz-control-value";
            valueSpan.textContent = parseFloat(slider.value).toFixed(2);

            slider.addEventListener("input", () => {
                const newVal = parseFloat(slider.value);
                layer.params[param.name] = newVal;
                valueSpan.textContent = newVal.toFixed(2);
                this._updatePreview();
                this._pushUndoStateDebounced();
            });

            row.appendChild(slider);
            row.appendChild(valueSpan);
            controls.appendChild(row);
        }

        // Opacity
        const opacityRow = document.createElement("div");
        opacityRow.className = "purz-control-row";

        const opacityLabel = document.createElement("span");
        opacityLabel.className = "purz-control-label";
        opacityLabel.textContent = "Opacity";
        opacityRow.appendChild(opacityLabel);

        const opacitySlider = document.createElement("input");
        opacitySlider.type = "range";
        opacitySlider.className = "purz-control-slider";
        opacitySlider.min = 0;
        opacitySlider.max = 1;
        opacitySlider.step = 0.01;
        opacitySlider.value = layer.opacity;

        // Prevent node dragging when interacting with slider (capture phase)
        opacitySlider.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            opacitySlider.focus();
        }, true);
        opacitySlider.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            opacitySlider.setPointerCapture(e.pointerId);
            opacitySlider.focus();
        }, true);
        opacitySlider.addEventListener("touchstart", (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
        }, true);

        const opacityValue = document.createElement("span");
        opacityValue.className = "purz-control-value";
        opacityValue.textContent = Math.round(layer.opacity * 100) + "%";

        opacitySlider.addEventListener("input", () => {
            layer.opacity = parseFloat(opacitySlider.value);
            opacityValue.textContent = Math.round(layer.opacity * 100) + "%";
            this._updatePreview();
            this._pushUndoStateDebounced();
        });

        opacityRow.appendChild(opacitySlider);
        opacityRow.appendChild(opacityValue);
        controls.appendChild(opacityRow);

        el.appendChild(controls);
        return el;
    }

    _updatePreview() {
        if (!this.engine || !this.engine.imageLoaded) return;

        if (this.splitMode === "original") {
            // Show only the original image
            this.engine.renderOriginal();
        } else if (this.splitMode === "split") {
            // A/B split: left = original, right = filtered
            this.engine.renderSplit(this.layers, this.splitPosition);
        } else {
            // Normal filtered view
            this.engine.render(this.layers);
        }

        // Debounce the backend sync (full-res render is expensive)
        if (this._syncTimeout) clearTimeout(this._syncTimeout);
        this._syncTimeout = setTimeout(() => this._syncLayersToBackend(), 300);

        // Check if we need to start/stop the animation loop
        this._updateAnimationLoop();
    }

    _hasAnimatedLayers() {
        // Check if any enabled layer has animate: true
        return this.layers.some(l => l.enabled && l.params.animate);
    }

    _updateAnimationLoop() {
        const needsAnimation = this._hasAnimatedLayers();

        if (needsAnimation && !this.animationFrameId) {
            // Start animation loop
            this._startAnimationLoop();
        } else if (!needsAnimation && this.animationFrameId) {
            // Stop animation loop
            this._stopAnimationLoop();
        }
    }

    _startAnimationLoop() {
        if (this.animationFrameId) return;

        const animate = (timestamp) => {
            if (!this._hasAnimatedLayers()) {
                this._stopAnimationLoop();
                return;
            }

            // Update seeds for animated layers (change every ~33ms for ~30fps grain animation)
            const timeDelta = timestamp - (this.animationTime || timestamp);
            this.animationTime = timestamp;

            // Update animated layer seeds
            for (const layer of this.layers) {
                if (layer.enabled && layer.params.animate && layer.params.seed !== undefined) {
                    // Increment seed to create animated noise effect
                    layer.params.seed += timeDelta * 0.1;
                }
            }

            // Re-render with updated seeds
            if (this.engine && this.engine.imageLoaded) {
                this.engine.render(this.layers);
            }

            this.animationFrameId = requestAnimationFrame(animate);
        };

        this.animationFrameId = requestAnimationFrame(animate);
    }

    _stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    _syncLayersToBackend() {
        // Send layer state to backend for batch processing
        // Backend will apply filters to ALL frames in the batch using these layers
        if (!this.node?.id) return;

        const layerData = this.layers.map(l => ({
            effect: l.effect,
            enabled: l.enabled,
            opacity: l.opacity,
            params: { ...l.params }
        }));

        api.fetchApi("/purz/interactive/set_layers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                node_id: this.node.id,
                layers: layerData
            })
        }).catch(err => {
            console.warn("[Purz] Failed to sync layers:", err);
        });
    }

    async _processAndSendBatch() {
        // Process all batch frames through WebGL and send to backend
        if (!this.batchImages || this.batchImages.length === 0) {
            // Signal backend that we have nothing to process
            await api.fetchApi("/purz/interactive/set_rendered_batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    node_id: this.node.id,
                    batch_id: this.currentBatchId || "",
                    rendered_frames: [],
                    is_final: true
                })
            });
            return;
        }
        if (this.batchProcessing) return; // Prevent concurrent processing

        // Check if we have any enabled filters
        const enabledLayers = this.layers.filter(l => l.enabled);
        if (enabledLayers.length === 0) {
            // No filters enabled, signal backend to use original frames
            console.log("[Purz] No filters enabled, signaling backend to use original");
            await api.fetchApi("/purz/interactive/set_rendered_batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    node_id: this.node.id,
                    batch_id: this.currentBatchId || "",
                    rendered_frames: [],
                    is_final: true
                })
            });
            return;
        }

        this.batchProcessing = true;

        const batchSize = this.batchImages.length;
        console.log(`[Purz] Processing ${batchSize} frames through WebGL...`);
        this._setStatus(`Processing ${batchSize} frames...`, "");

        // Create a dedicated canvas for batch processing at full resolution
        const batchCanvas = document.createElement("canvas");
        batchCanvas.width = this.imageWidth;
        batchCanvas.height = this.imageHeight;

        const batchEngine = new FilterEngine(batchCanvas);
        if (!batchEngine.gl) {
            console.error("[Purz] Failed to create WebGL context for batch processing");
            this._setStatus("WebGL error", "error");
            return;
        }

        // Pre-compile any custom shaders needed by the layers
        for (const layer of this.layers) {
            if (layer.enabled && CustomShaderLoader.isCustomEffect(layer.effect)) {
                const effect = CustomShaderLoader.customEffects[layer.effect];
                if (effect && effect.shader) {
                    batchEngine.loadCustomShader(layer.effect, effect.shader);
                } else {
                    // Shader not loaded yet, fetch it
                    const loadedEffect = await CustomShaderLoader.getEffect(layer.effect);
                    if (loadedEffect && loadedEffect.shader) {
                        batchEngine.loadCustomShader(layer.effect, loadedEffect.shader);
                    }
                }
            }
        }

        const renderedFrames = [];

        // Store original seeds for animated layers (grain with animate: true)
        const originalSeeds = {};
        for (const layer of this.layers) {
            if (layer.params.seed !== undefined) {
                originalSeeds[layer.id] = layer.params.seed;
            }
        }

        for (let i = 0; i < batchSize; i++) {
            const imgInfo = this.batchImages[i];
            const params = new URLSearchParams({
                filename: imgInfo.filename,
                subfolder: imgInfo.subfolder || "",
                type: imgInfo.type || "temp"
            });
            const url = `/view?${params.toString()}`;

            try {
                // Load image
                const img = await this._loadImageAsync(url);

                // Resize canvas to match this frame (in case of variable sizes)
                batchCanvas.width = img.naturalWidth;
                batchCanvas.height = img.naturalHeight;

                // Update seeds for animated effects (e.g., grain with animate: true)
                for (const layer of this.layers) {
                    if (layer.enabled && layer.params.animate && originalSeeds[layer.id] !== undefined) {
                        layer.params.seed = originalSeeds[layer.id] + i * 100;
                    }
                }

                // Process through WebGL
                batchEngine.loadImage(img);
                batchEngine.render(this.layers);

                // Capture as base64 PNG
                const imageData = batchCanvas.toDataURL("image/png");
                renderedFrames.push(imageData);

                // Update status periodically
                if (i % 10 === 0 || i === batchSize - 1) {
                    this._setStatus(`Processing ${i + 1}/${batchSize}...`, "");
                }
            } catch (err) {
                console.error(`[Purz] Failed to process frame ${i}:`, err);
            }
        }

        // Send rendered frames to backend in chunks to avoid request size limits
        console.log(`[Purz] Sending ${renderedFrames.length} rendered frames to backend...`);

        try {
            const CHUNK_SIZE = 10; // Send 10 frames at a time
            const totalChunks = Math.ceil(renderedFrames.length / CHUNK_SIZE);

            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, renderedFrames.length);
                const chunk = renderedFrames.slice(start, end);
                const isLast = (i === totalChunks - 1);

                this._setStatus(`Uploading ${end}/${renderedFrames.length}...`, "");

                await api.fetchApi("/purz/interactive/set_rendered_batch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        node_id: this.node.id,
                        batch_id: this.currentBatchId || "",
                        rendered_frames: chunk,
                        chunk_index: i,
                        total_chunks: totalChunks,
                        is_final: isLast
                    })
                });
            }

            this._setStatus(`${renderedFrames.length} frames ready`, "success");
        } catch (err) {
            console.error("[Purz] Failed to send rendered batch:", err);
            this._setStatus("Failed to sync batch", "error");
        }

        // Restore original seeds after batch processing
        for (const layer of this.layers) {
            if (originalSeeds[layer.id] !== undefined) {
                layer.params.seed = originalSeeds[layer.id];
            }
        }

        // Clean up and reset state
        batchEngine.cleanup?.();
        this.batchProcessing = false;
    }

    _loadImageAsync(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = url;
        });
    }

    // =========================================================================
    // PLAYBACK METHODS
    // =========================================================================

    _initPlayback() {
        // Show playback controls if we have multiple frames
        if (this.batchImages.length > 1) {
            this.playbackRow.classList.remove("hidden");
            this.frameSlider.max = this.batchImages.length - 1;
            this.frameSlider.value = 0;
            this.currentFrame = 0;
            this._updateFrameCounter();

            // Preload frames for smooth playback
            this._preloadFrames();
        } else {
            this.playbackRow.classList.add("hidden");
            this._stopPlayback();
        }
    }

    async _preloadFrames() {
        // Preload all frames in background for smooth playback
        this.loadedFrames = [];
        console.log(`[Purz] Preloading ${this.batchImages.length} frames...`);

        for (let i = 0; i < this.batchImages.length; i++) {
            const imgInfo = this.batchImages[i];
            const params = new URLSearchParams({
                filename: imgInfo.filename,
                subfolder: imgInfo.subfolder || "",
                type: imgInfo.type || "temp"
            });
            const url = `/view?${params.toString()}`;

            try {
                const img = await this._loadImageAsync(url);
                this.loadedFrames[i] = img;
            } catch (err) {
                console.warn(`[Purz] Failed to preload frame ${i}:`, err);
                this.loadedFrames[i] = null;
            }
        }

        console.log(`[Purz] Preloaded ${this.loadedFrames.filter(f => f).length} frames`);
    }

    _togglePlayback() {
        if (this.isPlaying) {
            this._stopPlayback();
        } else {
            this._startPlayback();
        }
    }

    _startPlayback() {
        if (this.batchImages.length <= 1) return;
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.playBtn.innerHTML = "\u23F8";
        this.playBtn.classList.add("playing");

        const frameTime = 1000 / this.playbackFps;
        this.playbackInterval = setInterval(() => {
            this.currentFrame = (this.currentFrame + 1) % this.batchImages.length;
            this.frameSlider.value = this.currentFrame;
            this._showFrame(this.currentFrame);
        }, frameTime);
    }

    _stopPlayback() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        this.playBtn.innerHTML = "\u25B6";
        this.playBtn.classList.remove("playing");

        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
    }

    _showFrame(frameIndex) {
        if (frameIndex < 0 || frameIndex >= this.batchImages.length) return;

        this._updateFrameCounter();

        // Use preloaded frame if available
        const img = this.loadedFrames[frameIndex];
        if (img && this.engine) {
            this.engine.loadImage(img);
            this.engine.render(this.layers);
        }
    }

    _updateFrameCounter() {
        const total = this.batchImages.length;
        this.frameCounter.textContent = `${this.currentFrame + 1}/${total}`;
    }

    _reset() {
        if (this.layers.length > 0) this._pushUndoState();
        this._stopAnimationLoop();
        this.layers = [];
        this._renderLayers();
        this._updatePreview();
        fitHeight(this.node, this);
    }

    async _saveImage() {
        if (!this.originalImageUrl) {
            this._setStatus("No image loaded", "error");
            return;
        }

        this._setStatus("Rendering...", "");

        // Create full-res canvas
        const saveCanvas = document.createElement("canvas");
        saveCanvas.width = this.imageWidth;
        saveCanvas.height = this.imageHeight;

        const saveEngine = new FilterEngine(saveCanvas);
        if (!saveEngine.gl) {
            this._setStatus("Failed to create WebGL context", "error");
            return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = async () => {
            saveEngine.loadImage(img);
            saveEngine.render(this.layers);

            const imageData = saveEngine.getImageData();

            this._setStatus("Saving...", "");

            try {
                const response = await api.fetchApi("/purz/interactive/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        node_id: this.node.id,
                        image_data: imageData,
                        filename: `purz_filter_${Date.now()}.png`
                    })
                });

                const result = await response.json();

                if (result.success) {
                    this._setStatus(`Saved: ${result.filename}`, "success");
                } else {
                    this._setStatus(`Error: ${result.error}`, "error");
                }
            } catch (err) {
                this._setStatus(`Save failed: ${err.message}`, "error");
            }
        };

        img.onerror = () => {
            this._setStatus("Failed to load image for save", "error");
        };

        img.src = this.originalImageUrl;
    }

    _setStatus(text, type) {
        this.statusEl.textContent = text;
        this.statusEl.className = `purz-status ${type}`;
    }

    loadImageFromUrl(imageUrl) {
        this._setStatus("Loading image...", "");
        this.originalImageUrl = imageUrl;

        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            this.imageWidth = img.naturalWidth;
            this.imageHeight = img.naturalHeight;
            this.sourceImage = img;  // Store reference for full-res rendering

            // Render at full resolution (or capped for performance) for quality
            const maxRenderSize = 1024;
            const renderScale = Math.min(maxRenderSize / img.naturalWidth, maxRenderSize / img.naturalHeight, 1);
            const renderW = Math.floor(img.naturalWidth * renderScale);
            const renderH = Math.floor(img.naturalHeight * renderScale);

            // Canvas renders at high res internally
            this.canvas.width = renderW;
            this.canvas.height = renderH;

            // Let CSS handle responsive display (width: 100%, max-height capped)
            this.canvas.style.width = "";
            this.canvas.style.height = "";

            // Init engine
            this.engine = new FilterEngine(this.canvas);
            if (!this.engine.gl) {
                this._setStatus("WebGL not available", "error");
                return;
            }

            this.engine.loadImage(img);
            this._updatePreview();

            // Set minimum width - at least 250px or enough to show image reasonably
            this.minWidth = Math.max(250, Math.min(400, renderW + 40));

            this._setStatus(`${img.naturalWidth}\u00D7${img.naturalHeight}`, "success");
            fitHeight(this.node, this);
        };

        img.onerror = () => {
            this._setStatus("Failed to load image", "error");
        };

        img.src = imageUrl;
    }

    getElement() {
        return this.container;
    }

    computeSize(width) {
        // Calculate canvas display height based on current width and aspect ratio
        const containerWidth = width - 40; // Account for padding
        let canvasDisplayHeight = 200; // Default when no image

        if (this.imageWidth && this.imageHeight) {
            const aspectRatio = this.imageHeight / this.imageWidth;
            const maxDisplayHeight = 400;
            canvasDisplayHeight = Math.min(containerWidth * aspectRatio, maxDisplayHeight);
        }

        // Vertical layout breakdown:
        // - Canvas (variable based on aspect ratio)
        // - Playback controls (30px if batch, 0 otherwise)
        // - Preset row (40px)
        // - Effects header (30px)
        // - Layers list (variable, max 300px due to CSS max-height)
        // - Actions row (45px)
        // - Status text (20px)
        const playbackHeight = this.batchImages && this.batchImages.length > 1 ? 35 : 0;
        const presetHeight = 50;
        const headerHeight = 35;
        const maxLayersHeight = 300; // Matches CSS max-height
        const layersHeight = this.layers.length > 0
            ? Math.min(this.layers.length * 90, maxLayersHeight)
            : 45; // Empty state
        const actionsHeight = 55;
        const statusHeight = 25;
        const padding = 30; // Extra padding for node chrome

        const totalHeight = canvasDisplayHeight + playbackHeight + presetHeight +
                           headerHeight + layersHeight + actionsHeight +
                           statusHeight + padding;
        return [width, totalHeight];
    }

    /**
     * Clean up all resources when the node is removed.
     * Prevents memory leaks from WebGL contexts, animation frames, intervals, etc.
     */
    dispose() {
        console.log(`[Purz] Disposing InteractiveFilterWidget for node ${this.node?.id}`);

        // Stop any running animations
        this._stopAnimationLoop();

        // Stop playback
        this._stopPlayback();

        // Clean up WebGL engine
        if (this.engine) {
            this.engine.cleanup();
            this.engine = null;
        }

        // Clear loaded frames cache
        this.loadedFrames = [];
        this.batchImages = [];
        this.sourceImage = null;

        // Clear layer data
        this.layers = [];

        // Remove DOM elements
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.canvas = null;

        // Clear node reference
        this.node = null;
    }
}

// Store widget instances for cleanup
const widgetInstances = new Map();

// ============================================================================
// COMFYUI EXTENSION REGISTRATION
// ============================================================================

app.registerExtension({
    name: "purz.interactive",

    async setup() {
        console.log("[Purz] Interactive filter system loaded");

        // Listen for batch_pending message from backend
        // This signals that the backend is waiting for us to process frames
        api.addEventListener("purz.batch_pending", async (event) => {
            console.log("[Purz] *** RECEIVED batch_pending event ***", event);
            console.log("[Purz] event.detail:", event.detail);
            const { node_id, batch_size, batch_id, images } = event.detail;
            console.log(`[Purz] Backend waiting for batch processing: node ${node_id}, ${batch_size} frames, batch_id=${batch_id}`);

            // Find the node (try both string and int keys)
            let node = app.graph._nodes_by_id[node_id];
            if (!node) {
                node = app.graph._nodes_by_id[parseInt(node_id)];
            }
            if (!node || !node.filterWidget) {
                console.warn(`[Purz] Could not find node ${node_id} for batch processing. Available nodes:`, Object.keys(app.graph._nodes_by_id));
                return;
            }

            const widget = node.filterWidget;

            // Store batch_id for this execution
            widget.currentBatchId = batch_id;

            // Update batch images if provided
            if (images && images.length > 0) {
                widget.batchImages = images;
                widget.batchSize = images.length;
            }

            // Process the batch through WebGL
            if (widget.batchImages && widget.batchImages.length > 0) {
                console.log(`[Purz] Auto-processing ${widget.batchImages.length} frames for workflow...`);
                await widget._processAndSendBatch();
            }
        });
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "PurzInteractiveFilter") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                if (onNodeCreated) {
                    onNodeCreated.apply(this, arguments);
                }

                const node = this;
                const widget = new InteractiveFilterWidget(node);

                const domWidget = node.addDOMWidget("interactive_filter", "preview", widget.getElement(), {
                    serialize: false,
                    hideOnZoom: false,
                });

                domWidget.computeSize = (width) => widget.computeSize(width);

                // Store widget instance for cleanup tracking
                widgetInstances.set(node.id, widget);
                node.filterWidget = widget;

                // Cleanup handler when widget/node is removed
                domWidget.onRemove = () => {
                    const instance = widgetInstances.get(node.id);
                    if (instance) {
                        instance.dispose();
                        widgetInstances.delete(node.id);
                    }
                };

                node.setSize([340, 500]);

                // Enforce minimum width based on image
                const originalOnResize = node.onResize;
                node.onResize = function(size) {
                    const minWidth = widget.minWidth || 250;
                    if (size[0] < minWidth) {
                        size[0] = minWidth;
                    }
                    if (originalOnResize) {
                        originalOnResize.apply(this, arguments);
                    }
                };
            };

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                if (onExecuted) {
                    onExecuted.apply(this, arguments);
                }

                if (!this.filterWidget) return;

                // Store all batch image info for later processing
                if (message?.purz_images?.length > 0) {
                    this.filterWidget.batchImages = message.purz_images;
                    this.filterWidget.batchSize = message.purz_images.length;

                    // Load first image for preview
                    const imgInfo = message.purz_images[0];
                    const params = new URLSearchParams({
                        filename: imgInfo.filename,
                        subfolder: imgInfo.subfolder || "",
                        type: imgInfo.type || "temp"
                    });
                    this.filterWidget.loadImageFromUrl(`/view?${params.toString()}`);

                    // Initialize playback controls for batch
                    this.filterWidget._initPlayback();

                    // For batches > 1, check if backend is waiting for processing
                    // This is a fallback in case the WebSocket event doesn't fire
                    if (message.purz_images.length > 1 && this.filterWidget.layers.length > 0) {
                        const nodeId = this.id;
                        const widget = this.filterWidget;

                        // Small delay to let backend enter waiting state
                        setTimeout(async () => {
                            try {
                                const response = await api.fetchApi(`/purz/interactive/batch_pending/${nodeId}`);
                                const data = await response.json();

                                if (data.pending && !widget.batchProcessing) {
                                    console.log(`[Purz] Backend waiting for batch (poll fallback), processing ${data.batch_size} frames...`);
                                    await widget._processAndSendBatch();
                                }
                            } catch (err) {
                                console.warn("[Purz] Failed to check batch pending:", err);
                            }
                        }, 500);
                    }
                }
            };
        }
    }
});
