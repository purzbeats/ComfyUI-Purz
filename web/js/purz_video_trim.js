/**
 * Purz Video Trim — Path A (client-side bake).
 *
 * Source video stays in the browser (object URL). User sets trim handles
 * on a custom timeline; on "Bake" the segment is captured via
 * <video>.captureStream() → MediaRecorder → webm Blob and uploaded once
 * to /purz/video_trim/set_baked. Baking is real-time (we have to actually
 * play the clip to capture audio + video frames).
 *
 * Output is a VIDEO; the backend wraps the cached webm in VideoFromFile.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00.000";
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

function pickRecorderMime() {
    const candidates = [
        'video/webm;codecs="vp9,opus"',
        'video/webm;codecs="vp8,opus"',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
    ];
    for (const m of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
    }
    return "";
}

class VideoTrimWidget {
    constructor(node) {
        this.node = node;
        this.minWidth = 320;
        this.blobUrl = null;
        this.videoName = "";
        this.duration = 0;
        this.hasVideo = false;
        this.trimStart = 0;
        this.trimEnd = 0;
        this.baking = false;
        this.bakedDuration = 0;
        // bakeFresh: true iff the server-side cached bake matches the current
        // trim points. Flips to false when the user moves a handle or loads
        // a new video, and back to true once a fresh bake uploads cleanly.
        this.bakeFresh = false;
        this._loopPlaying = false;
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

        // ---- Load Video button -------------------------------------------
        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.accept = "video/*";
        this.fileInput.style.display = "none";
        this.fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this._loadFile(file);
            this.fileInput.value = "";
        });

        this.loadBtn = this._makeButton("⬆  Load Video", () => this.fileInput.click());

        const loadRow = document.createElement("div");
        Object.assign(loadRow.style, { display: "flex", gap: "6px" });
        loadRow.appendChild(this.loadBtn);
        loadRow.appendChild(this.fileInput);

        this.fileLabel = document.createElement("div");
        Object.assign(this.fileLabel.style, {
            color: "#888", fontSize: "10px", padding: "2px 4px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        });
        this.fileLabel.textContent = "No video loaded";

        // ---- Video preview -----------------------------------------------
        this.previewWrap = document.createElement("div");
        Object.assign(this.previewWrap.style, {
            flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: "120px", background: "#0d0d0d", border: "1px solid #2c2c2c",
            borderRadius: "3px", overflow: "hidden",
        });

        this.videoEl = document.createElement("video");
        // Default unmuted so the user can hear the trim loop. captureStream()
        // still grabs the audio track during bake regardless of the muted flag.
        this.videoEl.muted = false;
        this.videoEl.playsInline = true;
        this.videoEl.preload = "auto";
        Object.assign(this.videoEl.style, {
            maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
            display: "none", background: "#000",
        });
        this.videoEl.addEventListener("loadedmetadata", () => this._onVideoMetadata());
        this.videoEl.addEventListener("timeupdate", () => this._updateScrubFromVideo());
        this.videoEl.addEventListener("play", () => this._onPlayStateChange());
        this.videoEl.addEventListener("pause", () => this._onPlayStateChange());
        this.videoEl.addEventListener("ended", () => this._onPlayStateChange());
        this.videoEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this._toggleLoopPlay();
        });

        this.previewPlaceholder = document.createElement("div");
        this.previewPlaceholder.textContent = "Click \"Load Video\" to pick a local file";
        Object.assign(this.previewPlaceholder.style, {
            color: "#777", fontStyle: "italic", textAlign: "center", padding: "12px",
        });

        this.previewWrap.appendChild(this.videoEl);
        this.previewWrap.appendChild(this.previewPlaceholder);

        // ---- Trim timeline -----------------------------------------------
        // Custom dual-handle timeline. Track + region overlay + start/end handles + playhead.
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
            left: "0%", width: "100%",
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

        // Click anywhere on the track to seek preview (doesn't move handles)
        this.timelineWrap.addEventListener("click", (e) => this._onTimelineClick(e));

        // ---- Times + status ----------------------------------------------
        this.timeLabel = document.createElement("div");
        Object.assign(this.timeLabel.style, {
            textAlign: "center", color: "#bbb", padding: "1px 0",
            fontVariantNumeric: "tabular-nums", fontSize: "10px",
        });
        this.timeLabel.textContent = "—";

        // ---- Buttons: First, Last ----------------------------------------
        // No manual "Bake" button — baking happens automatically when the
        // user queues the workflow (see the backend's bake_requested event).
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

        this.bakeStatus = document.createElement("div");
        Object.assign(this.bakeStatus.style, {
            textAlign: "center", color: "#888", fontSize: "10px",
            padding: "2px 0", fontStyle: "italic",
        });
        this.bakeStatus.textContent = "Ready — bakes automatically on Queue";

        this.container.appendChild(loadRow);
        this.container.appendChild(this.fileLabel);
        this.container.appendChild(this.previewWrap);
        this.container.appendChild(this.timeLabel);
        this.container.appendChild(this.timelineWrap);
        this.container.appendChild(btnRow);
        this.container.appendChild(this.bakeStatus);
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

        const onPointerDown = (e) => {
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
                this._markStale();
                // Suppress the synthesized click that follows pointerup so it
                // doesn't fall through to the timeline-click seek handler.
                this._suppressNextTimelineClick = true;
                setTimeout(() => { this._suppressNextTimelineClick = false; }, 0);
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", up);
            handle.addEventListener("pointercancel", up);
        };
        handle.addEventListener("pointerdown", onPointerDown);
        handle.addEventListener("mousedown", (e) => e.stopPropagation());
        // A bare click on the handle (no movement) still synthesizes a click
        // event that bubbles. Eat it before it reaches the timeline.
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
        btn.addEventListener("mouseleave", () => { btn.style.background = btn._baseBg || "#2a2a2a"; });
        btn.addEventListener("mousedown", (e) => e.stopPropagation());
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!btn.disabled) onClick();
        });
        return btn;
    }

    // ---- Video loading / metadata ----------------------------------------

    _loadFile(file) {
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
        }
        this.videoName = file.name;
        this.fileLabel.textContent = file.name;
        this.blobUrl = URL.createObjectURL(file);
        this.videoEl.src = this.blobUrl;
        this.videoEl.load();
        this._markStale();
    }

    _onVideoMetadata() {
        this.duration = this.videoEl.duration || 0;
        this.hasVideo = this.duration > 0;
        if (!this.hasVideo) return;

        // Default trim = whole clip
        this.trimStart = 0;
        this.trimEnd = this.duration;

        this.playBtn.disabled = false;
        this.firstBtn.disabled = false;
        this.lastBtn.disabled = false;
        this.previewPlaceholder.style.display = "none";
        this.videoEl.style.display = "";

        this._renderTimeline();
        this.videoEl.currentTime = 0;
        this._updateTimeLabel();
        this.playhead.style.display = "";
    }

    // ---- Timeline rendering ----------------------------------------------

    _timelineWidth() {
        return this.timelineWrap.clientWidth || 1;
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

    _updateScrubFromVideo() {
        if (!this.hasVideo) return;
        // Loop the trim segment while playing the preview.
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
            // Snap into the trim range before resuming.
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
        // Preview the handle position
        this.videoEl.currentTime = which === "start" ? this.trimStart : Math.max(0, this.trimEnd - 0.001);
        this._updateTimeLabel();
    }

    _onTimelineClick(e) {
        if (!this.hasVideo) return;
        // A handle drag that ended with little or no movement synthesizes a
        // click on the wrap — ignore it so handles aren't fighting the seek.
        if (this._suppressNextTimelineClick) {
            this._suppressNextTimelineClick = false;
            return;
        }
        // Defensive: ignore clicks that originated on a handle.
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
        this._markStale();
        this._updateTimeLabel();
    }

    _setEndTo(t) {
        if (!this.hasVideo) return;
        this.trimEnd = Math.min(this.duration, Math.max(t, this.trimStart + 0.05));
        this._renderTimeline();
        this.videoEl.currentTime = Math.max(0, this.trimEnd - 0.001);
        this._markStale();
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

    _markStale() {
        this.bakeFresh = false;
        if (this.bakedDuration > 0) {
            this.bakeStatus.textContent = "Trim changed — will re-bake on Queue";
            this.bakeStatus.style.color = "#fbbf24";
            this.bakedDuration = 0;
        }
    }

    // ---- Bake (real-time MediaRecorder capture) --------------------------

    async _bake() {
        if (!this.hasVideo || this.baking || !this.node || this.node.id == null) {
            return false;
        }

        const mime = pickRecorderMime();
        if (!mime) {
            this.bakeStatus.textContent = "MediaRecorder webm unsupported in this browser";
            this.bakeStatus.style.color = "#fca5a5";
            return false;
        }

        const trimDur = Math.max(0.05, this.trimEnd - this.trimStart);

        this.baking = true;
        this._loopPlaying = false;  // stop the preview loop if it was running
        this.bakeStatus.style.color = "#bbb";

        // Mute speakers during bake so the user isn't blasted with audio
        // they didn't ask to play. captureStream() still records the audio
        // track regardless of the muted flag.
        const previousMuted = this.videoEl.muted;
        this.videoEl.muted = true;

        try {
            // Seek to start before capturing the stream.
            this.videoEl.pause();
            await this._seekTo(this.trimStart);

            // captureStream() includes the audio track on most browsers.
            // Note: video must be playing for the stream to actually emit data.
            const stream = this.videoEl.captureStream ? this.videoEl.captureStream() : this.videoEl.mozCaptureStream?.();
            if (!stream) throw new Error("captureStream not supported");

            const recorder = new MediaRecorder(stream, { mimeType: mime });
            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

            const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

            // Start recording, then play the source from trim_start.
            recorder.start(100);
            this.videoEl.play().catch(() => {});

            const startWallclock = performance.now();
            const stopTask = () => {
                if (!this.baking) return;
                const elapsed = (performance.now() - startWallclock) / 1000;
                const cur = this.videoEl.currentTime;
                const progress = Math.min(100, (elapsed / trimDur) * 100);
                this.bakeStatus.textContent = `Baking… ${progress.toFixed(0)}%`;
                if (cur >= this.trimEnd - 0.005 || elapsed > trimDur + 1.0) {
                    this.videoEl.pause();
                    try { recorder.stop(); } catch (_) {}
                    return;
                }
                requestAnimationFrame(stopTask);
            };
            requestAnimationFrame(stopTask);

            await stopped;

            const blob = new Blob(chunks, { type: mime });
            if (blob.size === 0) throw new Error("recorded blob was empty");

            this.bakeStatus.textContent = `Uploading ${(blob.size / 1024 / 1024).toFixed(1)} MB…`;
            const resp = await fetch(`/purz/video_trim/set_baked?node_id=${encodeURIComponent(this.node.id)}`, {
                method: "POST",
                body: blob,
                headers: { "Content-Type": mime },
            });
            if (!resp.ok) throw new Error(`upload HTTP ${resp.status}`);

            this.bakedDuration = trimDur;
            this.bakeFresh = true;
            this.bakeStatus.textContent = `Baked ✓  (${trimDur.toFixed(2)}s, ${(blob.size / 1024 / 1024).toFixed(1)} MB)`;
            this.bakeStatus.style.color = "#86efac";
            return true;
        } catch (err) {
            console.warn("[Purz VideoTrim] bake failed:", err);
            this.bakeStatus.textContent = `Bake failed: ${err.message || err}`;
            this.bakeStatus.style.color = "#fca5a5";
            return false;
        } finally {
            this.baking = false;
            this.videoEl.muted = previousMuted;
        }
    }

    /**
     * Called by the extension's WebSocket listener when the backend asks
     * for a bake at execute time. Resolves the backend's wait loop either
     * by uploading a fresh bake or by sending a short ack if the cached
     * bake is still good.
     */
    async handleBakeRequest() {
        if (!this.node || this.node.id == null) return;
        const nodeId = this.node.id;

        try {
            if (!this.hasVideo) {
                // No video loaded — clear cache + unblock backend.
                await fetch(`/purz/video_trim/set_baked?node_id=${encodeURIComponent(nodeId)}`, {
                    method: "POST",
                    body: new Blob([]),
                });
                this.bakeStatus.textContent = "No video loaded";
                this.bakeStatus.style.color = "#fca5a5";
                return;
            }

            if (this.bakeFresh && this.bakedDuration > 0) {
                // Cached bake matches current trim — short-circuit the wait.
                await fetch("/purz/video_trim/bake_ready", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ node_id: nodeId }),
                });
                this.bakeStatus.textContent = "Using cached bake ✓";
                this.bakeStatus.style.color = "#86efac";
                return;
            }

            const ok = await this._bake();
            if (!ok) {
                // Bake failed — still unblock the backend so it can return
                // an empty video rather than hanging.
                await fetch("/purz/video_trim/bake_ready", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ node_id: nodeId }),
                }).catch(() => {});
            }
        } catch (err) {
            console.warn("[Purz VideoTrim] handleBakeRequest error:", err);
            // Always unblock the backend on error.
            try {
                await fetch("/purz/video_trim/bake_ready", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ node_id: nodeId }),
                });
            } catch (_) {}
        }
    }

    _seekTo(t) {
        return new Promise((resolve) => {
            const onSeeked = () => {
                this.videoEl.removeEventListener("seeked", onSeeked);
                resolve();
            };
            this.videoEl.addEventListener("seeked", onSeeked);
            this.videoEl.currentTime = Math.max(0, Math.min(t, Math.max(0, this.duration - 0.001)));
        });
    }

    // ---- Widget plumbing -------------------------------------------------

    getElement() { return this.container; }

    computeSize(width) {
        const w = Math.max(this.minWidth, width || this.minWidth);
        const previewHeight = Math.max(140, Math.min(320, Math.round(w * 0.5)));
        const controlsHeight = 156;
        return [w, previewHeight + controlsHeight];
    }

    dispose() {
        this.baking = false;
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
        if (this.node && this.node.id != null) {
            // Clear baked blob on the server
            fetch(`/purz/video_trim/set_baked?node_id=${encodeURIComponent(this.node.id)}`, {
                method: "POST",
                body: new Blob([]),
            }).catch(() => {});
        }
        this.node = null;
    }
}

const widgetInstances = new Map();

app.registerExtension({
    name: "purz.video_trim",

    async setup() {
        // Backend's process() fires this when the user queues the workflow.
        // Each VideoTrim node bakes (or acks if its cached bake is fresh)
        // and the backend's wait loop resumes.
        api.addEventListener("purz.video_trim.bake_requested", async (event) => {
            const { node_id } = event.detail || {};
            if (node_id == null) return;

            let node = app.graph._nodes_by_id?.[node_id];
            if (!node) node = app.graph._nodes_by_id?.[parseInt(node_id, 10)];
            if (!node || !node.videoTrimWidget) {
                console.warn("[Purz VideoTrim] bake_requested for unknown node", node_id);
                // Best-effort unblock so the backend doesn't hang on a stale id.
                try {
                    await fetch("/purz/video_trim/bake_ready", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ node_id }),
                    });
                } catch (_) {}
                return;
            }
            await node.videoTrimWidget.handleBakeRequest();
        });
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PurzVideoTrim") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) onNodeCreated.apply(this, arguments);

            const node = this;
            const widget = new VideoTrimWidget(node);

            const domWidget = node.addDOMWidget(
                "video_trim",
                "preview",
                widget.getElement(),
                { serialize: false, hideOnZoom: false }
            );
            domWidget.computeSize = (width) => widget.computeSize(width);

            widgetInstances.set(node.id, widget);
            node.videoTrimWidget = widget;

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
                const minW = widget.minWidth || 320;
                if (size[0] < minW) size[0] = minW;
                if (originalOnResize) originalOnResize.apply(this, arguments);
                // Re-position handles after width change
                if (widget.hasVideo) widget._renderTimeline();
            };
        };
    },
});
