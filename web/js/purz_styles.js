/**
 * Purz Styles Module
 * CSS styles for the Interactive Filter UI.
 */

function createStyles() {
    if (document.getElementById('purz-filter-styles')) return;

    const style = document.createElement('style');
    style.id = 'purz-filter-styles';
    style.textContent = `
        .purz-filter-container {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12px;
            color: #ddd;
            overflow: hidden;
            position: relative;
        }
        .purz-canvas-wrapper {
            margin-bottom: 8px;
            width: 100%;
            flex-shrink: 0;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .purz-canvas {
            border-radius: 6px;
            background: #222;
            display: block;
            width: 100%;
            height: auto;
            max-height: 400px;
            object-fit: contain;
        }
        .purz-layers-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid #444;
            margin-bottom: 6px;
            flex-shrink: 0;
        }
        .purz-layers-title {
            font-weight: 600;
            font-size: 11px;
            color: #fff;
        }
        .purz-add-btn {
            background: #4a9eff;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 3px 8px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 500;
        }
        .purz-add-btn:hover {
            background: #3a8eef;
        }
        .purz-layers-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            overflow-y: auto;
            min-height: 40px;
            max-height: 300px;
        }
        .purz-layer {
            background: #2a2a2a;
            border-radius: 4px;
            padding: 6px;
            border: 1px solid #3a3a3a;
            flex-shrink: 0;
        }
        .purz-layer.disabled {
            opacity: 0.5;
        }
        .purz-layer-header {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-bottom: 4px;
        }
        .purz-layer-drag-handle {
            cursor: grab;
            color: #666;
            padding: 0 2px;
            font-size: 10px;
            user-select: none;
            flex-shrink: 0;
        }
        .purz-layer-drag-handle:hover {
            color: #999;
        }
        .purz-layer-drag-handle:active {
            cursor: grabbing;
        }
        .purz-layer.dragging {
            opacity: 0.5;
            border: 1px dashed #4a9eff;
        }
        .purz-layer.drag-over {
            border-top: 2px solid #4a9eff;
        }
        .purz-layer.drag-over-bottom {
            border-bottom: 2px solid #4a9eff;
        }
        .purz-layer-toggle {
            width: 14px;
            height: 14px;
            flex-shrink: 0;
            cursor: pointer;
            accent-color: #4a9eff;
        }
        .purz-layer-select {
            flex: 1;
            min-width: 0;
            background: #1a1a1a;
            color: #fff;
            border: 1px solid #444;
            border-radius: 3px;
            padding: 2px 4px;
            font-size: 10px;
        }
        .purz-layer-delete {
            background: transparent;
            border: none;
            color: #888;
            cursor: pointer;
            padding: 0 4px;
            font-size: 12px;
            line-height: 1;
            flex-shrink: 0;
        }
        .purz-layer-delete:hover {
            color: #f55;
        }
        .purz-layer-controls {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .purz-control-row {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .purz-control-label {
            width: 50px;
            font-size: 9px;
            color: #999;
            flex-shrink: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .purz-control-slider {
            flex: 1;
            min-width: 40px;
            height: 3px;
            cursor: pointer;
            accent-color: #4a9eff;
        }
        .purz-control-value {
            width: 36px;
            font-size: 9px;
            color: #888;
            text-align: right;
            flex-shrink: 0;
        }
        .purz-control-checkbox {
            width: 14px;
            height: 14px;
            cursor: pointer;
            accent-color: #4a9eff;
            margin-left: auto;
        }
        .purz-actions {
            display: flex;
            gap: 6px;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #444;
            flex-shrink: 0;
        }
        .purz-save-btn {
            flex: 1;
            background: #4a9eff;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 10px;
            cursor: pointer;
            font-weight: 600;
            font-size: 10px;
        }
        .purz-save-btn:hover {
            background: #3a8eef;
        }
        .purz-reset-btn {
            background: #444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 8px;
            cursor: pointer;
            font-size: 10px;
            flex-shrink: 0;
        }
        .purz-reset-btn:hover {
            background: #555;
        }
        .purz-status {
            text-align: center;
            font-size: 9px;
            color: #888;
            margin-top: 6px;
            flex-shrink: 0;
        }
        .purz-status.success { color: #4a9; }
        .purz-status.error { color: #f55; }
        .purz-empty-state {
            text-align: center;
            padding: 12px 4px;
            color: #666;
            font-size: 10px;
        }
        /* Preset Controls */
        .purz-preset-row {
            display: flex;
            gap: 6px;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #444;
            flex-shrink: 0;
        }
        .purz-preset-select {
            flex: 1;
            background: #333;
            color: #ddd;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px 6px;
            font-size: 11px;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23999' d='M0 3l5 5 5-5z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 6px center;
            padding-right: 20px;
        }
        .purz-preset-select:hover {
            border-color: #666;
        }
        .purz-preset-select:focus {
            outline: none;
            border-color: #4a9eff;
        }
        .purz-preset-select optgroup {
            background: #2a2a2a;
            color: #888;
            font-weight: 600;
            font-style: normal;
        }
        .purz-preset-select option {
            background: #333;
            color: #ddd;
            padding: 4px;
        }
        .purz-preset-save-btn {
            background: #555;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 10px;
            white-space: nowrap;
        }
        .purz-preset-save-btn:hover {
            background: #666;
        }
        .purz-preset-save-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .purz-preset-delete-btn {
            background: #a33;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 6px;
            cursor: pointer;
            font-size: 10px;
        }
        .purz-preset-delete-btn:hover {
            background: #c44;
        }
        /* Playback Controls */
        .purz-playback-row {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 0;
            border-bottom: 1px solid #444;
            margin-bottom: 6px;
            flex-shrink: 0;
        }
        .purz-playback-row.hidden {
            display: none;
        }
        .purz-play-btn {
            background: #4a9eff;
            color: white;
            border: none;
            border-radius: 4px;
            width: 28px;
            height: 24px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .purz-play-btn:hover {
            background: #3a8eef;
        }
        .purz-play-btn.playing {
            background: #e94;
        }
        .purz-frame-slider {
            flex: 1;
            height: 4px;
            -webkit-appearance: none;
            appearance: none;
            background: #444;
            border-radius: 2px;
            outline: none;
        }
        .purz-frame-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #4a9eff;
            cursor: pointer;
        }
        .purz-frame-slider::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #4a9eff;
            cursor: pointer;
            border: none;
        }
        .purz-frame-counter {
            font-size: 10px;
            color: #aaa;
            min-width: 50px;
            text-align: right;
        }
        .purz-fps-select {
            background: #333;
            color: #ddd;
            border: 1px solid #555;
            border-radius: 3px;
            padding: 2px 4px;
            font-size: 10px;
            cursor: pointer;
        }
        /* Undo/Redo buttons */
        .purz-undo-redo-group {
            display: flex;
            gap: 2px;
            margin-left: auto;
        }
        .purz-undo-btn, .purz-redo-btn {
            background: transparent;
            border: 1px solid #555;
            color: #999;
            border-radius: 3px;
            padding: 2px 5px;
            cursor: pointer;
            font-size: 10px;
            line-height: 1;
        }
        .purz-undo-btn:hover:not(:disabled), .purz-redo-btn:hover:not(:disabled) {
            color: #fff;
            border-color: #4a9eff;
        }
        .purz-undo-btn:disabled, .purz-redo-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }
        /* A/B Split Preview */
        .purz-canvas-wrapper {
            position: relative;
        }
        .purz-split-handle {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 3px;
            background: #fff;
            cursor: col-resize;
            z-index: 10;
            box-shadow: 0 0 4px rgba(0,0,0,0.5);
        }
        .purz-split-handle::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 14px;
            height: 28px;
            background: #fff;
            border-radius: 4px;
            box-shadow: 0 0 4px rgba(0,0,0,0.5);
        }
        .purz-split-label {
            position: absolute;
            bottom: 6px;
            font-size: 9px;
            color: #fff;
            background: rgba(0,0,0,0.6);
            padding: 1px 4px;
            border-radius: 2px;
            pointer-events: none;
            z-index: 11;
        }
        .purz-split-label-left { left: 6px; }
        .purz-split-label-right { right: 6px; }
        .purz-view-toggle {
            background: transparent;
            border: 1px solid #555;
            color: #999;
            border-radius: 3px;
            padding: 2px 6px;
            cursor: pointer;
            font-size: 9px;
            line-height: 1;
        }
        .purz-view-toggle:hover {
            color: #fff;
            border-color: #4a9eff;
        }
        .purz-view-toggle.active {
            color: #4a9eff;
            border-color: #4a9eff;
        }
        /* Effect Picker Panel */
        .purz-effect-picker {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #1e1e1e;
            z-index: 100;
            display: flex;
            flex-direction: column;
            border-radius: 4px;
            border: 1px solid #4a9eff;
        }
        .purz-effect-picker-header {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px;
            border-bottom: 1px solid #444;
            flex-shrink: 0;
        }
        .purz-effect-search {
            flex: 1;
            background: #2a2a2a;
            color: #fff;
            border: 1px solid #555;
            border-radius: 3px;
            padding: 4px 6px;
            font-size: 11px;
            outline: none;
        }
        .purz-effect-search:focus {
            border-color: #4a9eff;
        }
        .purz-effect-picker-close {
            background: transparent;
            border: none;
            color: #888;
            cursor: pointer;
            font-size: 14px;
            padding: 2px 4px;
            line-height: 1;
        }
        .purz-effect-picker-close:hover {
            color: #fff;
        }
        .purz-effect-picker-list {
            flex: 1;
            overflow-y: auto;
            padding: 4px;
        }
        .purz-effect-section {
            margin-bottom: 4px;
        }
        .purz-effect-section-title {
            font-size: 9px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 4px 6px 2px;
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .purz-effect-section-title:hover {
            color: #aaa;
        }
        .purz-effect-section-arrow {
            font-size: 8px;
            transition: transform 0.15s;
        }
        .purz-effect-section-arrow.collapsed {
            transform: rotate(-90deg);
        }
        .purz-effect-section-items {
            display: flex;
            flex-direction: column;
        }
        .purz-effect-section-items.collapsed {
            display: none;
        }
        .purz-effect-item {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 3px 6px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 11px;
            color: #ddd;
        }
        .purz-effect-item:hover, .purz-effect-item.highlighted {
            background: #333;
        }
        .purz-effect-item.selected {
            background: #4a9eff33;
            color: #fff;
        }
        .purz-effect-fav-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 10px;
            padding: 0 2px;
            line-height: 1;
            color: #555;
            flex-shrink: 0;
        }
        .purz-effect-fav-btn:hover {
            color: #fc0;
        }
        .purz-effect-fav-btn.favorited {
            color: #fc0;
        }
        .purz-effect-item-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .purz-effect-item-cat {
            font-size: 9px;
            color: #666;
            flex-shrink: 0;
        }
    `;
    document.head.appendChild(style);
}

export { createStyles };
