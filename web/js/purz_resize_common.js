/**
 * Shared resize/crop math + UI helpers for the four crop widgets:
 *   purz_image_crop.js
 *   purz_image_crop_upload.js
 *   purz_video_crop.js
 *   purz_video_crop_upload.js
 */

export const ASPECT_PRESETS = [
    { label: "Free", w: 0, h: 0 },
    { label: "1:1", w: 1, h: 1 },
    { label: "4:3", w: 4, h: 3 },
    { label: "3:4", w: 3, h: 4 },
    { label: "16:9", w: 16, h: 9 },
    { label: "9:16", w: 9, h: 16 },
    { label: "21:9", w: 21, h: 9 },
    { label: "9:21", w: 9, h: 21 },
    { label: "3:2", w: 3, h: 2 },
    { label: "2:3", w: 2, h: 3 },
    { label: "5:4", w: 5, h: 4 },
    { label: "4:5", w: 4, h: 5 },
    { label: "2:1", w: 2, h: 1 },
    { label: "1:2", w: 1, h: 2 },
];

export const FIT_MODES = ["stretch", "cover", "contain", "crop"];

export const ANCHORS = [
    "center", "top", "bottom", "left", "right",
    "top-left", "top-right", "bottom-left", "bottom-right",
];

export function pickRecorderMime() {
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

function anchorOffset(anchor, axis, max) {
    if (max <= 0) return 0;
    if (axis === "x") {
        if (anchor.includes("left")) return 0;
        if (anchor.includes("right")) return max;
        return max / 2;
    }
    if (anchor.includes("top")) return 0;
    if (anchor.includes("bottom")) return max;
    return max / 2;
}

/**
 * Draw `source` (HTMLImageElement or HTMLVideoElement) into a 2D canvas
 * context sized outW × outH, applying the chosen fit mode. The same shape
 * the Python backend (`resize_image_pil`) uses.
 */
export function drawFit(ctx, source, outW, outH, opts) {
    const fit = opts.fit_mode;
    const anchor = opts.anchor;
    const bg = opts.background_color;
    const zoom = Math.max(0.1, opts.zoom || 1);
    const offX = Math.max(-1, Math.min(1, opts.offset_x || 0));
    const offY = Math.max(-1, Math.min(1, opts.offset_y || 0));

    const sW = source.videoWidth || source.naturalWidth || source.width;
    const sH = source.videoHeight || source.naturalHeight || source.height;
    if (!sW || !sH) return;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, outW, outH);

    if (fit === "stretch") {
        ctx.drawImage(source, 0, 0, outW, outH);
        return;
    }
    if (fit === "contain") {
        const srcAspect = sW / sH;
        const outAspect = outW / outH;
        let dw, dh;
        if (srcAspect > outAspect) {
            dw = outW; dh = Math.round(outW / srcAspect);
        } else {
            dh = outH; dw = Math.round(outH * srcAspect);
        }
        const dx = anchorOffset(anchor, "x", outW - dw);
        const dy = anchorOffset(anchor, "y", outH - dh);
        ctx.drawImage(source, 0, 0, sW, sH, dx, dy, dw, dh);
        return;
    }

    // cover + crop share machinery; crop adds zoom + offset_x/y on top.
    const srcAspect = sW / sH;
    const outAspect = outW / outH;
    let sw, sh;
    if (srcAspect > outAspect) {
        sh = sH; sw = Math.round(sH * outAspect);
    } else {
        sw = sW; sh = Math.round(sW / outAspect);
    }
    sw = Math.max(1, Math.round(sw / zoom));
    sh = Math.max(1, Math.round(sh / zoom));
    sw = Math.min(sw, sW); sh = Math.min(sh, sH);

    let sx = anchorOffset(anchor, "x", sW - sw);
    let sy = anchorOffset(anchor, "y", sH - sh);
    const slackX = Math.floor((sW - sw) / 2);
    const slackY = Math.floor((sH - sh) / 2);
    sx = Math.round(sx + offX * slackX);
    sy = Math.round(sy + offY * slackY);
    sx = Math.max(0, Math.min(sx, sW - sw));
    sy = Math.max(0, Math.min(sy, sH - sh));

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);
}

/**
 * Compute default output dimensions for a given source + aspect preset.
 * Anchors to source's longest side so tall aspects don't explode the long
 * axis (e.g. 1920×1080 + 9:21 → 823×1920, not 1920×4480).
 */
export function deriveDimsFromSource(srcW, srcH, aspectIdx) {
    if (!srcW || !srcH) return null;
    const preset = ASPECT_PRESETS[aspectIdx];
    if (!preset) return { w: srcW, h: srcH };
    if (preset.w === 0) return { w: srcW, h: srcH };  // Free
    const longest = Math.max(srcW, srcH);
    if (preset.w >= preset.h) {
        return { w: longest, h: Math.max(1, Math.round(longest * preset.h / preset.w)) };
    }
    return { w: Math.max(1, Math.round(longest * preset.w / preset.h)), h: longest };
}

/**
 * Build a stand-alone control panel that drives a state object via callbacks.
 * Returns { element, refresh(state), updateCropVisibility(fit) }.
 *
 * state has shape:
 *   { outW, outH, aspectIdx, fit_mode, anchor, background_color,
 *     zoom, offset_x, offset_y }
 */
export function buildControlsPanel(state, callbacks) {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
        display: "grid", gridTemplateColumns: "auto 1fr auto 1fr",
        gap: "4px 6px", alignItems: "center", padding: "4px 0",
    });

    const lbl = (txt) => {
        const d = document.createElement("div");
        d.textContent = txt;
        Object.assign(d.style, { color: "#aaa", fontSize: "10px", whiteSpace: "nowrap" });
        return d;
    };
    const numInput = (val, min, max, step, onChange) => {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.value = val; inp.min = min; inp.max = max; inp.step = step;
        Object.assign(inp.style, {
            width: "100%", padding: "3px 4px", background: "#2a2a2a", color: "#ddd",
            border: "1px solid #3a3a3a", borderRadius: "3px", fontSize: "11px",
            fontFamily: "inherit", boxSizing: "border-box",
        });
        inp.addEventListener("mousedown", (e) => e.stopPropagation());
        inp.addEventListener("change", () => onChange(parseFloat(inp.value) || 0));
        return inp;
    };
    const select = (opts, val, onChange) => {
        const sel = document.createElement("select");
        for (const o of opts) {
            const opt = document.createElement("option");
            opt.value = typeof o === "string" ? o : o.value;
            opt.textContent = typeof o === "string" ? o : o.label;
            sel.appendChild(opt);
        }
        sel.value = val;
        Object.assign(sel.style, {
            width: "100%", padding: "3px 4px", background: "#2a2a2a", color: "#ddd",
            border: "1px solid #3a3a3a", borderRadius: "3px", fontSize: "11px",
            fontFamily: "inherit", boxSizing: "border-box",
        });
        sel.addEventListener("mousedown", (e) => e.stopPropagation());
        sel.addEventListener("change", () => onChange(sel.value));
        return sel;
    };

    const widthInput = numInput(state.outW, 16, 16384, 1, (v) => callbacks.onWidth(v));
    const heightInput = numInput(state.outH, 16, 16384, 1, (v) => callbacks.onHeight(v));
    wrap.appendChild(lbl("Width"));
    wrap.appendChild(widthInput);
    wrap.appendChild(lbl("Height"));
    wrap.appendChild(heightInput);

    const aspectSelect = select(
        ASPECT_PRESETS.map((p, i) => ({ value: String(i), label: p.label })),
        String(state.aspectIdx),
        (v) => callbacks.onAspect(parseInt(v, 10)),
    );
    const fitSelect = select(
        FIT_MODES.map((m) => ({ value: m, label: m })),
        state.fit_mode,
        (v) => callbacks.onFit(v),
    );
    wrap.appendChild(lbl("Aspect"));
    wrap.appendChild(aspectSelect);
    wrap.appendChild(lbl("Fit"));
    wrap.appendChild(fitSelect);

    const anchorSelect = select(
        ANCHORS.map((a) => ({ value: a, label: a })),
        state.anchor,
        (v) => callbacks.onAnchor(v),
    );
    const bgInput = document.createElement("input");
    bgInput.type = "color";
    bgInput.value = state.background_color;
    Object.assign(bgInput.style, {
        width: "100%", height: "22px", padding: "0", border: "1px solid #3a3a3a",
        borderRadius: "3px", background: "#2a2a2a",
    });
    bgInput.addEventListener("mousedown", (e) => e.stopPropagation());
    bgInput.addEventListener("input", () => callbacks.onBg(bgInput.value));
    wrap.appendChild(lbl("Anchor"));
    wrap.appendChild(anchorSelect);
    wrap.appendChild(lbl("BG"));
    wrap.appendChild(bgInput);

    const cropRow = document.createElement("div");
    Object.assign(cropRow.style, {
        gridColumn: "1 / -1", display: "grid",
        gridTemplateColumns: "auto 1fr auto 1fr auto 1fr",
        gap: "4px 6px", alignItems: "center",
    });
    const zoomInput = numInput(state.zoom, 0.1, 10, 0.01, (v) => callbacks.onZoom(v));
    const offXInput = numInput(state.offset_x, -1, 1, 0.01, (v) => callbacks.onOffX(v));
    const offYInput = numInput(state.offset_y, -1, 1, 0.01, (v) => callbacks.onOffY(v));
    cropRow.appendChild(lbl("Zoom"));
    cropRow.appendChild(zoomInput);
    cropRow.appendChild(lbl("OffX"));
    cropRow.appendChild(offXInput);
    cropRow.appendChild(lbl("OffY"));
    cropRow.appendChild(offYInput);
    wrap.appendChild(cropRow);

    const updateCropVisibility = (fit) => {
        cropRow.style.display = (fit === "crop") ? "" : "none";
    };
    updateCropVisibility(state.fit_mode);

    return {
        element: wrap,
        refs: { widthInput, heightInput, aspectSelect, fitSelect, anchorSelect, bgInput, zoomInput, offXInput, offYInput },
        updateCropVisibility,
        refresh: (s) => {
            widthInput.value = s.outW;
            heightInput.value = s.outH;
            aspectSelect.value = String(s.aspectIdx);
            fitSelect.value = s.fit_mode;
            anchorSelect.value = s.anchor;
            bgInput.value = s.background_color;
            zoomInput.value = s.zoom;
            offXInput.value = s.offset_x;
            offYInput.value = s.offset_y;
            updateCropVisibility(s.fit_mode);
        },
    };
}

/**
 * Compute the crop window in SOURCE coordinates for the current fit
 * settings. Returns { sx, sy, sw, sh } — the rectangle on the source that
 * will be sampled into the output. Same shape as the slice that drawFit
 * passes to drawImage for "cover" / "crop".
 *
 * For "stretch" and "contain", the entire source is "used" (no crop),
 * so we return the full source rect — useful for drawing a uniform
 * overlay that communicates "everything is kept".
 */
export function computeCropRect(srcW, srcH, outW, outH, opts) {
    if (!srcW || !srcH || !outW || !outH) return null;
    const fit = opts.fit_mode;
    const anchor = opts.anchor;
    const zoom = Math.max(0.1, opts.zoom || 1);
    const offX = Math.max(-1, Math.min(1, opts.offset_x || 0));
    const offY = Math.max(-1, Math.min(1, opts.offset_y || 0));

    if (fit === "stretch" || fit === "contain") {
        return { sx: 0, sy: 0, sw: srcW, sh: srcH };
    }

    // cover and crop share the same math.
    const srcAspect = srcW / srcH;
    const outAspect = outW / outH;
    let sw, sh;
    if (srcAspect > outAspect) {
        sh = srcH; sw = Math.round(srcH * outAspect);
    } else {
        sw = srcW; sh = Math.round(srcW / outAspect);
    }
    sw = Math.max(1, Math.round(sw / zoom));
    sh = Math.max(1, Math.round(sh / zoom));
    sw = Math.min(sw, srcW); sh = Math.min(sh, srcH);

    let sx, sy;
    const anchorX = (anchor.includes("left")) ? 0
        : (anchor.includes("right")) ? (srcW - sw) : Math.floor((srcW - sw) / 2);
    const anchorY = (anchor.includes("top")) ? 0
        : (anchor.includes("bottom")) ? (srcH - sh) : Math.floor((srcH - sh) / 2);
    sx = anchorX; sy = anchorY;
    const slackX = Math.floor((srcW - sw) / 2);
    const slackY = Math.floor((srcH - sh) / 2);
    sx = Math.round(sx + offX * slackX);
    sy = Math.round(sy + offY * slackY);
    sx = Math.max(0, Math.min(sx, srcW - sw));
    sy = Math.max(0, Math.min(sy, srcH - sh));

    return { sx, sy, sw, sh };
}

/**
 * Draw the entire source onto the canvas, then overlay a green crop
 * rectangle showing what will end up in the output. Outside the rect is
 * dimmed so the kept region pops. A small badge in the corner shows
 * output dimensions + fit mode for context.
 */
export function drawCropOverlay(ctx, source, canvasW, canvasH, outW, outH, opts) {
    const sW = source.videoWidth || source.naturalWidth || source.width;
    const sH = source.videoHeight || source.naturalHeight || source.height;
    if (!sW || !sH) {
        ctx.fillStyle = "#0d0d0d";
        ctx.fillRect(0, 0, canvasW, canvasH);
        return;
    }

    // Source fills the canvas (canvas matches source aspect so no distortion).
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.drawImage(source, 0, 0, canvasW, canvasH);

    const crop = computeCropRect(sW, sH, outW, outH, opts);
    if (!crop) return;

    const scaleX = canvasW / sW;
    const scaleY = canvasH / sH;
    const cx = crop.sx * scaleX;
    const cy = crop.sy * scaleY;
    const cw = crop.sw * scaleX;
    const ch = crop.sh * scaleY;

    // Dim everything outside the crop with 4 rectangles around it.
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    if (cy > 0) ctx.fillRect(0, 0, canvasW, cy);
    if (cy + ch < canvasH) ctx.fillRect(0, cy + ch, canvasW, canvasH - (cy + ch));
    if (cx > 0) ctx.fillRect(0, cy, cx, ch);
    if (cx + cw < canvasW) ctx.fillRect(cx + cw, cy, canvasW - (cx + cw), ch);

    // Green outline.
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#22c55e";
    ctx.strokeRect(cx + 1, cy + 1, Math.max(1, cw - 2), Math.max(1, ch - 2));

    // Corner badge: output dims + fit mode.
    const label = `${outW}×${outH}  ${opts.fit_mode}`;
    ctx.font = "11px sans-serif";
    const metrics = ctx.measureText(label);
    const pad = 4;
    const bw = Math.ceil(metrics.width) + pad * 2;
    const bh = 16;
    let bx = cx + 4;
    let by = cy + 4;
    // Keep the badge on screen if the crop sits at the very edge.
    if (bx + bw > canvasW) bx = canvasW - bw - 2;
    if (by + bh > canvasH) by = canvasH - bh - 2;
    if (bx < 0) bx = 2;
    if (by < 0) by = 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#22c55e";
    ctx.fillText(label, bx + pad, by + 12);
}

/**
 * Wire up drag-to-position on the crop overlay. The user can grab anywhere
 * on the canvas (cover / crop only — stretch / contain have no crop to
 * position) and drag to move the green rectangle. Anchor snaps to "center"
 * on drag start so offset_x / offset_y have their full -1..+1 range
 * regardless of which anchor preset the user had selected.
 *
 *   canvas          : the preview canvas element
 *   getState()      : returns { sourceEl, sourceReady, outW, outH,
 *                      fit_mode, anchor, zoom, offset_x, offset_y }
 *   applyOffsets({ anchor, offset_x, offset_y })
 *                   : called whenever the drag updates positions.
 *                     The widget is responsible for updating its own
 *                     widgets / state and re-rendering the preview.
 */
export function attachCropDrag(canvas, getState, applyOffsets) {
    let dragging = false;
    let dragMoved = false;
    let startClientX = 0, startClientY = 0;
    let startSx = 0, startSy = 0;
    let sW = 0, sH = 0, cropW = 0, cropH = 0;

    canvas.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;  // left button only
        const state = getState();
        if (!state.sourceReady) return;
        if (state.fit_mode !== "cover" && state.fit_mode !== "crop") return;

        const src = state.sourceEl;
        sW = src.videoWidth || src.naturalWidth || src.width;
        sH = src.videoHeight || src.naturalHeight || src.height;
        if (!sW || !sH) return;

        const crop = computeCropRect(sW, sH, state.outW, state.outH, state);
        if (!crop) return;

        e.preventDefault();
        e.stopPropagation();
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        dragging = true;
        dragMoved = false;
        startClientX = e.clientX;
        startClientY = e.clientY;
        startSx = crop.sx;
        startSy = crop.sy;
        cropW = crop.sw;
        cropH = crop.sh;
    });

    canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        e.preventDefault();

        const dxClient = e.clientX - startClientX;
        const dyClient = e.clientY - startClientY;
        if (Math.abs(dxClient) > 3 || Math.abs(dyClient) > 3) dragMoved = true;

        // Map client CSS pixels → source pixels. Canvas display may be
        // CSS-scaled but the bounding rect tells us the actual on-screen
        // size, and the canvas internal dims map 1:1 to source dims.
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dxSrc = dxClient * (sW / rect.width);
        const dySrc = dyClient * (sH / rect.height);

        const newSx = Math.max(0, Math.min(sW - cropW, startSx + dxSrc));
        const newSy = Math.max(0, Math.min(sH - cropH, startSy + dySrc));

        const slackX = (sW - cropW) / 2;
        const slackY = (sH - cropH) / 2;
        const offsetX = slackX > 0 ? (newSx - slackX) / slackX : 0;
        const offsetY = slackY > 0 ? (newSy - slackY) / slackY : 0;

        applyOffsets({
            anchor: "center",
            offset_x: Math.max(-1, Math.min(1, offsetX)),
            offset_y: Math.max(-1, Math.min(1, offsetY)),
        });
    });

    const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        if (dragMoved) {
            // The click event the browser synthesizes after pointerup
            // would otherwise trigger play/pause on video-crop nodes.
            // Eat it once.
            const oneShot = (clickEvent) => {
                clickEvent.stopPropagation();
                clickEvent.preventDefault();
            };
            canvas.addEventListener("click", oneShot, { capture: true, once: true });
        }
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
}

export function makeButton(label, onClick) {
    const btn = document.createElement("button");
    btn.textContent = label;
    Object.assign(btn.style, {
        flex: "1", padding: "6px 8px", background: "#2a2a2a", color: "#ddd",
        border: "1px solid #3a3a3a", borderRadius: "3px", cursor: "pointer",
        fontSize: "11px", fontFamily: "inherit",
    });
    btn.addEventListener("mouseenter", () => { if (!btn.disabled) btn.style.background = "#3a3a3a"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "#2a2a2a"; });
    btn.addEventListener("mousedown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!btn.disabled) onClick();
    });
    return btn;
}
