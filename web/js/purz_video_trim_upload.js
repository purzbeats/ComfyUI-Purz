/**
 * Purz Video Trim (Upload) — Path B.
 *
 * Source video is uploaded to ComfyUI's input/ directory. Workflow
 * serializes filename + trim_start_seconds + trim_end_seconds. On execute
 * the backend calls VideoFromFile.as_trimmed() — lazy, no re-encode.
 *
 * In-browser preview uses ComfyUI's /view?type=input URL. Trim handles
 * read/write the standard FLOAT widgets so the workflow persists.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00.000";
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

class VideoTrimUploadWidget {
    constructor(node) {
        this.node = node;
        this.minWidth = 320;
        this.duration = 0;
        this.hasVideo = false;
        this.trimStart = 0;
        this.trimEnd = 0;
        this._loopPlaying = false;
        this._buildUI();
    }

    _buildUI() {
        this.container = document.createElement("div");
        Object.assign(this.container.style, {
            display: "flex", flexDirection: "column", width: "100%", height: "100%",
            background: "#1a1a1a", color: "#ddd", fontFamily: "sans-serif", fontSize: "11px",
            padding: "6px", boxSizing: "border-box", overflow: "hidden", gap: "6px",
            borderRadius: "4px",
        });

        // Upload button
        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.accept = "video/*";
        this.fileInput.style.display = "none";
        this.fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this._uploadFile(file);
            this.fileInput.value = "";
        });
        this.uploadBtn = this._makeButton("⬆  Upload Video", () => this.fileInput.click());

        const uploadRow = document.createElement("div");
        Object.assign(uploadRow.style, { display: "flex", gap: "6px" });
        uploadRow.appendChild(this.uploadBtn);
        uploadRow.appendChild(this.fileInput);

        this.statusLabel = document.createElement("div");
        Object.assign(this.statusLabel.style, {
            color: "#888", fontSize: "10px", padding: "2px 4px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        });
        this.statusLabel.textContent = "";

        // Preview
        this.previewWrap = document.createElement("div");
        Object.assign(this.previewWrap.style, {
            flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: "120px", background: "#0d0d0d", border: "1px solid #2c2c2c",
            borderRadius: "3px", overflow: "hidden",
        });

        this.videoEl = document.createElement("video");
        // Default unmuted so the user can hear the trim loop.
        this.videoEl.muted = false;
        this.videoEl.playsInline = true;
        this.videoEl.preload = "auto";
        Object.assign(this.videoEl.style, {
            maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
            display: "none", background: "#000",
        });
        this.videoEl.addEventListener("loadedmetadata", () => this._onVideoMetadata());
        this.videoEl.addEventListener("timeupdate", () => this._updatePlayhead());
        this.videoEl.addEventListener("play", () => this._onPlayStateChange());
        this.videoEl.addEventListener("pause", () => this._onPlayStateChange());
        this.videoEl.addEventListener("ended", () => this._onPlayStateChange());
        this.videoEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this._toggleLoopPlay();
        });

        this.previewPlaceholder = document.createElement("div");
        this.previewPlaceholder.textContent = "Pick a video from the dropdown above, or upload one";
        Object.assign(this.previewPlaceholder.style, {
            color: "#777", fontStyle: "italic", textAlign: "center", padding: "12px",
        });

        this.previewWrap.appendChild(this.videoEl);
        this.previewWrap.appendChild(this.previewPlaceholder);

        this.timeLabel = document.createElement("div");
        Object.assign(this.timeLabel.style, {
            textAlign: "center", color: "#bbb", padding: "1px 0",
            fontVariantNumeric: "tabular-nums", fontSize: "10px",
        });
        this.timeLabel.textContent = "—";

        // Trim timeline (same dual-handle pattern as Path A)
        this.timelineWrap = document.createElement("div");
        Object.assign(this.timelineWrap.style, {
            position: "relative", height: "26px", padding: "8px 0",
            cursor: "pointer", userSelect: "none",
        });

        this.timelineTrack = document.createElement("div");
        Object.assign(this.timelineTrack.style, {
            position: "absolute", top: "12px", left: "0", right: "0",
            height: "8px", background: "#2a2a2a", borderRadius: "4px",
        });

        this.timelineRegion = document.createElement("div");
        Object.assign(this.timelineRegion.style, {
            position: "absolute", top: "12px", height: "8px",
            background: "#4a9eff", borderRadius: "4px", pointerEvents: "none",
            left: "0%", width: "0%",
        });

        this.startHandle = this._makeHandle("start");
        this.endHandle = this._makeHandle("end");
        this.playhead = document.createElement("div");
        Object.assign(this.playhead.style, {
            position: "absolute", top: "8px", width: "2px", height: "16px",
            background: "#ffeb3b", pointerEvents: "none", left: "0%", display: "none",
        });

        this.timelineWrap.appendChild(this.timelineTrack);
        this.timelineWrap.appendChild(this.timelineRegion);
        this.timelineWrap.appendChild(this.startHandle);
        this.timelineWrap.appendChild(this.endHandle);
        this.timelineWrap.appendChild(this.playhead);
        this.timelineWrap.addEventListener("click", (e) => this._onTimelineClick(e));

        const btnRow = document.createElement("div");
        Object.assign(btnRow.style, { display: "flex", gap: "6px" });
        this.playBtn = this._makeButton("▶ Play Loop", () => this._toggleLoopPlay());
        this.firstBtn = this._makeButton("⏮ Trim Start", () => this._setStartTo(0));
        this.lastBtn = this._makeButton("Trim End ⏭", () => this._setEndTo(this.duration));
        this.playBtn.disabled = true;
        this.firstBtn.disabled = true;
        this.lastBtn.disabled = true;
        btnRow.appendChild(this.playBtn);
        btnRow.appendChild(this.firstBtn);
        btnRow.appendChild(this.lastBtn);

        this.container.appendChild(uploadRow);
        this.container.appendChild(this.statusLabel);
        this.container.appendChild(this.previewWrap);
        this.container.appendChild(this.timeLabel);
        this.container.appendChild(this.timelineWrap);
        this.container.appendChild(btnRow);
    }

    _makeHandle(which) {
        const handle = document.createElement("div");
        Object.assign(handle.style, {
            position: "absolute", top: "4px", width: "14px", height: "24px",
            background: which === "start" ? "#7dd3fc" : "#fca5a5",
            border: "1px solid #1a1a1a", borderRadius: "3px",
            marginLeft: "-7px", cursor: "ew-resize", boxSizing: "border-box",
            zIndex: which === "start" ? 2 : 3,
            touchAction: "none",
        });
        handle.dataset.handle = which;
        handle.addEventListener("pointerdown", (e) => {
            if (!this.hasVideo) return;
            e.stopPropagation();
            e.preventDefault();
            try { handle.setPointerCapture(e.pointerId); } catch (_) {}
            const move = (ev) => this._dragHandle(which, ev);
            const up = (ev) => {
                handle.removeEventListener("pointermove", move);
                handle.removeEventListener("pointerup", up);
                handle.removeEventListener("pointercancel", up);
                try { handle.releasePointerCapture(ev.pointerId); } catch (_) {}
                this._writeWidgets();
                this._suppressNextTimelineClick = true;
                setTimeout(() => { this._suppressNextTimelineClick = false; }, 0);
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", up);
            handle.addEventListener("pointercancel", up);
        });
        handle.addEventListener("mousedown", (e) => e.stopPropagation());
        handle.addEventListener("click", (e) => e.stopPropagation());
        return handle;
    }

    _makeButton(label, onClick) {
        const btn = document.createElement("button");
        btn.textContent = label;
        Object.assign(btn.style, {
            flex: "1", padding: "6px 8px", background: "#2a2a2a", color: "#ddd",
            border: "1px solid #3a3a3a", borderRadius: "3px", cursor: "pointer",
            fontSize: "11px", fontFamily: "inherit",
        });
        btn.addEventListener("mouseenter", () => {
            if (!btn.disabled) btn.style.background = "#3a3a3a";
        });
        btn.addEventListener("mouseleave", () => { btn.style.background = "#2a2a2a"; });
        btn.addEventListener("mousedown", (e) => e.stopPropagation());
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!btn.disabled) onClick();
        });
        return btn;
    }

    // ---- Widget binding ---------------------------------------------------

    bindWidgets() {
        this.videoWidget = this.node.widgets?.find((w) => w.name === "video");
        this.startWidget = this.node.widgets?.find((w) => w.name === "trim_start_seconds");
        this.endWidget = this.node.widgets?.find((w) => w.name === "trim_end_seconds");
        if (!this.videoWidget || !this.startWidget || !this.endWidget) return;

        const origVideoCb = this.videoWidget.callback;
        this.videoWidget.callback = (v) => {
            if (origVideoCb) origVideoCb.call(this.videoWidget, v);
            this._onVideoSelected(v);
        };

        // When the user types into the float widgets, mirror to the timeline.
        const origStartCb = this.startWidget.callback;
        this.startWidget.callback = (v) => {
            if (origStartCb) origStartCb.call(this.startWidget, v);
            this._onWidgetUpdated();
        };
        const origEndCb = this.endWidget.callback;
        this.endWidget.callback = (v) => {
            if (origEndCb) origEndCb.call(this.endWidget, v);
            this._onWidgetUpdated();
        };

        if (this.videoWidget.value) {
            this._onVideoSelected(this.videoWidget.value);
        }
    }

    async _onVideoSelected(filename) {
        if (!filename || filename === "(no video)") {
            this._clearPreview();
            return;
        }
        const params = new URLSearchParams({ filename, type: "input", subfolder: "" });
        this.videoEl.src = `/view?${params.toString()}`;
        this.videoEl.load();
        this.statusLabel.textContent = `Loading ${filename}…`;
    }

    _onVideoMetadata() {
        this.duration = this.videoEl.duration || 0;
        this.hasVideo = this.duration > 0;
        if (!this.hasVideo) return;

        // Use the workflow-restored values if present and sane; otherwise default to the full clip.
        const savedStart = Number.isFinite(this.startWidget?.value) ? this.startWidget.value : 0;
        const savedEnd = Number.isFinite(this.endWidget?.value) && this.endWidget.value > 0
            ? this.endWidget.value : this.duration;
        this.trimStart = Math.max(0, Math.min(savedStart, this.duration - 0.05));
        this.trimEnd = Math.min(this.duration, Math.max(savedEnd, this.trimStart + 0.05));

        this.playBtn.disabled = false;
        this.firstBtn.disabled = false;
        this.lastBtn.disabled = false;
        this.previewPlaceholder.style.display = "none";
        this.videoEl.style.display = "";
        this.playhead.style.display = "";
        this.statusLabel.textContent = `${formatTime(this.duration)} clip`;

        this._renderTimeline();
        this._writeWidgets();  // persist defaults if not already saved
        this.videoEl.currentTime = this.trimStart;
        this._updateTimeLabel();
    }

    _clearPreview() {
        this.videoEl.removeAttribute("src");
        this.videoEl.load();
        this.videoEl.style.display = "none";
        this.previewPlaceholder.style.display = "";
        this.playBtn.disabled = true;
        this.firstBtn.disabled = true;
        this.lastBtn.disabled = true;
        this.hasVideo = false;
        this.duration = 0;
        this.timeLabel.textContent = "—";
        this.statusLabel.textContent = "";
        this.playhead.style.display = "none";
    }

    _onWidgetUpdated() {
        if (!this.hasVideo) return;
        const s = Number(this.startWidget.value) || 0;
        const e = Number(this.endWidget.value) || 0;
        this.trimStart = Math.max(0, Math.min(s, this.duration - 0.05));
        this.trimEnd = Math.min(this.duration, Math.max(e, this.trimStart + 0.05));
        this._renderTimeline();
        this._updateTimeLabel();
    }

    _renderTimeline() {
        if (!this.hasVideo) return;
        const startPct = (this.trimStart / this.duration) * 100;
        const endPct = (this.trimEnd / this.duration) * 100;
        this.startHandle.style.left = `${startPct}%`;
        this.endHandle.style.left = `${endPct}%`;
        this.timelineRegion.style.left = `${startPct}%`;
        this.timelineRegion.style.width = `${endPct - startPct}%`;
    }

    _updatePlayhead() {
        if (!this.hasVideo) return;
        if (this._loopPlaying && !this.videoEl.paused) {
            if (this.videoEl.currentTime >= this.trimEnd - 0.005) {
                this.videoEl.currentTime = this.trimStart;
            }
        }
        const pct = (this.videoEl.currentTime / this.duration) * 100;
        this.playhead.style.left = `${pct}%`;
        this._updateTimeLabel();
    }

    _toggleLoopPlay() {
        if (!this.hasVideo) return;
        if (this.videoEl.paused || this.videoEl.ended) {
            if (this.videoEl.currentTime < this.trimStart
                || this.videoEl.currentTime >= this.trimEnd - 0.005) {
                this.videoEl.currentTime = this.trimStart;
            }
            this._loopPlaying = true;
            this.videoEl.play().catch(() => {});
        } else {
            this._loopPlaying = false;
            this.videoEl.pause();
        }
    }

    _onPlayStateChange() {
        if (!this.playBtn) return;
        const playing = !this.videoEl.paused && !this.videoEl.ended;
        if (!playing) this._loopPlaying = false;
        this.playBtn.textContent = playing ? "⏸ Pause" : "▶ Play Loop";
    }

    _dragHandle(which, ev) {
        if (!this.hasVideo) return;
        const rect = this.timelineWrap.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
        const t = (x / rect.width) * this.duration;
        if (which === "start") {
            this.trimStart = Math.max(0, Math.min(t, this.trimEnd - 0.05));
        } else {
            this.trimEnd = Math.min(this.duration, Math.max(t, this.trimStart + 0.05));
        }
        this._renderTimeline();
        this.videoEl.currentTime = which === "start"
            ? this.trimStart
            : Math.max(0, this.trimEnd - 0.001);
        this._updateTimeLabel();
    }

    _onTimelineClick(e) {
        if (!this.hasVideo) return;
        if (this._suppressNextTimelineClick) {
            this._suppressNextTimelineClick = false;
            return;
        }
        if (e.target === this.startHandle || e.target === this.endHandle) return;
        const rect = this.timelineWrap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const t = (x / rect.width) * this.duration;
        this.videoEl.currentTime = Math.max(0, Math.min(t, Math.max(0, this.duration - 0.001)));
    }

    _setStartTo(t) {
        if (!this.hasVideo) return;
        this.trimStart = Math.max(0, Math.min(t, this.trimEnd - 0.05));
        this._renderTimeline();
        this.videoEl.currentTime = this.trimStart;
        this._writeWidgets();
        this._updateTimeLabel();
    }

    _setEndTo(t) {
        if (!this.hasVideo) return;
        this.trimEnd = Math.min(this.duration, Math.max(t, this.trimStart + 0.05));
        this._renderTimeline();
        this.videoEl.currentTime = Math.max(0, this.trimEnd - 0.001);
        this._writeWidgets();
        this._updateTimeLabel();
    }

    _updateTimeLabel() {
        if (!this.hasVideo) {
            this.timeLabel.textContent = "—";
            return;
        }
        const trimDur = Math.max(0, this.trimEnd - this.trimStart);
        this.timeLabel.textContent =
            `Trim: ${formatTime(this.trimStart)} → ${formatTime(this.trimEnd)}  (${trimDur.toFixed(2)}s of ${formatTime(this.duration)})`;
    }

    _writeWidgets() {
        // Write back to the FLOAT widgets so the workflow serializes them.
        if (this.startWidget && this.startWidget.value !== this.trimStart) {
            this.startWidget.value = this.trimStart;
        }
        if (this.endWidget && this.endWidget.value !== this.trimEnd) {
            this.endWidget.value = this.trimEnd;
        }
        if (this.node?.graph) this.node.graph.setDirtyCanvas(true, true);
    }

    async _uploadFile(file) {
        this.uploadBtn.disabled = true;
        const oldLabel = this.uploadBtn.textContent;
        this.uploadBtn.textContent = "Uploading…";
        this.statusLabel.textContent = `Uploading ${file.name}…`;
        try {
            const formData = new FormData();
            formData.append("video", file);
            const r = await fetch("/purz/media_extractor/upload", {
                method: "POST",
                body: formData,
            });
            if (!r.ok) throw new Error(`upload HTTP ${r.status}`);
            const info = await r.json();
            const savedName = info.name;

            const listResp = await api.fetchApi("/purz/media_extractor/list");
            const listData = await listResp.json();
            if (this.videoWidget) {
                this.videoWidget.options.values = listData.videos;
                this.videoWidget.value = savedName;
                if (this.videoWidget.callback) this.videoWidget.callback(savedName);
                else this._onVideoSelected(savedName);
            }
            this.statusLabel.textContent = `Uploaded ${savedName}`;
        } catch (err) {
            console.warn("[Purz VideoTrim Upload] upload failed:", err);
            this.statusLabel.textContent = `Upload failed: ${err.message || err}`;
        } finally {
            this.uploadBtn.disabled = false;
            this.uploadBtn.textContent = oldLabel;
        }
    }

    getElement() { return this.container; }

    computeSize(width) {
        const w = Math.max(this.minWidth, width || this.minWidth);
        const previewHeight = Math.max(140, Math.min(320, Math.round(w * 0.5)));
        const controlsHeight = 140;
        return [w, previewHeight + controlsHeight];
    }

    dispose() {
        if (this.videoEl) {
            this.videoEl.pause();
            this.videoEl.removeAttribute("src");
            this.videoEl.load();
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.node = null;
    }
}

const widgetInstances = new Map();

app.registerExtension({
    name: "purz.video_trim_upload",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PurzVideoTrimUpload") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) onNodeCreated.apply(this, arguments);

            const node = this;
            const widget = new VideoTrimUploadWidget(node);

            const domWidget = node.addDOMWidget(
                "video_trim_upload",
                "preview",
                widget.getElement(),
                { serialize: false, hideOnZoom: false }
            );
            domWidget.computeSize = (width) => widget.computeSize(width);

            widgetInstances.set(node.id, widget);
            node.videoTrimUploadWidget = widget;

            setTimeout(() => widget.bindWidgets(), 0);

            domWidget.onRemove = () => {
                const inst = widgetInstances.get(node.id);
                if (inst) {
                    inst.dispose();
                    widgetInstances.delete(node.id);
                }
            };

            node.setSize([380, 480]);

            const originalOnResize = node.onResize;
            node.onResize = function (size) {
                const minW = widget.minWidth || 320;
                if (size[0] < minW) size[0] = minW;
                if (originalOnResize) originalOnResize.apply(this, arguments);
                if (widget.hasVideo) widget._renderTimeline();
            };
        };
    },
});
