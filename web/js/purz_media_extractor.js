/**
 * Purz Media Extractor — Path A (client-side video).
 *
 * The video file never touches the server. User picks a local file via
 * <input type="file">, we wrap it in a blob URL and feed it to an HTML5
 * <video> element. Scrubbing seeks `currentTime`. On commit (file load /
 * First / Last / scrubber release) we draw the current frame to a
 * <canvas>, encode it as PNG, and POST that single frame to
 * /purz/media_extractor/set_frame. The backend caches it per node and
 * outputs it on the next workflow execution.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00.000";
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

class MediaExtractorWidget {
    constructor(node) {
        this.node = node;
        this.minWidth = 280;
        this.blobUrl = null;
        this.videoName = "";
        this.duration = 0;
        this.fps = 0;
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

        // ---- Load Video button + hidden file input ------------------------
        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.accept = "video/*";
        this.fileInput.style.display = "none";
        this.fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this._loadFile(file);
            this.fileInput.value = ""; // allow re-picking same file
        });

        this.loadBtn = this._makeButton("⬆  Load Video", () => this.fileInput.click());
        this.loadBtn.style.flex = "1 1 auto";

        this.fileLabel = document.createElement("div");
        Object.assign(this.fileLabel.style, {
            color: "#888",
            fontSize: "10px",
            padding: "2px 4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        });
        this.fileLabel.textContent = "No video loaded";

        const loadRow = document.createElement("div");
        Object.assign(loadRow.style, { display: "flex", gap: "6px", alignItems: "center" });
        loadRow.appendChild(this.loadBtn);
        loadRow.appendChild(this.fileInput);

        // ---- Video preview ------------------------------------------------
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
            position: "relative",
        });

        this.videoEl = document.createElement("video");
        this.videoEl.muted = true;
        this.videoEl.playsInline = true;
        this.videoEl.preload = "auto";
        // Some browsers won't paint a frame until play() once; the loadedmetadata
        // handler will nudge it to currentTime = 0 to render the first frame.
        Object.assign(this.videoEl.style, {
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            display: "none",
            background: "#000",
        });
        this.videoEl.addEventListener("loadedmetadata", () => this._onVideoMetadata());
        this.videoEl.addEventListener("seeked", () => this._onSeeked());
        this.videoEl.addEventListener("timeupdate", () => this._onTimeUpdate());
        this.videoEl.addEventListener("play", () => this._onPlayStateChange());
        this.videoEl.addEventListener("pause", () => this._onPlayStateChange(true));
        this.videoEl.addEventListener("ended", () => this._onPlayStateChange(true));
        this.videoEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this._togglePlay();
        });
        this.videoEl.addEventListener("error", () => {
            console.warn("[Purz MediaExtractor] video error", this.videoEl.error);
        });

        this.previewPlaceholder = document.createElement("div");
        this.previewPlaceholder.textContent = "Click \"Load Video\" to pick a local file";
        Object.assign(this.previewPlaceholder.style, {
            color: "#777",
            fontStyle: "italic",
            textAlign: "center",
            padding: "12px",
        });

        this.previewWrap.appendChild(this.videoEl);
        this.previewWrap.appendChild(this.previewPlaceholder);

        // Hidden canvas for frame capture
        this.canvas = document.createElement("canvas");
        this.canvas.style.display = "none";

        // ---- Time label ---------------------------------------------------
        this.timeLabel = document.createElement("div");
        Object.assign(this.timeLabel.style, {
            textAlign: "center",
            color: "#bbb",
            padding: "1px 0",
            fontVariantNumeric: "tabular-nums",
            fontSize: "10px",
        });
        this.timeLabel.textContent = "—";

        // ---- Scrubber -----------------------------------------------------
        // Range 0..1000 maps to 0..duration. Step at 1ms-ish granularity.
        this.scrubber = document.createElement("input");
        this.scrubber.type = "range";
        this.scrubber.min = "0";
        this.scrubber.max = "1000";
        this.scrubber.value = "0";
        this.scrubber.step = "1";
        this.scrubber.disabled = true;
        Object.assign(this.scrubber.style, {
            width: "100%",
            margin: "0",
            accentColor: "#4a9eff",
            cursor: "pointer",
        });
        // Live preview during drag (no network).
        this.scrubber.addEventListener("input", () => this._onScrubInput());
        // Commit on release.
        this.scrubber.addEventListener("change", () => this._commitCurrentFrame());
        // Don't let LiteGraph eat the drag events.
        this.scrubber.addEventListener("mousedown", (e) => e.stopPropagation());
        this.scrubber.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            // Pause playback so the user's scrub isn't fought by timeupdate.
            if (this.hasVideo && !this.videoEl.paused) this.videoEl.pause();
        });

        // ---- Play / First / Last buttons ---------------------------------
        const btnRow = document.createElement("div");
        Object.assign(btnRow.style, { display: "flex", gap: "6px" });

        this.playBtn = this._makeButton("▶ Play", () => this._togglePlay());
        this.firstBtn = this._makeButton("⏮ First", () => this._seekFraction(0));
        this.lastBtn = this._makeButton("Last ⏭", () => this._seekFraction(1));
        this.playBtn.disabled = true;
        this.firstBtn.disabled = true;
        this.lastBtn.disabled = true;

        btnRow.appendChild(this.playBtn);
        btnRow.appendChild(this.firstBtn);
        btnRow.appendChild(this.lastBtn);

        this.container.appendChild(loadRow);
        this.container.appendChild(this.fileLabel);
        this.container.appendChild(this.previewWrap);
        this.container.appendChild(this.canvas);
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

    _loadFile(file) {
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
        }
        this.videoName = file.name;
        this.fileLabel.textContent = file.name;
        this.blobUrl = URL.createObjectURL(file);
        this.videoEl.src = this.blobUrl;
        // load() is automatic when src changes, but be explicit
        this.videoEl.load();
    }

    _onVideoMetadata() {
        this.duration = this.videoEl.duration || 0;
        this.hasVideo = this.duration > 0;
        if (!this.hasVideo) return;

        this.canvas.width = this.videoEl.videoWidth || 1;
        this.canvas.height = this.videoEl.videoHeight || 1;

        this.scrubber.disabled = false;
        this.playBtn.disabled = false;
        this.firstBtn.disabled = false;
        this.lastBtn.disabled = false;
        this.previewPlaceholder.style.display = "none";
        this.videoEl.style.display = "";

        // Nudge to t=0 so a frame actually paints
        this.videoEl.currentTime = 0;
        this.scrubber.value = "0";
        this._updateTimeLabel();
    }

    _onSeeked() {
        // currentTime updated. Update display. Don't auto-commit during scrubbing;
        // commit fires from the scrubber's 'change' event.
        this._updateTimeLabel();
    }

    _onScrubInput() {
        if (!this.hasVideo) return;
        const fraction = parseInt(this.scrubber.value, 10) / 1000;
        const t = Math.max(0, Math.min(fraction * this.duration, Math.max(0, this.duration - 0.001)));
        this.videoEl.currentTime = t;
        this._updateTimeLabel(t);
    }

    _togglePlay() {
        if (!this.hasVideo) return;
        if (this.videoEl.paused || this.videoEl.ended) {
            // If we're at the end, restart from the beginning
            if (this.videoEl.ended || this.videoEl.currentTime >= this.duration - 0.01) {
                this.videoEl.currentTime = 0;
            }
            this.videoEl.play().catch(() => {});
        } else {
            this.videoEl.pause();
        }
    }

    _onTimeUpdate() {
        // Update the scrubber position to follow playback. Skip while paused
        // so the user's manual scrubbing isn't fought by our own writes.
        if (!this.hasVideo || this.videoEl.paused) return;
        if (this.duration <= 0) return;
        const fraction = this.videoEl.currentTime / this.duration;
        this.scrubber.value = String(Math.round(fraction * 1000));
        this._updateTimeLabel();
    }

    _onPlayStateChange(isPause = false) {
        if (!this.playBtn) return;
        const playing = !this.videoEl.paused && !this.videoEl.ended;
        this.playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
        // Pausing (or video ending) commits the current frame so whatever
        // the user landed on is what the workflow will output.
        if (isPause) this._commitCurrentFrame();
    }

    _seekFraction(fraction) {
        if (!this.hasVideo) return;
        const f = Math.max(0, Math.min(1, fraction));
        this.scrubber.value = String(Math.round(f * 1000));
        const t = f === 1
            ? Math.max(0, this.duration - 0.001)  // last-frame safety margin
            : f * this.duration;
        this.videoEl.currentTime = t;
        this._updateTimeLabel(t);
        // First / Last are commits.
        this._commitCurrentFrame();
    }

    _updateTimeLabel(t) {
        const cur = t !== undefined ? t : this.videoEl.currentTime;
        if (!this.hasVideo) {
            this.timeLabel.textContent = "—";
            return;
        }
        this.timeLabel.textContent = `${formatTime(cur)} / ${formatTime(this.duration)}`;
    }

    async _commitCurrentFrame() {
        if (!this.hasVideo || !this.node || this.node.id == null) return;
        // Wait for any pending seek to land before drawing.
        if (this.videoEl.seeking) {
            await new Promise((resolve) => {
                const handler = () => {
                    this.videoEl.removeEventListener("seeked", handler);
                    resolve();
                };
                this.videoEl.addEventListener("seeked", handler);
            });
        }
        try {
            const ctx = this.canvas.getContext("2d");
            ctx.drawImage(this.videoEl, 0, 0, this.canvas.width, this.canvas.height);
            const dataUrl = this.canvas.toDataURL("image/png");

            api.fetchApi("/purz/media_extractor/set_frame", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    node_id: this.node.id,
                    frame: dataUrl,
                }),
            }).catch((err) => {
                console.warn("[Purz MediaExtractor] commit failed:", err);
            });
        } catch (err) {
            console.warn("[Purz MediaExtractor] frame capture failed:", err);
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
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
        }
        if (this.videoEl) {
            this.videoEl.pause();
            this.videoEl.removeAttribute("src");
            this.videoEl.load();
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        // Clear any cached frame on the backend so we don't leak old PNGs
        if (this.node && this.node.id != null) {
            api.fetchApi("/purz/media_extractor/set_frame", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ node_id: this.node.id, frame: "" }),
            }).catch(() => {});
        }
        this.node = null;
    }
}

const widgetInstances = new Map();

app.registerExtension({
    name: "purz.media_extractor",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PurzMediaExtractor") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) onNodeCreated.apply(this, arguments);

            const node = this;
            const widget = new MediaExtractorWidget(node);

            const domWidget = node.addDOMWidget(
                "media_extractor",
                "preview",
                widget.getElement(),
                { serialize: false, hideOnZoom: false }
            );
            domWidget.computeSize = (width) => widget.computeSize(width);

            widgetInstances.set(node.id, widget);
            node.mediaExtractorWidget = widget;

            domWidget.onRemove = () => {
                const inst = widgetInstances.get(node.id);
                if (inst) {
                    inst.dispose();
                    widgetInstances.delete(node.id);
                }
            };

            node.setSize([320, 420]);

            const originalOnResize = node.onResize;
            node.onResize = function (size) {
                const minW = widget.minWidth || 280;
                if (size[0] < minW) size[0] = minW;
                if (originalOnResize) originalOnResize.apply(this, arguments);
            };
        };
    },
});
