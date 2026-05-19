/**
 * Purz Video Crop — Path A (client-side).
 *
 * Loads a local video, lets the user set output dimensions + fit / anchor
 * / crop params, previews live (draws current video frame into the output
 * canvas every timeupdate). On Queue, plays the video while drawing each
 * frame into the canvas, captures the canvas stream + the video's audio
 * track via MediaRecorder, and ships the webm to
 * /purz/video_crop/set_baked?node_id=…
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import {
    ASPECT_PRESETS,
    drawFit,
    drawCropOverlay,
    deriveDimsFromSource,
    buildControlsPanel,
    makeButton,
    pickRecorderMime,
    attachCropDrag,
} from "./purz_resize_common.js";


class VideoCropWidget {
    constructor(node) {
        this.node = node;
        this.minWidth = 360;
        this.blobUrl = null;
        this.mediaName = "";
        this.sourceReady = false;
        this.duration = 0;
        this._bakeFresh = false;
        this.baking = false;
        this._userTouchedSize = false;

        this.outW = 1024;
        this.outH = 1024;
        this.aspectIdx = 0;
        this.fit_mode = "cover";
        this.anchor = "center";
        this.background_color = "#000000";
        this.zoom = 1.0;
        this.offset_x = 0.0;
        this.offset_y = 0.0;

        this._buildUI();
        this._renderPreview();
    }

    _buildUI() {
        this.container = document.createElement("div");
        Object.assign(this.container.style, {
            display: "flex", flexDirection: "column", width: "100%", height: "100%",
            background: "#1a1a1a", color: "#ddd", fontFamily: "sans-serif", fontSize: "11px",
            padding: "6px", boxSizing: "border-box", overflow: "hidden", gap: "6px",
            borderRadius: "4px",
        });

        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.accept = "video/*";
        this.fileInput.style.display = "none";
        this.fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this._loadFile(file);
            this.fileInput.value = "";
        });
        this.loadBtn = makeButton("⬆  Load Video", () => this.fileInput.click());
        this.playBtn = makeButton("▶ Play", () => this._togglePlay());
        this.playBtn.disabled = true;

        const topRow = document.createElement("div");
        Object.assign(topRow.style, { display: "flex", gap: "6px" });
        topRow.appendChild(this.loadBtn);
        topRow.appendChild(this.playBtn);
        topRow.appendChild(this.fileInput);

        this.statusLabel = document.createElement("div");
        Object.assign(this.statusLabel.style, {
            color: "#888", fontSize: "10px", padding: "2px 4px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        });
        this.statusLabel.textContent = "No video loaded";

        this.previewWrap = document.createElement("div");
        Object.assign(this.previewWrap.style, {
            flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: "120px", background: "#0d0d0d", border: "1px solid #2c2c2c",
            borderRadius: "3px", overflow: "hidden", position: "relative",
        });
        this.previewCanvas = document.createElement("canvas");
        this.previewCanvas.width = this.outW;
        this.previewCanvas.height = this.outH;
        Object.assign(this.previewCanvas.style, {
            maxWidth: "100%", maxHeight: "100%", objectFit: "contain", background: "#000",
        });
        this.previewCanvas.addEventListener("click", (e) => {
            e.stopPropagation();
            this._togglePlay();
        });
        this.previewWrap.appendChild(this.previewCanvas);

        attachCropDrag(this.previewCanvas, () => ({
            sourceEl: this.videoEl,
            sourceReady: this.sourceReady,
            outW: this.outW,
            outH: this.outH,
            fit_mode: this.fit_mode,
            anchor: this.anchor,
            zoom: this.zoom,
            offset_x: this.offset_x,
            offset_y: this.offset_y,
        }), ({ anchor, offset_x, offset_y }) => {
            this.anchor = anchor;
            this.offset_x = offset_x;
            this.offset_y = offset_y;
            this.controls.refresh(this._state());
            this._markStale();
            this._renderPreview();
        });

        this.videoEl = document.createElement("video");
        this.videoEl.style.display = "none";
        this.videoEl.muted = false;
        this.videoEl.playsInline = true;
        this.videoEl.preload = "auto";
        this.videoEl.addEventListener("loadedmetadata", () => this._onSourceReady());
        this.videoEl.addEventListener("timeupdate", () => this._renderPreview());
        this.videoEl.addEventListener("play", () => this._onPlayStateChange());
        this.videoEl.addEventListener("pause", () => this._onPlayStateChange());
        this.videoEl.addEventListener("ended", () => this._onPlayStateChange());

        this.controls = buildControlsPanel(this._state(), {
            onWidth: (v) => this._setWidth(v),
            onHeight: (v) => this._setHeight(v),
            onAspect: (i) => this._setAspectIndex(i),
            onFit: (v) => { this.fit_mode = v; this.controls.updateCropVisibility(v); this._markStale(); this._renderPreview(); },
            onAnchor: (v) => { this.anchor = v; this._markStale(); this._renderPreview(); },
            onBg: (v) => { this.background_color = v; this._markStale(); this._renderPreview(); },
            onZoom: (v) => { this.zoom = v; this._markStale(); this._renderPreview(); },
            onOffX: (v) => { this.offset_x = v; this._markStale(); this._renderPreview(); },
            onOffY: (v) => { this.offset_y = v; this._markStale(); this._renderPreview(); },
        });

        this.container.appendChild(topRow);
        this.container.appendChild(this.statusLabel);
        this.container.appendChild(this.previewWrap);
        this.container.appendChild(this.videoEl);
        this.container.appendChild(this.controls.element);
    }

    _state() {
        return {
            outW: this.outW, outH: this.outH, aspectIdx: this.aspectIdx,
            fit_mode: this.fit_mode, anchor: this.anchor,
            background_color: this.background_color,
            zoom: this.zoom, offset_x: this.offset_x, offset_y: this.offset_y,
        };
    }

    _loadFile(file) {
        if (this.blobUrl) { URL.revokeObjectURL(this.blobUrl); this.blobUrl = null; }
        this.mediaName = file.name;
        this.sourceReady = false;
        this._userTouchedSize = false;
        this.blobUrl = URL.createObjectURL(file);
        this.videoEl.src = this.blobUrl;
        this.videoEl.load();
        this.playBtn.disabled = false;
        this.statusLabel.textContent = file.name;
        this._markStale();
    }

    _onSourceReady() {
        this.sourceReady = true;
        this.duration = this.videoEl.duration || 0;
        if (!this._userTouchedSize) this._applyAspectFromSource();
        this._renderPreview();
    }

    _applyAspectFromSource() {
        if (!this.sourceReady) return;
        const dims = deriveDimsFromSource(
            this.videoEl.videoWidth, this.videoEl.videoHeight, this.aspectIdx,
        );
        if (!dims) return;
        this.outW = dims.w; this.outH = dims.h;
        this.controls.refresh(this._state());
    }

    _setWidth(v) {
        this._userTouchedSize = true;
        this.outW = Math.max(16, Math.min(16384, Math.round(v)));
        this._applyAspectLock("w");
        this.controls.refs.widthInput.value = this.outW;
        this._markStale();
        this._renderPreview();
    }
    _setHeight(v) {
        this._userTouchedSize = true;
        this.outH = Math.max(16, Math.min(16384, Math.round(v)));
        this._applyAspectLock("h");
        this.controls.refs.heightInput.value = this.outH;
        this._markStale();
        this._renderPreview();
    }
    _applyAspectLock(leader) {
        const preset = ASPECT_PRESETS[this.aspectIdx];
        if (!preset || preset.w === 0) return;
        if (leader === "w") {
            this.outH = Math.max(1, Math.round(this.outW * preset.h / preset.w));
            this.controls.refs.heightInput.value = this.outH;
        } else {
            this.outW = Math.max(1, Math.round(this.outH * preset.w / preset.h));
            this.controls.refs.widthInput.value = this.outW;
        }
    }
    _setAspectIndex(i) {
        this.aspectIdx = i;
        if (this.sourceReady) this._applyAspectFromSource();
        else this._applyAspectLock("w");
        this._markStale();
        this._renderPreview();
    }

    _markStale() { this._bakeFresh = false; }

    /**
     * Preview canvas dims sized to the SOURCE aspect (capped at 720px on
     * the longest side). The canvas size doesn't change as the user picks
     * different output aspects — only the green overlay moves.
     */
    _previewDims() {
        const MAX = 720;
        const sW = (this.videoEl && this.videoEl.videoWidth) || 256;
        const sH = (this.videoEl && this.videoEl.videoHeight) || 256;
        if (sW <= MAX && sH <= MAX) return { w: sW, h: sH };
        const scale = MAX / Math.max(sW, sH);
        return { w: Math.max(1, Math.round(sW * scale)), h: Math.max(1, Math.round(sH * scale)) };
    }

    _renderPreview() {
        if (!this.sourceReady) {
            if (this.previewCanvas.width !== 64) {
                this.previewCanvas.width = 64;
                this.previewCanvas.height = 64;
            }
            const ctx = this.previewCanvas.getContext("2d");
            ctx.fillStyle = "#0d0d0d";
            ctx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            return;
        }
        const { w, h } = this._previewDims();
        if (this.previewCanvas.width !== w) this.previewCanvas.width = w;
        if (this.previewCanvas.height !== h) this.previewCanvas.height = h;
        const ctx = this.previewCanvas.getContext("2d");
        ctx.imageSmoothingQuality = "low";
        drawCropOverlay(ctx, this.videoEl, w, h, this.outW, this.outH, this._state());
        const draggable = this.sourceReady && (this.fit_mode === "cover" || this.fit_mode === "crop");
        this.previewCanvas.style.cursor = draggable ? "move" : "default";
    }

    _startRVFCLoop() {
        if (this._rvfcActive) return;
        if (!this.videoEl.requestVideoFrameCallback) return;
        this._rvfcActive = true;
        const tick = () => {
            if (!this._rvfcActive) return;
            this._renderPreview();
            this.videoEl.requestVideoFrameCallback(tick);
        };
        this.videoEl.requestVideoFrameCallback(tick);
    }
    _stopRVFCLoop() { this._rvfcActive = false; }

    _togglePlay() {
        if (!this.sourceReady) return;
        if (this.videoEl.paused || this.videoEl.ended) {
            if (this.videoEl.ended || this.videoEl.currentTime >= this.duration - 0.01) {
                this.videoEl.currentTime = 0;
            }
            this.videoEl.play().catch(() => {});
        } else {
            this.videoEl.pause();
        }
    }

    _onPlayStateChange() {
        const playing = !this.videoEl.paused && !this.videoEl.ended;
        this.playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
        if (playing) this._startRVFCLoop();
        else this._stopRVFCLoop();
    }

    async handleBakeRequest() {
        if (!this.node || this.node.id == null) return;
        const nodeId = this.node.id;
        try {
            if (!this.sourceReady) {
                await fetch(`/purz/video_crop/set_baked?node_id=${encodeURIComponent(nodeId)}`, {
                    method: "POST", body: new Blob([]),
                });
                return;
            }
            if (this._bakeFresh) {
                await fetch("/purz/video_crop/bake_ready", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ node_id: nodeId }),
                });
                return;
            }
            await this._bakeVideo(nodeId);
        } catch (err) {
            console.warn("[Purz VideoCrop] bake failed:", err);
            try {
                await fetch("/purz/video_crop/bake_ready", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ node_id: nodeId }),
                });
            } catch (_) {}
        }
    }

    async _bakeVideo(nodeId) {
        if (!this.duration || this.duration <= 0) throw new Error("invalid video duration");
        const mime = pickRecorderMime();
        if (!mime) throw new Error("MediaRecorder webm unsupported");

        this.baking = true;
        const previousMute = this.videoEl.muted;
        this.videoEl.muted = true;

        const canvas = document.createElement("canvas");
        canvas.width = this.outW; canvas.height = this.outH;
        const ctx = canvas.getContext("2d");

        const canvasStream = canvas.captureStream(30);
        const videoStream = this.videoEl.captureStream ? this.videoEl.captureStream() : this.videoEl.mozCaptureStream?.();
        const audioTrack = videoStream ? videoStream.getAudioTracks()[0] : null;
        if (audioTrack) canvasStream.addTrack(audioTrack);

        const recorder = new MediaRecorder(canvasStream, { mimeType: mime });
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

        let stopDraw = false;
        const drawLoop = () => {
            if (stopDraw) return;
            drawFit(ctx, this.videoEl, this.outW, this.outH, this._state());
            if (this.videoEl.requestVideoFrameCallback) {
                this.videoEl.requestVideoFrameCallback(drawLoop);
            } else {
                requestAnimationFrame(drawLoop);
            }
        };

        await new Promise((resolve) => {
            const onSeeked = () => { this.videoEl.removeEventListener("seeked", onSeeked); resolve(); };
            this.videoEl.addEventListener("seeked", onSeeked);
            this.videoEl.currentTime = 0;
        });

        recorder.start(100);
        drawLoop();
        this.videoEl.play().catch(() => {});

        const startWallclock = performance.now();
        const tick = () => {
            if (!this.baking) return;
            const elapsed = (performance.now() - startWallclock) / 1000;
            const progress = Math.min(100, (elapsed / this.duration) * 100);
            this.statusLabel.textContent = `Baking video… ${progress.toFixed(0)}%`;
            if (this.videoEl.ended || this.videoEl.currentTime >= this.duration - 0.005 || elapsed > this.duration + 1.0) {
                stopDraw = true;
                this.videoEl.pause();
                try { recorder.stop(); } catch (_) {}
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        try {
            await stopped;
            const blob = new Blob(chunks, { type: mime });
            if (blob.size === 0) throw new Error("empty recording");
            this.statusLabel.textContent = `Uploading ${(blob.size / 1024 / 1024).toFixed(1)} MB…`;
            const resp = await fetch(`/purz/video_crop/set_baked?node_id=${encodeURIComponent(nodeId)}`, {
                method: "POST", body: blob, headers: { "Content-Type": mime },
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            this._bakeFresh = true;
            this.statusLabel.textContent = `Baked ${this.outW}×${this.outH} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`;
        } finally {
            this.baking = false;
            this.videoEl.muted = previousMute;
        }
    }

    getElement() { return this.container; }
    computeSize(width) {
        const w = Math.max(this.minWidth, width || this.minWidth);
        const previewHeight = Math.max(160, Math.min(360, Math.round(w * 0.45)));
        return [w, previewHeight + 170];
    }
    dispose() {
        this.baking = false;
        if (this.blobUrl) { URL.revokeObjectURL(this.blobUrl); this.blobUrl = null; }
        if (this.videoEl) {
            this.videoEl.pause();
            this.videoEl.removeAttribute("src");
            this.videoEl.load();
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        if (this.node && this.node.id != null) {
            fetch(`/purz/video_crop/set_baked?node_id=${encodeURIComponent(this.node.id)}`, {
                method: "POST", body: new Blob([]),
            }).catch(() => {});
        }
        this.node = null;
    }
}


const widgetInstances = new Map();

app.registerExtension({
    name: "purz.video_crop",

    async setup() {
        api.addEventListener("purz.video_crop.bake_requested", async (event) => {
            const { node_id } = event.detail || {};
            if (node_id == null) return;
            let node = app.graph._nodes_by_id?.[node_id];
            if (!node) node = app.graph._nodes_by_id?.[parseInt(node_id, 10)];
            if (!node || !node.videoCropWidget) {
                try {
                    await fetch("/purz/video_crop/bake_ready", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ node_id }),
                    });
                } catch (_) {}
                return;
            }
            await node.videoCropWidget.handleBakeRequest();
        });
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PurzVideoCrop") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) onNodeCreated.apply(this, arguments);
            const node = this;
            const widget = new VideoCropWidget(node);
            const domWidget = node.addDOMWidget(
                "video_crop", "preview", widget.getElement(),
                { serialize: false, hideOnZoom: false }
            );
            domWidget.computeSize = (width) => widget.computeSize(width);
            widgetInstances.set(node.id, widget);
            node.videoCropWidget = widget;
            domWidget.onRemove = () => {
                const inst = widgetInstances.get(node.id);
                if (inst) { inst.dispose(); widgetInstances.delete(node.id); }
            };
            node.setSize([400, 560]);
            const origResize = node.onResize;
            node.onResize = function (size) {
                if (size[0] < widget.minWidth) size[0] = widget.minWidth;
                if (origResize) origResize.apply(this, arguments);
            };
        };
    },
});
