/**
 * Purz Image Crop Upload — Path B.
 *
 * Adds an "Upload Image" button + a live preview canvas on top of the
 * standard ComfyUI widgets. All resize params are real INT/FLOAT/Combo
 * widgets so they serialize with the workflow. Backend handles the resize
 * via PIL on Queue.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { drawFit, drawCropOverlay, makeButton, attachCropDrag } from "./purz_resize_common.js";


class ImageCropUploadWidget {
    constructor(node) {
        this.node = node;
        this.minWidth = 380;
        this.sourceReady = false;
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
        this.fileInput.accept = "image/*";
        this.fileInput.style.display = "none";
        this.fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this._uploadFile(file);
            this.fileInput.value = "";
        });
        this.uploadBtn = makeButton("⬆  Upload Image", () => this.fileInput.click());

        const topRow = document.createElement("div");
        Object.assign(topRow.style, { display: "flex", gap: "6px" });
        topRow.appendChild(this.uploadBtn);
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
        this.previewWrap.appendChild(this.previewCanvas);

        attachCropDrag(this.previewCanvas, () => ({
            sourceEl: this.imgEl,
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

        this.imgEl = document.createElement("img");
        this.imgEl.style.display = "none";
        this.imgEl.addEventListener("load", () => this._onSourceReady());

        this.container.appendChild(topRow);
        this.container.appendChild(this.statusLabel);
        this.container.appendChild(this.previewWrap);
        this.container.appendChild(this.imgEl);
    }

    bindWidgets() {
        this.imageWidget = this.node.widgets?.find((w) => w.name === "image");
        this.widthWidget = this.node.widgets?.find((w) => w.name === "width");
        this.heightWidget = this.node.widgets?.find((w) => w.name === "height");
        this.fitWidget = this.node.widgets?.find((w) => w.name === "fit_mode");
        this.anchorWidget = this.node.widgets?.find((w) => w.name === "anchor");
        this.bgWidget = this.node.widgets?.find((w) => w.name === "background_color");
        this.zoomWidget = this.node.widgets?.find((w) => w.name === "zoom");
        this.offXWidget = this.node.widgets?.find((w) => w.name === "offset_x");
        this.offYWidget = this.node.widgets?.find((w) => w.name === "offset_y");

        if (this.imageWidget) {
            const orig = this.imageWidget.callback;
            this.imageWidget.callback = (v) => {
                if (orig) orig.call(this.imageWidget, v);
                this._onImageSelected(v);
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
        if (this.imageWidget?.value) this._onImageSelected(this.imageWidget.value);
    }

    _onImageSelected(filename) {
        if (!filename || filename === "(no image)") {
            this._clearPreview();
            return;
        }
        const params = new URLSearchParams({ filename, type: "input", subfolder: "" });
        this.imgEl.src = `/view?${params.toString()}`;
        this.sourceReady = false;
        this.statusLabel.textContent = filename;
    }

    _onSourceReady() {
        this.sourceReady = true;
        this._renderPreview();
    }

    _clearPreview() {
        this.imgEl.removeAttribute("src");
        this.sourceReady = false;
        this.statusLabel.textContent = "";
        const ctx = this.previewCanvas.getContext("2d");
        ctx.fillStyle = "#0d0d0d";
        ctx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }

    _previewDims() {
        const MAX = 720;
        const sW = (this.imgEl && this.imgEl.naturalWidth) || 256;
        const sH = (this.imgEl && this.imgEl.naturalHeight) || 256;
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
        drawCropOverlay(ctx, this.imgEl, w, h, outW, outH, {
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

    async _uploadFile(file) {
        this.uploadBtn.disabled = true;
        const oldLabel = this.uploadBtn.textContent;
        this.uploadBtn.textContent = "Uploading…";
        this.statusLabel.textContent = `Uploading ${file.name}…`;
        try {
            const formData = new FormData();
            formData.append("video", file);  // upload endpoint accepts any media
            const r = await fetch("/purz/media_extractor/upload", {
                method: "POST", body: formData,
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const info = await r.json();
            const savedName = info.name;
            // The combo on this node is filtered to image extensions only,
            // so refresh from a dedicated list... but media_extractor/list
            // returns videos. We need image-list. Reload page might be needed
            // if the node's combo doesn't include the new file. As a pragmatic
            // fallback, force-add the saved name to the existing options.
            if (this.imageWidget) {
                if (!this.imageWidget.options.values.includes(savedName)) {
                    this.imageWidget.options.values = [...this.imageWidget.options.values, savedName].sort();
                }
                this.imageWidget.value = savedName;
                if (this.imageWidget.callback) this.imageWidget.callback(savedName);
                else this._onImageSelected(savedName);
            }
            this.statusLabel.textContent = `Uploaded ${savedName}`;
        } catch (err) {
            console.warn("[Purz ImageCrop Upload] upload failed:", err);
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
        if (this.imgEl) this.imgEl.removeAttribute("src");
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.node = null;
    }
}


const widgetInstances = new Map();

app.registerExtension({
    name: "purz.image_crop_upload",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PurzImageCropUpload") return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) onNodeCreated.apply(this, arguments);
            const node = this;
            const widget = new ImageCropUploadWidget(node);
            const domWidget = node.addDOMWidget(
                "image_crop_upload", "preview", widget.getElement(),
                { serialize: false, hideOnZoom: false }
            );
            domWidget.computeSize = (width) => widget.computeSize(width);
            widgetInstances.set(node.id, widget);
            node.imageCropUploadWidget = widget;
            setTimeout(() => widget.bindWidgets(), 0);
            domWidget.onRemove = () => {
                const inst = widgetInstances.get(node.id);
                if (inst) { inst.dispose(); widgetInstances.delete(node.id); }
            };
            node.setSize([420, 600]);
            const origResize = node.onResize;
            node.onResize = function (size) {
                if (size[0] < widget.minWidth) size[0] = widget.minWidth;
                if (origResize) origResize.apply(this, arguments);
            };
        };
    },
});
