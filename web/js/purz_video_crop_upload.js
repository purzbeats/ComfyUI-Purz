/**
 * Purz Video Crop Upload — Path B.
 *
 * Adds an "Upload Video" button + a live preview canvas on top of the
 * standard ComfyUI widgets. All resize params are real widgets so they
 * serialize with the workflow. Backend handles resize per-frame on Queue.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { drawFit, drawCropOverlay, makeButton, attachCropDrag } from "./purz_resize_common.js";


class VideoCropUploadWidget {
    constructor(node) {
        this.node = node;
        this.minWidth = 380;
        this.sourceReady = false;
        this.duration = 0;
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

        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.accept = "video/*";
        this.fileInput.style.display = "none";
        this.fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this._uploadFile(file);
            this.fileInput.value = "";
        });
        this.uploadBtn = makeButton("⬆  Upload Video", () => this.fileInput.click());
        this.playBtn = makeButton("▶ Play", () => this._togglePlay());
        this.playBtn.disabled = true;

        const topRow = document.createElement("div");
        Object.assign(topRow.style, { display: "flex", gap: "6px" });
        topRow.appendChild(this.uploadBtn);
        topRow.appendChild(this.playBtn);
        topRow.appendChild(this.fileInput);

        this.statusLabel = document.createElement("div");
        Object.assign(this.statusLabel.style, {
            color: "#888", fontSize: "10px", padding: "2px 4px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        });
        this.statusLabel.textContent = "";

        this.previewWrap = document.createElement("div");
        Object.assign(this.previewWrap.style, {
            flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: "140px", background: "#0d0d0d", border: "1px solid #2c2c2c",
            borderRadius: "3px", overflow: "hidden",
        });
        this.previewCanvas = document.createElement("canvas");
        this.previewCanvas.width = 512; this.previewCanvas.height = 512;
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
            outW: Math.max(16, Math.round(this.widthWidget?.value || 1024)),
            outH: Math.max(16, Math.round(this.heightWidget?.value || 1024)),
            fit_mode: this.fitWidget?.value || "cover",
            anchor: this.anchorWidget?.value || "center",
            zoom: this.zoomWidget?.value || 1,
            offset_x: this.offXWidget?.value || 0,
            offset_y: this.offYWidget?.value || 0,
        }), ({ anchor, offset_x, offset_y }) => {
            if (this.anchorWidget) this.anchorWidget.value = anchor;
            if (this.offXWidget) this.offXWidget.value = offset_x;
            if (this.offYWidget) this.offYWidget.value = offset_y;
            if (this.node?.graph) this.node.graph.setDirtyCanvas(true, true);
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

        this.container.appendChild(topRow);
        this.container.appendChild(this.statusLabel);
        this.container.appendChild(this.previewWrap);
        this.container.appendChild(this.videoEl);
    }

    bindWidgets() {
        this.videoWidget = this.node.widgets?.find((w) => w.name === "video");
        this.widthWidget = this.node.widgets?.find((w) => w.name === "width");
        this.heightWidget = this.node.widgets?.find((w) => w.name === "height");
        this.fitWidget = this.node.widgets?.find((w) => w.name === "fit_mode");
        this.anchorWidget = this.node.widgets?.find((w) => w.name === "anchor");
        this.bgWidget = this.node.widgets?.find((w) => w.name === "background_color");
        this.zoomWidget = this.node.widgets?.find((w) => w.name === "zoom");
        this.offXWidget = this.node.widgets?.find((w) => w.name === "offset_x");
        this.offYWidget = this.node.widgets?.find((w) => w.name === "offset_y");

        if (this.videoWidget) {
            const orig = this.videoWidget.callback;
            this.videoWidget.callback = (v) => {
                if (orig) orig.call(this.videoWidget, v);
                this._onVideoSelected(v);
            };
        }
        for (const w of [this.widthWidget, this.heightWidget, this.fitWidget,
                          this.anchorWidget, this.bgWidget, this.zoomWidget,
                          this.offXWidget, this.offYWidget]) {
            if (!w) continue;
            const orig = w.callback;
            w.callback = (v) => {
                if (orig) orig.call(w, v);
                this._renderPreview();
            };
        }
        if (this.videoWidget?.value) this._onVideoSelected(this.videoWidget.value);
    }

    _onVideoSelected(filename) {
        if (!filename || filename === "(no video)") {
            this._clearPreview();
            return;
        }
        const params = new URLSearchParams({ filename, type: "input", subfolder: "" });
        this.videoEl.src = `/view?${params.toString()}`;
        this.videoEl.load();
        this.playBtn.disabled = false;
        this.sourceReady = false;
        this.statusLabel.textContent = filename;
    }

    _onSourceReady() {
        this.sourceReady = true;
        this.duration = this.videoEl.duration || 0;
        this._renderPreview();
    }

    _clearPreview() {
        this.videoEl.removeAttribute("src");
        this.videoEl.load();
        this.playBtn.disabled = true;
        this.sourceReady = false;
        this.duration = 0;
        this.statusLabel.textContent = "";
        const ctx = this.previewCanvas.getContext("2d");
        ctx.fillStyle = "#0d0d0d";
        ctx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }

    _previewDims() {
        const MAX = 720;
        const sW = (this.videoEl && this.videoEl.videoWidth) || 256;
        const sH = (this.videoEl && this.videoEl.videoHeight) || 256;
        if (sW <= MAX && sH <= MAX) return { w: sW, h: sH };
        const scale = MAX / Math.max(sW, sH);
        return { w: Math.max(1, Math.round(sW * scale)), h: Math.max(1, Math.round(sH * scale)) };
    }

    _renderPreview() {
        const { w, h } = this._previewDims();
        if (this.previewCanvas.width !== w) this.previewCanvas.width = w;
        if (this.previewCanvas.height !== h) this.previewCanvas.height = h;
        const ctx = this.previewCanvas.getContext("2d");
        if (!this.sourceReady) {
            ctx.fillStyle = "#0d0d0d";
            ctx.fillRect(0, 0, w, h);
            return;
        }
        ctx.imageSmoothingQuality = "low";
        const outW = Math.max(16, Math.round(this.widthWidget?.value || 1024));
        const outH = Math.max(16, Math.round(this.heightWidget?.value || 1024));
        const fit = this.fitWidget?.value || "cover";
        drawCropOverlay(ctx, this.videoEl, w, h, outW, outH, {
            fit_mode: fit,
            anchor: this.anchorWidget?.value || "center",
            background_color: this.bgWidget?.value || "#000000",
            zoom: this.zoomWidget?.value || 1,
            offset_x: this.offXWidget?.value || 0,
            offset_y: this.offYWidget?.value || 0,
        });
        const draggable = this.sourceReady && (fit === "cover" || fit === "crop");
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

    async _uploadFile(file) {
        this.uploadBtn.disabled = true;
        const oldLabel = this.uploadBtn.textContent;
        this.uploadBtn.textContent = "Uploading…";
        this.statusLabel.textContent = `Uploading ${file.name}…`;
        try {
            const formData = new FormData();
            formData.append("video", file);
            const r = await fetch("/purz/media_extractor/upload", {
                method: "POST", body: formData,
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
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
            console.warn("[Purz VideoCrop Upload] upload failed:", err);
            this.statusLabel.textContent = `Upload failed: ${err.message || err}`;
        } finally {
            this.uploadBtn.disabled = false;
            this.uploadBtn.textContent = oldLabel;
        }
    }

    getElement() { return this.container; }
    computeSize(width) {
        const w = Math.max(this.minWidth, width || this.minWidth);
        const previewHeight = Math.max(160, Math.min(380, Math.round(w * 0.5)));
        return [w, previewHeight + 70];
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
    name: "purz.video_crop_upload",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PurzVideoCropUpload") return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) onNodeCreated.apply(this, arguments);
            const node = this;
            const widget = new VideoCropUploadWidget(node);
            const domWidget = node.addDOMWidget(
                "video_crop_upload", "preview", widget.getElement(),
                { serialize: false, hideOnZoom: false }
            );
            domWidget.computeSize = (width) => widget.computeSize(width);
            widgetInstances.set(node.id, widget);
            node.videoCropUploadWidget = widget;
            setTimeout(() => widget.bindWidgets(), 0);
            domWidget.onRemove = () => {
                const inst = widgetInstances.get(node.id);
                if (inst) { inst.dispose(); widgetInstances.delete(node.id); }
            };
            node.setSize([420, 620]);
            const origResize = node.onResize;
            node.onResize = function (size) {
                if (size[0] < widget.minWidth) size[0] = widget.minWidth;
                if (origResize) origResize.apply(this, arguments);
            };
        };
    },
});
