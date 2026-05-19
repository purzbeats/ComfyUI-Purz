/**
 * Purz Media Extractor (Upload) — Path B.
 *
 * Persists across reloads. The user uploads a video to ComfyUI's input/
 * directory; the workflow remembers the filename + frame_index. Preview
 * uses the same /view?type=input URL ComfyUI already serves, so scrubbing
 * is in-browser (no per-scrub upload). On execute, the backend opens the
 * file with cv2 and seeks to the chosen frame_index.
 *
 * The default ComfyUI widget shown for this node is the regular Combo
 * (video) + INT (frame_index). We augment it with an upload button,
 * a <video> preview, a timeline scrubber, and First/Last buttons that
 * write back to frame_index.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00.000";
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

class MediaExtractorUploadWidget {
    constructor(node) {
        this.node = node;
        this.minWidth = 280;
        this.duration = 0;
        this.fps = 0;
        this.totalFrames = 0;
        this.hasVideo = false;
        this._buildUI();
    }

    _buildUI() {
        this.container = document.createElement("div");
        Object.assign(this.container.style, {
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "#1a1a1a",
            color: "#ddd",
            fontFamily: "sans-serif",
            fontSize: "11px",
            padding: "6px",
            boxSizing: "border-box",
            overflow: "hidden",
            gap: "6px",
            borderRadius: "4px",
        });

        // Upload button + hidden file input
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
            color: "#888",
            fontSize: "10px",
            padding: "2px 4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        });
        this.statusLabel.textContent = "";

        // Preview
        this.previewWrap = document.createElement("div");
        Object.assign(this.previewWrap.style, {
            flex: "1 1 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "120px",
            background: "#0d0d0d",
            border: "1px solid #2c2c2c",
            borderRadius: "3px",
            overflow: "hidden",
        });

        this.videoEl = document.createElement("video");
        this.videoEl.muted = true;
        this.videoEl.playsInline = true;
        this.videoEl.preload = "auto";
        Object.assign(this.videoEl.style, {
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            display: "none",
            background: "#000",
        });
        this.videoEl.addEventListener("loadedmetadata", () => this._onVideoMetadata());
        this.videoEl.addEventListener("seeked", () => this._updateTimeLabel());
        this.videoEl.addEventListener("timeupdate", () => this._onTimeUpdate());
        this.videoEl.addEventListener("play", () => this._onPlayStateChange());
        this.videoEl.addEventListener("pause", () => this._onPlayStateChange(true));
        this.videoEl.addEventListener("ended", () => this._onPlayStateChange(true));
        this.videoEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this._togglePlay();
        });

        this.previewPlaceholder = document.createElement("div");
        Object.assign(this.previewPlaceholder.style, {
            color: "#777",
            fontStyle: "italic",
            textAlign: "center",
            padding: "12px",
        });
        this.previewPlaceholder.textContent = "Pick a video from the dropdown above, or upload one";

        this.previewWrap.appendChild(this.videoEl);
        this.previewWrap.appendChild(this.previewPlaceholder);

        this.timeLabel = document.createElement("div");
        Object.assign(this.timeLabel.style, {
            textAlign: "center",
            color: "#bbb",
            padding: "1px 0",
            fontVariantNumeric: "tabular-nums",
            fontSize: "10px",
        });
        this.timeLabel.textContent = "—";

        this.scrubber = document.createElement("input");
        this.scrubber.type = "range";
        this.scrubber.min = "0";
        this.scrubber.max = "0";
        this.scrubber.value = "0";
        this.scrubber.step = "1";
        this.scrubber.disabled = true;
        Object.assign(this.scrubber.style, {
            width: "100%",
            margin: "0",
            accentColor: "#4a9eff",
            cursor: "pointer",
        });
        this.scrubber.addEventListener("input", () => this._onScrubInput());
        this.scrubber.addEventListener("change", () => this._writeFrameIndex(parseInt(this.scrubber.value, 10)));
        this.scrubber.addEventListener("mousedown", (e) => e.stopPropagation());
        this.scrubber.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            if (this.hasVideo && !this.videoEl.paused) this.videoEl.pause();
        });

        const btnRow = document.createElement("div");
        Object.assign(btnRow.style, { display: "flex", gap: "6px" });

        this.playBtn = this._makeButton("▶ Play", () => this._togglePlay());
        this.firstBtn = this._makeButton("⏮ First", () => this._seekFrame(0));
        this.lastBtn = this._makeButton("Last ⏭", () => this._seekFrame((this.totalFrames || 1) - 1));
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
        this.container.appendChild(this.scrubber);
        this.container.appendChild(btnRow);
    }

    _makeButton(label, onClick) {
        const btn = document.createElement("button");
        btn.textContent = label;
        Object.assign(btn.style, {
            flex: "1",
            padding: "6px 8px",
            background: "#2a2a2a",
            color: "#ddd",
            border: "1px solid #3a3a3a",
            borderRadius: "3px",
            cursor: "pointer",
            fontSize: "11px",
            fontFamily: "inherit",
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

    // ---- Wiring to the standard ComfyUI widgets ---------------------------

    bindWidgets() {
        this.videoWidget = this.node.widgets?.find((w) => w.name === "video");
        this.frameWidget = this.node.widgets?.find((w) => w.name === "frame_index");
        if (!this.videoWidget || !this.frameWidget) return;

        const origVideoCallback = this.videoWidget.callback;
        this.videoWidget.callback = (value) => {
            if (origVideoCallback) origVideoCallback.call(this.videoWidget, value);
            this._onVideoSelected(value);
        };

        const origFrameCallback = this.frameWidget.callback;
        this.frameWidget.callback = (value) => {
            if (origFrameCallback) origFrameCallback.call(this.frameWidget, value);
            this._onFrameIndexExternal(value);
        };

        // Initial load: if the workflow restored a saved video, pull it in.
        if (this.videoWidget.value) {
            this._onVideoSelected(this.videoWidget.value);
        }
    }

    async _onVideoSelected(filename) {
        if (!filename || filename === "(no video)") {
            this._clearPreview();
            return;
        }
        const params = new URLSearchParams({
            filename: filename,
            type: "input",
            subfolder: "",
        });
        this.videoEl.src = `/view?${params.toString()}`;
        this.videoEl.load();
        this.statusLabel.textContent = `Loading ${filename}…`;

        // Pull cv2-derived metadata (fps, total_frames)
        try {
            const r = await api.fetchApi(`/purz/media_extractor/info/${encodeURIComponent(filename)}`);
            if (r.ok) {
                const info = await r.json();
                this.fps = info.fps || 0;
                this.totalFrames = info.total_frames || 0;
            }
        } catch (err) {
            console.warn("[Purz MediaExtractor Upload] info fetch failed:", err);
        }
    }

    _onVideoMetadata() {
        this.duration = this.videoEl.duration || 0;
        this.hasVideo = this.duration > 0;
        if (!this.hasVideo) return;

        // If cv2 didn't give us frame count, estimate from duration.
        if (!this.totalFrames && this.duration > 0) {
            const fpsGuess = this.fps || 30;
            this.totalFrames = Math.max(1, Math.round(this.duration * fpsGuess));
        }
        // If cv2 didn't give us fps, derive from totalFrames / duration.
        if (!this.fps && this.totalFrames > 0 && this.duration > 0) {
            this.fps = this.totalFrames / this.duration;
        }

        this.scrubber.max = String(Math.max(0, this.totalFrames - 1));
        this.scrubber.disabled = this.totalFrames <= 1;
        this.playBtn.disabled = false;
        this.firstBtn.disabled = false;
        this.lastBtn.disabled = false;
        this.previewPlaceholder.style.display = "none";
        this.videoEl.style.display = "";
        this.statusLabel.textContent = `${this.totalFrames} frames @ ${this.fps.toFixed(2)} fps`;

        // Reflect the existing frame_index widget value in the scrubber.
        const idx = (this.frameWidget && Number.isFinite(this.frameWidget.value))
            ? this.frameWidget.value : 0;
        this._seekFrame(idx, false);
    }

    _clearPreview() {
        this.videoEl.removeAttribute("src");
        this.videoEl.load();
        this.videoEl.style.display = "none";
        this.previewPlaceholder.style.display = "";
        this.scrubber.value = "0";
        this.scrubber.max = "0";
        this.scrubber.disabled = true;
        this.playBtn.disabled = true;
        this.firstBtn.disabled = true;
        this.lastBtn.disabled = true;
        this.hasVideo = false;
        this.duration = 0;
        this.totalFrames = 0;
        this.fps = 0;
        this.timeLabel.textContent = "—";
        this.statusLabel.textContent = "";
    }

    _togglePlay() {
        if (!this.hasVideo) return;
        if (this.videoEl.paused || this.videoEl.ended) {
            if (this.videoEl.ended || this.videoEl.currentTime >= this.duration - 0.01) {
                this.videoEl.currentTime = 0;
            }
            this.videoEl.play().catch(() => {});
        } else {
            this.videoEl.pause();
        }
    }

    _onTimeUpdate() {
        // Follow playback with the scrubber + playhead, but skip while paused
        // (the user might be scrubbing manually).
        if (!this.hasVideo || this.videoEl.paused) return;
        if (this.fps > 0) {
            const idx = Math.max(0, Math.min(Math.round(this.videoEl.currentTime * this.fps), this.totalFrames - 1));
            this.scrubber.value = String(idx);
            this._updateTimeLabel(this.videoEl.currentTime, idx);
        } else {
            this._updateTimeLabel();
        }
    }

    _onPlayStateChange(isPause = false) {
        if (!this.playBtn) return;
        const playing = !this.videoEl.paused && !this.videoEl.ended;
        this.playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
        // On pause, persist the current frame index back to the FLOAT widget
        // so the workflow reflects whatever the user landed on.
        if (isPause && this.hasVideo && this.fps > 0) {
            const idx = Math.max(0, Math.min(Math.round(this.videoEl.currentTime * this.fps), this.totalFrames - 1));
            this.scrubber.value = String(idx);
            this._writeFrameIndex(idx);
            this._updateTimeLabel(this.videoEl.currentTime, idx);
        }
    }

    _onScrubInput() {
        if (!this.hasVideo) return;
        const idx = parseInt(this.scrubber.value, 10);
        this._seekFrame(idx, false);
    }

    _onFrameIndexExternal(value) {
        // User typed in the INT widget directly.
        if (!this.hasVideo) return;
        const idx = Math.max(0, Math.min(value | 0, Math.max(0, this.totalFrames - 1)));
        this.scrubber.value = String(idx);
        this._seekFrame(idx, false);
    }

    _seekFrame(idx, writeBack = true) {
        if (!this.hasVideo) return;
        const clamped = Math.max(0, Math.min(idx | 0, Math.max(0, this.totalFrames - 1)));
        this.scrubber.value = String(clamped);
        const t = this.fps > 0 ? clamped / this.fps : 0;
        const safeT = Math.min(t, Math.max(0, this.duration - 0.001));
        this.videoEl.currentTime = safeT;
        this._updateTimeLabel(safeT, clamped);
        if (writeBack) this._writeFrameIndex(clamped);
    }

    _writeFrameIndex(idx) {
        if (!this.frameWidget) return;
        if (this.frameWidget.value !== idx) {
            this.frameWidget.value = idx;
            // notify ComfyUI of the change so workflow serialization picks it up
            if (this.node?.graph) this.node.graph.setDirtyCanvas(true, true);
            this.node?.onWidgetChanged?.("frame_index", idx, this.frameWidget.value, this.frameWidget);
        }
    }

    _updateTimeLabel(t, idx) {
        if (!this.hasVideo) {
            this.timeLabel.textContent = "—";
            return;
        }
        const cur = t !== undefined ? t : this.videoEl.currentTime;
        const i = idx !== undefined ? idx : Math.round(cur * (this.fps || 0));
        this.timeLabel.textContent =
            `Frame ${i + 1} / ${this.totalFrames}  •  ${formatTime(cur)} / ${formatTime(this.duration)}`;
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
            if (!r.ok) throw new Error(`upload failed: HTTP ${r.status}`);
            const info = await r.json();
            const savedName = info.name;

            // Refresh combo options from the server
            const listResp = await api.fetchApi("/purz/media_extractor/list");
            const listData = await listResp.json();
            if (this.videoWidget) {
                this.videoWidget.options.values = listData.videos;
                this.videoWidget.value = savedName;
                if (this.videoWidget.callback) {
                    this.videoWidget.callback(savedName);
                } else {
                    this._onVideoSelected(savedName);
                }
            }

            // Reset to frame 0 for the new clip.
            this._writeFrameIndex(0);
            this.statusLabel.textContent = `Uploaded ${savedName}`;
        } catch (err) {
            console.warn("[Purz MediaExtractor Upload] upload failed:", err);
            this.statusLabel.textContent = `Upload failed: ${err.message || err}`;
        } finally {
            this.uploadBtn.disabled = false;
            this.uploadBtn.textContent = oldLabel;
        }
    }

    getElement() {
        return this.container;
    }

    computeSize(width) {
        const w = Math.max(this.minWidth, width || this.minWidth);
        const previewHeight = Math.max(140, Math.min(360, Math.round(w * 0.6)));
        const controlsHeight = 116;
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
    name: "purz.media_extractor_upload",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PurzMediaExtractorUpload") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) onNodeCreated.apply(this, arguments);

            const node = this;
            const widget = new MediaExtractorUploadWidget(node);

            const domWidget = node.addDOMWidget(
                "media_extractor_upload",
                "preview",
                widget.getElement(),
                { serialize: false, hideOnZoom: false }
            );
            domWidget.computeSize = (width) => widget.computeSize(width);

            widgetInstances.set(node.id, widget);
            node.mediaExtractorUploadWidget = widget;

            // Wait a tick so the standard widgets exist before we bind.
            setTimeout(() => widget.bindWidgets(), 0);

            domWidget.onRemove = () => {
                const inst = widgetInstances.get(node.id);
                if (inst) {
                    inst.dispose();
                    widgetInstances.delete(node.id);
                }
            };

            node.setSize([360, 460]);

            const originalOnResize = node.onResize;
            node.onResize = function (size) {
                const minW = widget.minWidth || 280;
                if (size[0] < minW) size[0] = minW;
                if (originalOnResize) originalOnResize.apply(this, arguments);
            };
        };
    },
});
