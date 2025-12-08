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

// ============================================================================
// CUSTOM SHADER LOADER
// ============================================================================

/**
 * Loads custom shaders from the shaders/custom/ directory.
 * Custom shaders are loaded on-demand and merged into EFFECTS.
 */
const CustomShaderLoader = {
    loaded: false,
    customEffects: {},
    shaderCache: {},

    /**
     * Load the shader manifest and discover custom shaders.
     */
    async loadManifest() {
        if (this.loaded) return;

        try {
            const response = await api.fetchApi("/purz/shaders/manifest");
            if (response.ok) {
                const manifest = await response.json();

                // Find custom effects in manifest
                for (const [key, effect] of Object.entries(manifest.effects)) {
                    if (effect.isCustom) {
                        this.customEffects[key] = {
                            name: effect.name,
                            category: effect.category || "Custom",
                            shaderPath: effect.shader,
                            shader: null, // Will be loaded on demand
                            needsResolution: effect.needs?.includes("resolution") || false,
                            needsSeed: effect.needs?.includes("seed") || false,
                            params: effect.params || [],
                            isCustom: true
                        };
                    }
                }

                this.loaded = true;
                console.log(`[Purz] Loaded ${Object.keys(this.customEffects).length} custom effects`);
            }
        } catch (e) {
            console.warn("[Purz] Could not load shader manifest:", e);
        }
    },

    /**
     * Load shader source from file.
     */
    async loadShaderSource(shaderPath) {
        if (this.shaderCache[shaderPath]) {
            return this.shaderCache[shaderPath];
        }

        try {
            const response = await api.fetchApi(`/purz/shaders/file/${shaderPath}`);
            if (response.ok) {
                const source = await response.text();
                this.shaderCache[shaderPath] = source;
                return source;
            }
        } catch (e) {
            console.error(`[Purz] Failed to load shader: ${shaderPath}`, e);
        }
        return null;
    },

    /**
     * Get effect definition, loading shader if needed.
     */
    async getEffect(effectKey) {
        const effect = this.customEffects[effectKey];
        if (!effect) return null;

        // Load shader source if not already loaded
        if (!effect.shader && effect.shaderPath) {
            effect.shader = await this.loadShaderSource(effect.shaderPath);
        }

        return effect;
    },

    /**
     * Get all custom effect keys.
     */
    getCustomEffectKeys() {
        return Object.keys(this.customEffects);
    },

    /**
     * Check if an effect is custom.
     */
    isCustomEffect(effectKey) {
        return effectKey in this.customEffects;
    }
};

// ============================================================================
// GLSL SHADERS
// ============================================================================

const VERTEX_SHADER = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

// Passthrough shader - just copies the texture
const PASSTHROUGH_SHADER = `
    precision mediump float;
    uniform sampler2D u_image;
    varying vec2 v_texCoord;
    void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
    }
`;

// ============================================================================
// EFFECT SHADERS
// ============================================================================

const EFFECT_SHADERS = {
    // === BASIC ADJUSTMENTS ===
    desaturate: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 desaturated = mix(color.rgb, vec3(gray), u_amount);
            vec3 result = mix(color.rgb, desaturated, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    brightness: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 adjusted = clamp(color.rgb + vec3(u_amount), 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    contrast: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 adjusted = (color.rgb - 0.5) * (1.0 + u_amount) + 0.5;
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    exposure: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 adjusted = color.rgb * pow(2.0, u_amount);
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    gamma: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float g = 1.0 / max(u_amount, 0.01);
            vec3 adjusted = pow(color.rgb, vec3(g));
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    vibrance: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float maxC = max(color.r, max(color.g, color.b));
            float minC = min(color.r, min(color.g, color.b));
            float sat = maxC - minC;
            float amt = u_amount * (1.0 - sat);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 adjusted = mix(vec3(gray), color.rgb, 1.0 + amt);
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    saturation: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 adjusted = mix(vec3(gray), color.rgb, 1.0 + u_amount);
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    // === COLOR MANIPULATION ===
    hueShift: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;

        vec3 rgb2hsv(vec3 c) {
            vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 hsv = rgb2hsv(color.rgb);
            hsv.x = fract(hsv.x + u_amount);
            vec3 adjusted = hsv2rgb(hsv);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    temperature: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 adjusted = color.rgb;
            adjusted.r = clamp(color.r + u_amount * 0.3, 0.0, 1.0);
            adjusted.b = clamp(color.b - u_amount * 0.3, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    tint: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 adjusted = color.rgb;
            adjusted.g = clamp(color.g + u_amount * 0.3, 0.0, 1.0);
            adjusted.r = clamp(color.r - u_amount * 0.15, 0.0, 1.0);
            adjusted.b = clamp(color.b - u_amount * 0.15, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    colorize: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_hue;
        uniform float u_saturation;
        uniform float u_opacity;
        varying vec2 v_texCoord;

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 adjusted = hsv2rgb(vec3(u_hue, u_saturation, lum));
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    channelMixer: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_redShift;
        uniform float u_greenShift;
        uniform float u_blueShift;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 adjusted;
            adjusted.r = clamp(color.r + u_redShift, 0.0, 1.0);
            adjusted.g = clamp(color.g + u_greenShift, 0.0, 1.0);
            adjusted.b = clamp(color.b + u_blueShift, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    // === TONE ADJUSTMENTS ===
    highlights: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float highlightMask = smoothstep(0.5, 1.0, lum);
            vec3 adjusted = color.rgb + vec3(u_amount * highlightMask);
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    shadows: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float shadowMask = 1.0 - smoothstep(0.0, 0.5, lum);
            vec3 adjusted = color.rgb + vec3(u_amount * shadowMask);
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    whites: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float whiteMask = smoothstep(0.7, 1.0, lum);
            vec3 adjusted = color.rgb + vec3(u_amount * whiteMask);
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    blacks: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float blackMask = 1.0 - smoothstep(0.0, 0.3, lum);
            vec3 adjusted = color.rgb + vec3(u_amount * blackMask);
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    levels: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_blackPoint;
        uniform float u_whitePoint;
        uniform float u_midtones;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 adjusted = (color.rgb - u_blackPoint) / max(u_whitePoint - u_blackPoint, 0.001);
            adjusted = clamp(adjusted, 0.0, 1.0);
            adjusted = pow(adjusted, vec3(1.0 / max(u_midtones, 0.01)));
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    curves: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_shadows;
        uniform float u_midtones;
        uniform float u_highlights;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 c = color.rgb;
            // S-curve approximation with control points
            c = c + u_shadows * (1.0 - c) * (1.0 - c) * c;
            c = c + u_midtones * c * (1.0 - c);
            c = c + u_highlights * c * c * (1.0 - c);
            c = clamp(c, 0.0, 1.0);
            vec3 result = mix(color.rgb, c, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    // === BLUR & SHARPEN ===
    blur: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 pixel = u_amount / u_resolution;
            vec4 sum = vec4(0.0);
            sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y)) * 0.0625;
            sum += texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * 0.125;
            sum += texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y)) * 0.0625;
            sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * 0.125;
            sum += texture2D(u_image, v_texCoord) * 0.25;
            sum += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * 0.125;
            sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y)) * 0.0625;
            sum += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * 0.125;
            sum += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y)) * 0.0625;
            vec3 result = mix(color.rgb, sum.rgb, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    sharpen: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 pixel = 1.0 / u_resolution;
            vec4 sum = vec4(0.0);
            sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * -1.0;
            sum += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * -1.0;
            sum += texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * -1.0;
            sum += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * -1.0;
            sum += texture2D(u_image, v_texCoord) * 5.0;
            vec3 sharpened = mix(color.rgb, sum.rgb, u_amount);
            sharpened = clamp(sharpened, 0.0, 1.0);
            vec3 result = mix(color.rgb, sharpened, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    unsharpMask: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_threshold;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 pixel = 2.0 / u_resolution;
            vec4 blur = vec4(0.0);
            blur += texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y)) * 0.0625;
            blur += texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * 0.125;
            blur += texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y)) * 0.0625;
            blur += texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * 0.125;
            blur += texture2D(u_image, v_texCoord) * 0.25;
            blur += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * 0.125;
            blur += texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y)) * 0.0625;
            blur += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * 0.125;
            blur += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y)) * 0.0625;
            vec3 diff = color.rgb - blur.rgb;
            float mask = step(u_threshold, length(diff));
            vec3 sharpened = color.rgb + diff * u_amount * mask;
            sharpened = clamp(sharpened, 0.0, 1.0);
            vec3 result = mix(color.rgb, sharpened, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    // === STYLISTIC EFFECTS ===
    vignette: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_softness;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 center = v_texCoord - 0.5;
            float dist = length(center);
            float vig = 1.0 - smoothstep(0.5 - u_softness, 0.5 + u_softness * 0.5, dist * (1.0 + u_amount));
            vec3 adjusted = color.rgb * vig;
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    grain: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_size;
        uniform float u_opacity;
        uniform float u_seed;
        varying vec2 v_texCoord;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 st = v_texCoord * u_size + u_seed;
            float noise = random(st) * 2.0 - 1.0;
            vec3 adjusted = color.rgb + vec3(noise * u_amount);
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    posterize: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_levels;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float levels = max(2.0, floor(u_levels));
            vec3 adjusted = floor(color.rgb * levels) / (levels - 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    threshold: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_threshold;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 adjusted = vec3(step(u_threshold, gray));
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    invert: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 inverted = 1.0 - color.rgb;
            vec3 adjusted = mix(color.rgb, inverted, u_amount);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    sepia: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 sepia;
            sepia.r = dot(color.rgb, vec3(0.393, 0.769, 0.189));
            sepia.g = dot(color.rgb, vec3(0.349, 0.686, 0.168));
            sepia.b = dot(color.rgb, vec3(0.272, 0.534, 0.131));
            sepia = clamp(sepia, 0.0, 1.0);
            vec3 adjusted = mix(color.rgb, sepia, u_amount);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    duotone: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_shadowR;
        uniform float u_shadowG;
        uniform float u_shadowB;
        uniform float u_highlightR;
        uniform float u_highlightG;
        uniform float u_highlightB;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 shadow = vec3(u_shadowR, u_shadowG, u_shadowB);
            vec3 highlight = vec3(u_highlightR, u_highlightG, u_highlightB);
            vec3 adjusted = mix(shadow, highlight, gray);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    // === EDGE & DETAIL ===
    emboss: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 pixel = 1.0 / u_resolution;
            vec4 tl = texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y));
            vec4 br = texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y));
            vec3 embossed = vec3(0.5) + (br.rgb - tl.rgb) * u_amount;
            embossed = clamp(embossed, 0.0, 1.0);
            vec3 result = mix(color.rgb, embossed, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    edgeDetect: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 pixel = 1.0 / u_resolution;
            vec4 h = vec4(0.0);
            h -= texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * 2.0;
            h += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * 2.0;
            h -= texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y));
            h -= texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y));
            h += texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y));
            h += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y));
            vec4 v = vec4(0.0);
            v -= texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * 2.0;
            v += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * 2.0;
            v -= texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y));
            v += texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y));
            v -= texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y));
            v += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y));
            vec3 edge = sqrt(h.rgb * h.rgb + v.rgb * v.rgb) * u_amount;
            edge = clamp(edge, 0.0, 1.0);
            vec3 result = mix(color.rgb, edge, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    clarity: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 pixel = 2.0 / u_resolution;
            vec4 blur = vec4(0.0);
            blur += texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y)) * 0.0625;
            blur += texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * 0.125;
            blur += texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y)) * 0.0625;
            blur += texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * 0.125;
            blur += texture2D(u_image, v_texCoord) * 0.25;
            blur += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * 0.125;
            blur += texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y)) * 0.0625;
            blur += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * 0.125;
            blur += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y)) * 0.0625;
            // High-pass filter for midtone contrast
            vec3 highPass = color.rgb - blur.rgb;
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float midMask = 1.0 - abs(lum - 0.5) * 2.0;
            vec3 adjusted = color.rgb + highPass * u_amount * midMask;
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    dehaze: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            // Simple dehaze: increase contrast and saturation in low-contrast areas
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 adjusted = (color.rgb - 0.5) * (1.0 + u_amount * 0.5) + 0.5;
            // Boost saturation slightly
            adjusted = mix(vec3(gray), adjusted, 1.0 + u_amount * 0.3);
            adjusted = clamp(adjusted, 0.0, 1.0);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    // === CREATIVE EFFECTS ===
    pixelate: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_size;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float size = max(1.0, u_size);
            vec2 pixelSize = size / u_resolution;
            vec2 coord = pixelSize * floor(v_texCoord / pixelSize) + pixelSize * 0.5;
            vec4 pixelated = texture2D(u_image, coord);
            vec3 result = mix(color.rgb, pixelated.rgb, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    chromatic: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 dir = (v_texCoord - 0.5) * u_amount / u_resolution * 100.0;
            float r = texture2D(u_image, v_texCoord + dir).r;
            float g = texture2D(u_image, v_texCoord).g;
            float b = texture2D(u_image, v_texCoord - dir).b;
            vec3 adjusted = vec3(r, g, b);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    glitch: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_seed;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float rnd = random(vec2(floor(v_texCoord.y * 20.0), u_seed));
            float shift = (rnd - 0.5) * u_amount * 0.1;
            if (rnd > 0.9) shift *= 3.0;
            float r = texture2D(u_image, v_texCoord + vec2(shift, 0.0)).r;
            float g = texture2D(u_image, v_texCoord).g;
            float b = texture2D(u_image, v_texCoord - vec2(shift, 0.0)).b;
            vec3 adjusted = vec3(r, g, b);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    halftone: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_size;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float size = max(2.0, u_size);
            vec2 pos = v_texCoord * u_resolution / size;
            vec2 center = (floor(pos) + 0.5) * size / u_resolution;
            float dist = length(fract(pos) - 0.5);
            float lum = dot(texture2D(u_image, center).rgb, vec3(0.299, 0.587, 0.114));
            float radius = sqrt(1.0 - lum) * 0.5;
            float dot = 1.0 - step(radius, dist);
            vec3 adjusted = vec3(dot);
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    sketch: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 pixel = 1.0 / u_resolution;
            // Sobel edge detection
            float tl = dot(texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
            float t  = dot(texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
            float tr = dot(texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
            float l  = dot(texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float r  = dot(texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float bl = dot(texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
            float b  = dot(texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
            float br = dot(texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
            float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
            float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
            float edge = 1.0 - sqrt(gx*gx + gy*gy) * u_amount;
            edge = clamp(edge, 0.0, 1.0);
            vec3 result = mix(color.rgb, vec3(edge), u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    oilPaint: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_radius;
        uniform float u_levels;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 pixel = 1.0 / u_resolution;
            float levels = max(2.0, u_levels);

            // Simplified oil paint: blur + posterize
            vec3 sum = vec3(0.0);
            float total = 0.0;
            for (int x = -2; x <= 2; x++) {
                for (int y = -2; y <= 2; y++) {
                    vec2 offset = vec2(float(x), float(y)) * pixel * u_radius;
                    sum += texture2D(u_image, v_texCoord + offset).rgb;
                    total += 1.0;
                }
            }
            vec3 blurred = sum / total;
            vec3 adjusted = floor(blurred * levels) / levels;
            vec3 result = mix(color.rgb, adjusted, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    // === LENS EFFECTS ===
    lensDistort: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 center = v_texCoord - 0.5;
            float dist = length(center);
            float distortion = 1.0 + dist * dist * u_amount;
            vec2 distorted = center * distortion + 0.5;
            vec4 adjusted = texture2D(u_image, distorted);
            if (distorted.x < 0.0 || distorted.x > 1.0 || distorted.y < 0.0 || distorted.y > 1.0) {
                adjusted = color;
            }
            vec3 result = mix(color.rgb, adjusted.rgb, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    tiltShift: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_focus;
        uniform float u_range;
        uniform float u_blur;
        uniform float u_opacity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float dist = abs(v_texCoord.y - u_focus);
            float blurAmount = smoothstep(0.0, u_range, dist) * u_blur;
            vec2 pixel = blurAmount / u_resolution;
            vec4 sum = vec4(0.0);
            sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y)) * 0.0625;
            sum += texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * 0.125;
            sum += texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y)) * 0.0625;
            sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * 0.125;
            sum += texture2D(u_image, v_texCoord) * 0.25;
            sum += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * 0.125;
            sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y)) * 0.0625;
            sum += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * 0.125;
            sum += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y)) * 0.0625;
            vec3 result = mix(color.rgb, sum.rgb, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    radialBlur: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_amount;
        uniform float u_opacity;
        varying vec2 v_texCoord;
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec2 center = v_texCoord - 0.5;
            vec4 sum = vec4(0.0);
            float samples = 10.0;
            for (float i = 0.0; i < 10.0; i++) {
                float scale = 1.0 - u_amount * 0.02 * i;
                sum += texture2D(u_image, center * scale + 0.5);
            }
            sum /= samples;
            vec3 result = mix(color.rgb, sum.rgb, u_opacity);
            gl_FragColor = vec4(result, color.a);
        }
    `
};

// Effect definitions with parameters
const EFFECTS = {
    // === BASIC ADJUSTMENTS ===
    desaturate: {
        name: "Desaturate",
        shader: EFFECT_SHADERS.desaturate,
        category: "Basic",
        params: [
            { name: "amount", label: "Amount", min: 0, max: 1, default: 1, step: 0.01 }
        ]
    },
    brightness: {
        name: "Brightness",
        shader: EFFECT_SHADERS.brightness,
        category: "Basic",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },
    contrast: {
        name: "Contrast",
        shader: EFFECT_SHADERS.contrast,
        category: "Basic",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 2, default: 0, step: 0.01 }
        ]
    },
    exposure: {
        name: "Exposure",
        shader: EFFECT_SHADERS.exposure,
        category: "Basic",
        params: [
            { name: "amount", label: "Stops", min: -3, max: 3, default: 0, step: 0.05 }
        ]
    },
    gamma: {
        name: "Gamma",
        shader: EFFECT_SHADERS.gamma,
        category: "Basic",
        params: [
            { name: "amount", label: "Gamma", min: 0.2, max: 3, default: 1, step: 0.05 }
        ]
    },
    vibrance: {
        name: "Vibrance",
        shader: EFFECT_SHADERS.vibrance,
        category: "Basic",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },
    saturation: {
        name: "Saturation",
        shader: EFFECT_SHADERS.saturation,
        category: "Basic",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 2, default: 0, step: 0.01 }
        ]
    },

    // === COLOR MANIPULATION ===
    hueShift: {
        name: "Hue Shift",
        shader: EFFECT_SHADERS.hueShift,
        category: "Color",
        params: [
            { name: "amount", label: "Hue", min: -0.5, max: 0.5, default: 0, step: 0.01 }
        ]
    },
    temperature: {
        name: "Temperature",
        shader: EFFECT_SHADERS.temperature,
        category: "Color",
        params: [
            { name: "amount", label: "Temp", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },
    tint: {
        name: "Tint",
        shader: EFFECT_SHADERS.tint,
        category: "Color",
        params: [
            { name: "amount", label: "Tint", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },
    colorize: {
        name: "Colorize",
        shader: EFFECT_SHADERS.colorize,
        category: "Color",
        params: [
            { name: "hue", label: "Hue", min: 0, max: 1, default: 0, step: 0.01 },
            { name: "saturation", label: "Sat", min: 0, max: 1, default: 0.5, step: 0.01 }
        ]
    },
    channelMixer: {
        name: "Channel Mixer",
        shader: EFFECT_SHADERS.channelMixer,
        category: "Color",
        params: [
            { name: "redShift", label: "Red", min: -1, max: 1, default: 0, step: 0.01 },
            { name: "greenShift", label: "Green", min: -1, max: 1, default: 0, step: 0.01 },
            { name: "blueShift", label: "Blue", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },

    // === TONE ADJUSTMENTS ===
    highlights: {
        name: "Highlights",
        shader: EFFECT_SHADERS.highlights,
        category: "Tone",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },
    shadows: {
        name: "Shadows",
        shader: EFFECT_SHADERS.shadows,
        category: "Tone",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },
    whites: {
        name: "Whites",
        shader: EFFECT_SHADERS.whites,
        category: "Tone",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },
    blacks: {
        name: "Blacks",
        shader: EFFECT_SHADERS.blacks,
        category: "Tone",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },
    levels: {
        name: "Levels",
        shader: EFFECT_SHADERS.levels,
        category: "Tone",
        params: [
            { name: "blackPoint", label: "Black", min: 0, max: 0.5, default: 0, step: 0.01 },
            { name: "whitePoint", label: "White", min: 0.5, max: 1, default: 1, step: 0.01 },
            { name: "midtones", label: "Mid", min: 0.1, max: 3, default: 1, step: 0.01 }
        ]
    },
    curves: {
        name: "Curves",
        shader: EFFECT_SHADERS.curves,
        category: "Tone",
        params: [
            { name: "shadows", label: "Shadows", min: -1, max: 1, default: 0, step: 0.01 },
            { name: "midtones", label: "Mids", min: -1, max: 1, default: 0, step: 0.01 },
            { name: "highlights", label: "Highs", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },

    // === BLUR & SHARPEN ===
    blur: {
        name: "Blur",
        shader: EFFECT_SHADERS.blur,
        category: "Detail",
        needsResolution: true,
        params: [
            { name: "amount", label: "Radius", min: 0, max: 20, default: 5, step: 0.5 }
        ]
    },
    sharpen: {
        name: "Sharpen",
        shader: EFFECT_SHADERS.sharpen,
        category: "Detail",
        needsResolution: true,
        params: [
            { name: "amount", label: "Amount", min: 0, max: 2, default: 0.5, step: 0.05 }
        ]
    },
    unsharpMask: {
        name: "Unsharp Mask",
        shader: EFFECT_SHADERS.unsharpMask,
        category: "Detail",
        needsResolution: true,
        params: [
            { name: "amount", label: "Amount", min: 0, max: 3, default: 1, step: 0.1 },
            { name: "threshold", label: "Threshold", min: 0, max: 0.5, default: 0.1, step: 0.01 }
        ]
    },
    clarity: {
        name: "Clarity",
        shader: EFFECT_SHADERS.clarity,
        category: "Detail",
        needsResolution: true,
        params: [
            { name: "amount", label: "Amount", min: -1, max: 2, default: 0, step: 0.05 }
        ]
    },
    dehaze: {
        name: "Dehaze",
        shader: EFFECT_SHADERS.dehaze,
        category: "Detail",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 1, default: 0, step: 0.01 }
        ]
    },

    // === STYLISTIC EFFECTS ===
    vignette: {
        name: "Vignette",
        shader: EFFECT_SHADERS.vignette,
        category: "Effects",
        params: [
            { name: "amount", label: "Amount", min: 0, max: 2, default: 0.5, step: 0.05 },
            { name: "softness", label: "Soft", min: 0, max: 0.5, default: 0.2, step: 0.01 }
        ]
    },
    grain: {
        name: "Grain",
        shader: EFFECT_SHADERS.grain,
        category: "Effects",
        needsSeed: true,
        params: [
            { name: "amount", label: "Amount", min: 0, max: 0.5, default: 0.1, step: 0.01 },
            { name: "size", label: "Size", min: 1, max: 500, default: 100, step: 10 },
            { name: "animate", label: "Animate", type: "checkbox", default: false }
        ]
    },
    posterize: {
        name: "Posterize",
        shader: EFFECT_SHADERS.posterize,
        category: "Effects",
        params: [
            { name: "levels", label: "Levels", min: 2, max: 32, default: 8, step: 1 }
        ]
    },
    threshold: {
        name: "Threshold",
        shader: EFFECT_SHADERS.threshold,
        category: "Effects",
        params: [
            { name: "threshold", label: "Threshold", min: 0, max: 1, default: 0.5, step: 0.01 }
        ]
    },
    invert: {
        name: "Invert",
        shader: EFFECT_SHADERS.invert,
        category: "Effects",
        params: [
            { name: "amount", label: "Amount", min: 0, max: 1, default: 1, step: 0.01 }
        ]
    },
    sepia: {
        name: "Sepia",
        shader: EFFECT_SHADERS.sepia,
        category: "Effects",
        params: [
            { name: "amount", label: "Amount", min: 0, max: 1, default: 1, step: 0.01 }
        ]
    },
    duotone: {
        name: "Duotone",
        shader: EFFECT_SHADERS.duotone,
        category: "Effects",
        params: [
            { name: "shadowR", label: "Shd R", min: 0, max: 1, default: 0.1, step: 0.01 },
            { name: "shadowG", label: "Shd G", min: 0, max: 1, default: 0.0, step: 0.01 },
            { name: "shadowB", label: "Shd B", min: 0, max: 1, default: 0.2, step: 0.01 },
            { name: "highlightR", label: "Hi R", min: 0, max: 1, default: 1.0, step: 0.01 },
            { name: "highlightG", label: "Hi G", min: 0, max: 1, default: 0.9, step: 0.01 },
            { name: "highlightB", label: "Hi B", min: 0, max: 1, default: 0.6, step: 0.01 }
        ]
    },

    // === EDGE & DETAIL ===
    emboss: {
        name: "Emboss",
        shader: EFFECT_SHADERS.emboss,
        category: "Artistic",
        needsResolution: true,
        params: [
            { name: "amount", label: "Amount", min: 0, max: 4, default: 2, step: 0.1 }
        ]
    },
    edgeDetect: {
        name: "Edge Detect",
        shader: EFFECT_SHADERS.edgeDetect,
        category: "Artistic",
        needsResolution: true,
        params: [
            { name: "amount", label: "Amount", min: 0, max: 3, default: 1, step: 0.1 }
        ]
    },
    sketch: {
        name: "Sketch",
        shader: EFFECT_SHADERS.sketch,
        category: "Artistic",
        needsResolution: true,
        params: [
            { name: "amount", label: "Intensity", min: 1, max: 10, default: 4, step: 0.5 }
        ]
    },
    oilPaint: {
        name: "Oil Paint",
        shader: EFFECT_SHADERS.oilPaint,
        category: "Artistic",
        needsResolution: true,
        params: [
            { name: "radius", label: "Radius", min: 1, max: 5, default: 2, step: 0.5 },
            { name: "levels", label: "Levels", min: 4, max: 32, default: 12, step: 1 }
        ]
    },

    // === CREATIVE EFFECTS ===
    pixelate: {
        name: "Pixelate",
        shader: EFFECT_SHADERS.pixelate,
        category: "Creative",
        needsResolution: true,
        params: [
            { name: "size", label: "Size", min: 1, max: 50, default: 8, step: 1 }
        ]
    },
    chromatic: {
        name: "Chromatic Aberration",
        shader: EFFECT_SHADERS.chromatic,
        category: "Creative",
        needsResolution: true,
        params: [
            { name: "amount", label: "Amount", min: 0, max: 10, default: 2, step: 0.5 }
        ]
    },
    glitch: {
        name: "Glitch",
        shader: EFFECT_SHADERS.glitch,
        category: "Creative",
        needsResolution: true,
        needsSeed: true,
        params: [
            { name: "amount", label: "Amount", min: 0, max: 1, default: 0.3, step: 0.01 }
        ]
    },
    halftone: {
        name: "Halftone",
        shader: EFFECT_SHADERS.halftone,
        category: "Creative",
        needsResolution: true,
        params: [
            { name: "size", label: "Dot Size", min: 2, max: 20, default: 6, step: 1 }
        ]
    },

    // === LENS EFFECTS ===
    lensDistort: {
        name: "Lens Distortion",
        shader: EFFECT_SHADERS.lensDistort,
        category: "Lens",
        params: [
            { name: "amount", label: "Amount", min: -1, max: 1, default: 0, step: 0.05 }
        ]
    },
    tiltShift: {
        name: "Tilt Shift",
        shader: EFFECT_SHADERS.tiltShift,
        category: "Lens",
        needsResolution: true,
        params: [
            { name: "focus", label: "Focus", min: 0, max: 1, default: 0.5, step: 0.01 },
            { name: "range", label: "Range", min: 0.05, max: 0.5, default: 0.2, step: 0.01 },
            { name: "blur", label: "Blur", min: 0, max: 20, default: 8, step: 1 }
        ]
    },
    radialBlur: {
        name: "Radial Blur",
        shader: EFFECT_SHADERS.radialBlur,
        category: "Lens",
        params: [
            { name: "amount", label: "Amount", min: 0, max: 1, default: 0.3, step: 0.01 }
        ]
    }
};

// ============================================================================
// WEBGL FILTER ENGINE
// ============================================================================

class FilterEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
        if (!this.gl) {
            console.error("[Purz] WebGL not available");
            return;
        }

        this.programs = {};
        this.sourceTexture = null;
        this.framebuffers = [];
        this.imageLoaded = false;

        this._initGeometry();
        this._initPrograms();
    }

    _initGeometry() {
        const gl = this.gl;

        // Full-screen quad positions
        const positions = new Float32Array([
            -1, -1,  1, -1,  -1, 1,
            -1,  1,  1, -1,   1, 1
        ]);

        // Standard texture coordinates (no flip - we handle flip on image load)
        const texCoords = new Float32Array([
            0, 0,  1, 0,  0, 1,
            0, 1,  1, 0,  1, 1
        ]);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    }

    _compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("[Purz] Shader error:", gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    _createProgram(fragmentSource) {
        const gl = this.gl;
        const vertexShader = this._compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
        const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        if (!vertexShader || !fragmentShader) return null;

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("[Purz] Program link error:", gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    _initPrograms() {
        this.programs.passthrough = this._createProgram(PASSTHROUGH_SHADER);

        for (const [key, effect] of Object.entries(EFFECTS)) {
            this.programs[key] = this._createProgram(effect.shader);
        }
    }

    /**
     * Load and compile a custom shader on-demand.
     * @param {string} effectKey - The effect key
     * @param {string} shaderSource - The GLSL shader source
     * @returns {boolean} - Whether compilation succeeded
     */
    loadCustomShader(effectKey, shaderSource) {
        if (this.programs[effectKey]) {
            // Already compiled
            return true;
        }

        const program = this._createProgram(shaderSource);
        if (program) {
            this.programs[effectKey] = program;
            console.log(`[Purz] Compiled custom shader: ${effectKey}`);
            return true;
        }

        console.error(`[Purz] Failed to compile custom shader: ${effectKey}`);
        return false;
    }

    /**
     * Check if a shader program exists for the given effect.
     */
    hasProgram(effectKey) {
        return !!this.programs[effectKey];
    }

    _createTexture() {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return texture;
    }

    _createFramebuffer(width, height) {
        const gl = this.gl;
        const texture = this._createTexture();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        return { framebuffer: fb, texture };
    }

    _useProgram(program) {
        const gl = this.gl;
        gl.useProgram(program);

        const posLoc = gl.getAttribLocation(program, "a_position");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const texLoc = gl.getAttribLocation(program, "a_texCoord");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(texLoc);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
    }

    loadImage(imageElement) {
        const gl = this.gl;
        if (!gl) return;

        // Flip image on load since WebGL has origin at bottom-left
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        // Create source texture from image
        this.sourceTexture = this._createTexture();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageElement);

        // Reset flip for framebuffer operations
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

        // Create two framebuffers for ping-pong rendering
        this.framebuffers = [
            this._createFramebuffer(this.canvas.width, this.canvas.height),
            this._createFramebuffer(this.canvas.width, this.canvas.height)
        ];

        this.imageLoaded = true;
    }

    render(layers) {
        if (!this.imageLoaded || !this.gl) return;

        const gl = this.gl;
        const width = this.canvas.width;
        const height = this.canvas.height;

        gl.viewport(0, 0, width, height);

        // Filter to only enabled layers
        const enabledLayers = layers.filter(l => l.enabled);

        // If no layers, just show original image
        if (enabledLayers.length === 0) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            this._useProgram(this.programs.passthrough);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
            gl.uniform1i(gl.getUniformLocation(this.programs.passthrough, "u_image"), 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return;
        }

        // Process layers with ping-pong rendering
        let pingPong = 0;
        let inputTexture = this.sourceTexture;

        for (let i = 0; i < enabledLayers.length; i++) {
            const layer = enabledLayers[i];
            const program = this.programs[layer.effect];
            if (!program) continue;

            const isLast = (i === enabledLayers.length - 1);

            // Render to framebuffer or screen (if last layer)
            if (isLast) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            } else {
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[pingPong].framebuffer);
            }

            this._useProgram(program);

            // Bind input texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, inputTexture);
            gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);

            // Set effect parameters (check both built-in and custom effects)
            const effectDef = EFFECTS[layer.effect] || CustomShaderLoader.customEffects[layer.effect];
            if (!effectDef) {
                console.warn(`[Purz] Unknown effect in render: ${layer.effect}`);
                continue;
            }
            for (const param of effectDef.params) {
                const value = layer.params[param.name] ?? param.default;
                gl.uniform1f(gl.getUniformLocation(program, `u_${param.name}`), value);
            }

            // Set opacity
            gl.uniform1f(gl.getUniformLocation(program, "u_opacity"), layer.opacity);

            // Set resolution if needed
            if (effectDef.needsResolution) {
                gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), width, height);
            }

            // Set seed if needed (for grain, glitch, etc.)
            // Use stored seed from layer.params to ensure preview matches output
            if (effectDef.needsSeed) {
                const seed = layer.params.seed !== undefined ? layer.params.seed : 0;
                gl.uniform1f(gl.getUniformLocation(program, "u_seed"), seed);
            }

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // Set up for next iteration
            if (!isLast) {
                inputTexture = this.framebuffers[pingPong].texture;
                pingPong = 1 - pingPong; // Toggle between 0 and 1
            }
        }
    }

    getImageData() {
        return this.canvas.toDataURL("image/png");
    }

    /**
     * Render at full resolution and return image data.
     * Used for output to ensure quality matches input resolution.
     */
    getFullResolutionImageData(layers, sourceImage) {
        if (!this.gl || !sourceImage) return null;

        const gl = this.gl;
        const fullW = sourceImage.naturalWidth;
        const fullH = sourceImage.naturalHeight;

        // Store current canvas size
        const prevW = this.canvas.width;
        const prevH = this.canvas.height;
        const prevStyleW = this.canvas.style.width;
        const prevStyleH = this.canvas.style.height;

        // Resize canvas to full resolution
        this.canvas.width = fullW;
        this.canvas.height = fullH;

        // Recreate framebuffers at full resolution
        const oldFBs = this.framebuffers;
        this.framebuffers = [
            this._createFramebuffer(fullW, fullH),
            this._createFramebuffer(fullW, fullH)
        ];

        // Re-upload source image at full resolution
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImage);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

        // Render at full resolution
        this.render(layers);

        // Capture the result
        const imageData = this.canvas.toDataURL("image/png");

        // Clean up full-res framebuffers
        for (const fb of this.framebuffers) {
            gl.deleteFramebuffer(fb.framebuffer);
            gl.deleteTexture(fb.texture);
        }

        // Restore previous size and framebuffers
        this.canvas.width = prevW;
        this.canvas.height = prevH;
        this.canvas.style.width = prevStyleW;
        this.canvas.style.height = prevStyleH;
        this.framebuffers = oldFBs;

        // Re-upload source at preview resolution
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImage);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

        // Re-render at preview resolution
        this.render(layers);

        return imageData;
    }
}

// ============================================================================
// PRESETS
// ============================================================================

const PRESETS = {
    // --- FILM & CINEMATIC ---
    "cinematic_teal_orange": {
        name: "Cinematic Teal & Orange",
        category: "Film",
        layers: [
            { effect: "contrast", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "temperature", params: { amount: 0.1 }, opacity: 0.7 },
            { effect: "shadows", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.05 }, opacity: 1.0 },
            { effect: "vibrance", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.3, softness: 0.4 }, opacity: 0.6 }
        ]
    },
    "film_noir": {
        name: "Film Noir",
        category: "Film",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.4 }, opacity: 1.0 },
            { effect: "blacks", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.5, softness: 0.3 }, opacity: 0.8 },
            { effect: "grain", params: { amount: 0.08, size: 100 }, opacity: 0.5 }
        ]
    },
    "vintage_film": {
        name: "Vintage Film",
        category: "Film",
        layers: [
            { effect: "sepia", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "grain", params: { amount: 0.12, size: 80 }, opacity: 0.7 },
            { effect: "vignette", params: { amount: 0.4, softness: 0.5 }, opacity: 0.5 }
        ]
    },
    "blockbuster": {
        name: "Blockbuster",
        category: "Film",
        layers: [
            { effect: "contrast", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.3 }, opacity: 0.8 },
            { effect: "shadows", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.25, softness: 0.5 }, opacity: 0.5 }
        ]
    },
    "faded_film": {
        name: "Faded Film",
        category: "Film",
        layers: [
            { effect: "blacks", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.2 }, opacity: 1.0 },
            { effect: "temperature", params: { amount: 0.05 }, opacity: 0.6 },
            { effect: "grain", params: { amount: 0.06, size: 120 }, opacity: 0.6 }
        ]
    },

    // --- PORTRAIT ---
    "portrait_soft": {
        name: "Soft Portrait",
        category: "Portrait",
        layers: [
            { effect: "clarity", params: { amount: -0.2 }, opacity: 0.6 },
            { effect: "highlights", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "vibrance", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.2, softness: 0.6 }, opacity: 0.4 }
        ]
    },
    "portrait_dramatic": {
        name: "Dramatic Portrait",
        category: "Portrait",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.25 }, opacity: 0.7 },
            { effect: "shadows", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.35, softness: 0.4 }, opacity: 0.6 }
        ]
    },
    "portrait_warm": {
        name: "Warm Portrait",
        category: "Portrait",
        layers: [
            { effect: "temperature", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "exposure", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "vibrance", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.15, softness: 0.5 }, opacity: 0.4 }
        ]
    },

    // --- LANDSCAPE ---
    "landscape_vivid": {
        name: "Vivid Landscape",
        category: "Landscape",
        layers: [
            { effect: "vibrance", params: { amount: 0.35 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.3 }, opacity: 0.8 },
            { effect: "dehaze", params: { amount: 0.2 }, opacity: 0.7 },
            { effect: "highlights", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "shadows", params: { amount: 0.15 }, opacity: 1.0 }
        ]
    },
    "landscape_moody": {
        name: "Moody Landscape",
        category: "Landscape",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.25 }, opacity: 1.0 },
            { effect: "temperature", params: { amount: -0.1 }, opacity: 0.8 },
            { effect: "vignette", params: { amount: 0.3, softness: 0.4 }, opacity: 0.6 },
            { effect: "clarity", params: { amount: 0.2 }, opacity: 0.7 }
        ]
    },
    "golden_hour": {
        name: "Golden Hour",
        category: "Landscape",
        layers: [
            { effect: "temperature", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "exposure", params: { amount: 0.15 }, opacity: 0.8 },
            { effect: "highlights", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "vibrance", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.2, softness: 0.6 }, opacity: 0.4 }
        ]
    },
    "blue_hour": {
        name: "Blue Hour",
        category: "Landscape",
        layers: [
            { effect: "temperature", params: { amount: -0.2 }, opacity: 1.0 },
            { effect: "tint", params: { amount: 0.05 }, opacity: 0.6 },
            { effect: "contrast", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "shadows", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.1 }, opacity: 0.8 }
        ]
    },

    // --- BLACK & WHITE ---
    "bw_high_contrast": {
        name: "B&W High Contrast",
        category: "Black & White",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.4 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.2 }, opacity: 0.8 }
        ]
    },
    "bw_soft": {
        name: "B&W Soft",
        category: "Black & White",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "blacks", params: { amount: 0.05 }, opacity: 1.0 },
            { effect: "grain", params: { amount: 0.04, size: 150 }, opacity: 0.5 }
        ]
    },
    "bw_dramatic": {
        name: "B&W Dramatic",
        category: "Black & White",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.35 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.3 }, opacity: 0.8 },
            { effect: "vignette", params: { amount: 0.4, softness: 0.35 }, opacity: 0.7 }
        ]
    },

    // --- MOOD & STYLE ---
    "dreamy": {
        name: "Dreamy",
        category: "Mood",
        layers: [
            { effect: "blur", params: { amount: 1.5 }, opacity: 0.3 },
            { effect: "highlights", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.1 }, opacity: 1.0 }
        ]
    },
    "dark_moody": {
        name: "Dark & Moody",
        category: "Mood",
        layers: [
            { effect: "exposure", params: { amount: -0.2 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.3 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.45, softness: 0.35 }, opacity: 0.7 }
        ]
    },
    "light_airy": {
        name: "Light & Airy",
        category: "Mood",
        layers: [
            { effect: "exposure", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.1 }, opacity: 1.0 }
        ]
    },
    "cyberpunk": {
        name: "Cyberpunk",
        category: "Mood",
        layers: [
            { effect: "contrast", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "tint", params: { amount: 0.15 }, opacity: 0.6 },
            { effect: "chromatic", params: { amount: 3 }, opacity: 0.4 },
            { effect: "vignette", params: { amount: 0.35, softness: 0.3 }, opacity: 0.6 }
        ]
    },
    "retro_80s": {
        name: "Retro 80s",
        category: "Mood",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "tint", params: { amount: 0.1 }, opacity: 0.5 },
            { effect: "grain", params: { amount: 0.08, size: 100 }, opacity: 0.5 },
            { effect: "vignette", params: { amount: 0.25, softness: 0.5 }, opacity: 0.5 }
        ]
    },

    // --- CREATIVE ---
    "duotone_blue": {
        name: "Duotone Blue",
        category: "Creative",
        layers: [
            { effect: "duotone", params: { shadowR: 0.0, shadowG: 0.1, shadowB: 0.3, highlightR: 0.9, highlightG: 0.95, highlightB: 1.0 }, opacity: 1.0 }
        ]
    },
    "duotone_warm": {
        name: "Duotone Warm",
        category: "Creative",
        layers: [
            { effect: "duotone", params: { shadowR: 0.2, shadowG: 0.05, shadowB: 0.0, highlightR: 1.0, highlightG: 0.95, highlightB: 0.8 }, opacity: 1.0 }
        ]
    },
    "cross_process": {
        name: "Cross Process",
        category: "Creative",
        layers: [
            { effect: "curves", params: { shadows: 0.1, midtones: -0.05, highlights: 0.1 }, opacity: 1.0 },
            { effect: "channelMixer", params: { redShift: 0.05, greenShift: -0.05, blueShift: 0.1 }, opacity: 0.7 },
            { effect: "contrast", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.2 }, opacity: 1.0 }
        ]
    },
    "lomo": {
        name: "Lomo",
        category: "Creative",
        layers: [
            { effect: "contrast", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.5, softness: 0.3 }, opacity: 0.8 },
            { effect: "grain", params: { amount: 0.06, size: 100 }, opacity: 0.5 }
        ]
    },
    "sketch_effect": {
        name: "Sketch",
        category: "Creative",
        layers: [
            { effect: "sketch", params: { amount: 4.0 }, opacity: 1.0 }
        ]
    },

    // --- CINEMATIC (New) ---
    "cinematic_blockbuster": {
        name: "Blockbuster Cinema",
        category: "Cinematic",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "splitTone", params: { shadowHue: 0.55, shadowSat: 0.25, highlightHue: 0.08, highlightSat: 0.2, balance: 0.1 }, opacity: 0.8 },
            { effect: "anamorphic", params: { squeeze: 1.0, flareStrength: 0.2, aberration: 0.002 }, opacity: 0.6 },
            { effect: "lensVignette", params: { amount: 0.6, falloff: 2.5, roundness: 1.2 }, opacity: 0.7 }
        ]
    },
    "cinematic_noir_modern": {
        name: "Modern Noir",
        category: "Cinematic",
        layers: [
            { effect: "desaturate", params: { amount: 0.85 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.35 }, opacity: 1.0 },
            { effect: "toneCurve", params: { contrast: 0.2, pivot: 0.4 }, opacity: 0.8 },
            { effect: "grain", params: { amount: 0.06, size: 80 }, opacity: 0.5 },
            { effect: "lensVignette", params: { amount: 0.8, falloff: 2, roundness: 1 }, opacity: 0.8 }
        ]
    },
    "cinematic_scifi": {
        name: "Sci-Fi Blue",
        category: "Cinematic",
        layers: [
            { effect: "temperature", params: { amount: -0.2 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "colorLookup", params: { intensity: 0.5, warmth: -0.3, tealOrange: 0.4 }, opacity: 0.7 },
            { effect: "chromatic", params: { amount: 0.15 }, opacity: 0.4 },
            { effect: "crtScanlines", params: { intensity: 0.15, density: 300, curvature: 0.1 }, opacity: 0.3 }
        ]
    },
    "cinematic_horror": {
        name: "Horror Atmosphere",
        category: "Cinematic",
        layers: [
            { effect: "exposure", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.4 }, opacity: 1.0 },
            { effect: "gradientMap", params: { shadowR: 0.1, shadowG: 0.05, shadowB: 0.1, midR: 0.3, midG: 0.25, midB: 0.3, highlightR: 0.9, highlightG: 0.85, highlightB: 0.8 }, opacity: 0.4 },
            { effect: "lensVignette", params: { amount: 1.2, falloff: 1.8, roundness: 1 }, opacity: 0.9 }
        ]
    },

    // --- VINTAGE (New) ---
    "vintage_kodachrome": {
        name: "Kodachrome Style",
        category: "Vintage",
        layers: [
            { effect: "contrast", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "vibrancePro", params: { vibrance: 0.3, protectSkin: 0.6, satBoost: 0.15 }, opacity: 0.9 },
            { effect: "rgbCurves", params: { redLift: 0.02, redGamma: 0, redGain: 0.05, greenLift: 0, greenGamma: 0, greenGain: 0, blueLift: -0.03, blueGamma: 0, blueGain: -0.05 }, opacity: 0.7 },
            { effect: "grain", params: { amount: 0.05, size: 100 }, opacity: 0.5 }
        ]
    },
    "vintage_polaroid": {
        name: "Polaroid Memories",
        category: "Vintage",
        layers: [
            { effect: "fade", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "temperature", params: { amount: 0.1 }, opacity: 0.8 },
            { effect: "contrast", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.3, softness: 0.5 }, opacity: 0.6 },
            { effect: "grain", params: { amount: 0.08, size: 120 }, opacity: 0.6 }
        ]
    },
    "vintage_70s": {
        name: "70s Warm",
        category: "Vintage",
        layers: [
            { effect: "crossProcess", params: { amount: 0.4 }, opacity: 0.6 },
            { effect: "temperature", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "fade", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.05 }, opacity: 1.0 },
            { effect: "lightLeak", params: { intensity: 0.3, position: 0.2, color: 0.7 }, opacity: 0.5 },
            { effect: "grain", params: { amount: 0.1, size: 80 }, opacity: 0.6 }
        ]
    },
    "vintage_daguerreotype": {
        name: "Daguerreotype",
        category: "Vintage",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "sepia", params: { amount: 0.4 }, opacity: 0.7 },
            { effect: "contrast", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "lensVignette", params: { amount: 0.9, falloff: 1.5, roundness: 0.8 }, opacity: 0.8 },
            { effect: "scratch", params: { density: 0.2, intensity: 0.3 }, opacity: 0.5 },
            { effect: "dust", params: { density: 0.2, size: 1.2 }, opacity: 0.4 }
        ]
    },

    // --- STYLIZED (New) ---
    "stylized_neon_nights": {
        name: "Neon Nights",
        category: "Stylized",
        layers: [
            { effect: "contrast", params: { amount: 0.4 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.5 }, opacity: 1.0 },
            { effect: "splitTone", params: { shadowHue: 0.75, shadowSat: 0.4, highlightHue: 0.95, highlightSat: 0.3, balance: -0.2 }, opacity: 0.7 },
            { effect: "chromatic", params: { amount: 0.3 }, opacity: 0.5 },
            { effect: "vignette", params: { amount: 0.4, softness: 0.3 }, opacity: 0.7 }
        ]
    },
    "stylized_anime": {
        name: "Anime Style",
        category: "Stylized",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "posterize", params: { levels: 12 }, opacity: 0.4 },
            { effect: "edgeDetect", params: { amount: 0.8 }, opacity: 0.15 }
        ]
    },
    "stylized_watercolor_dream": {
        name: "Watercolor Dream",
        category: "Stylized",
        layers: [
            { effect: "watercolor", params: { wetness: 0.6, granulation: 0.4 }, opacity: 0.8 },
            { effect: "saturation", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.15 }, opacity: 1.0 }
        ]
    },
    "stylized_comic": {
        name: "Comic Panel",
        category: "Stylized",
        layers: [
            { effect: "comicBook", params: { edgeThickness: 2.5, colorLevels: 6 }, opacity: 0.9 },
            { effect: "contrast", params: { amount: 0.15 }, opacity: 1.0 }
        ]
    },

    // --- PHOTO ENHANCEMENT (New) ---
    "enhance_portrait_pro": {
        name: "Portrait Pro",
        category: "Enhancement",
        layers: [
            { effect: "surfaceBlur", params: { radius: 3, threshold: 0.12 }, opacity: 0.4 },
            { effect: "smartSharpen", params: { amount: 0.8, radius: 1, threshold: 0.05 }, opacity: 0.6 },
            { effect: "vibrancePro", params: { vibrance: 0.15, protectSkin: 0.8, satBoost: 0 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "shadows", params: { amount: 0.05 }, opacity: 1.0 }
        ]
    },
    "enhance_landscape_hdr": {
        name: "Landscape HDR",
        category: "Enhancement",
        layers: [
            { effect: "hdrTone", params: { strength: 0.6, detail: 0.5 }, opacity: 0.8 },
            { effect: "localContrast", params: { amount: 0.3, radius: 8 }, opacity: 0.7 },
            { effect: "vibrancePro", params: { vibrance: 0.25, protectSkin: 0.3, satBoost: 0.1 }, opacity: 1.0 },
            { effect: "dehaze", params: { amount: 0.2 }, opacity: 0.7 }
        ]
    },
    "enhance_detail_pop": {
        name: "Detail Pop",
        category: "Enhancement",
        layers: [
            { effect: "microContrast", params: { amount: 0.8, radius: 4 }, opacity: 0.7 },
            { effect: "textureEnhance", params: { strength: 0.6, scale: 8 }, opacity: 0.5 },
            { effect: "clarity", params: { amount: 0.4 }, opacity: 0.8 },
            { effect: "contrast", params: { amount: 0.1 }, opacity: 1.0 }
        ]
    },
    "enhance_auto_fix": {
        name: "Auto Enhance",
        category: "Enhancement",
        layers: [
            { effect: "autoContrast", params: { amount: 0.6 }, opacity: 0.8 },
            { effect: "shadowRecovery", params: { amount: 0.4, range: 0.3 }, opacity: 0.7 },
            { effect: "highlightRecovery", params: { amount: 0.3, range: 0.8 }, opacity: 0.7 },
            { effect: "vibrancePro", params: { vibrance: 0.1, protectSkin: 0.5, satBoost: 0 }, opacity: 1.0 }
        ]
    }
};

// ============================================================================
// UI STYLES
// ============================================================================

function createStyles() {
    if (document.getElementById('purz-filter-styles')) return;

    const style = document.createElement('style');
    style.id = 'purz-filter-styles';
    style.textContent = `
        .purz-filter-container {
            display: flex;
            flex-direction: column;
            width: 100%;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12px;
            color: #ddd;
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
            min-height: 0;
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
    `;
    document.head.appendChild(style);
}

function fitHeight(node, widget) {
    if (!node) return;

    // Calculate height directly from widget state
    let height = 500; // Base height
    if (widget) {
        const size = widget.computeSize(node.size[0]);
        height = size[1] + 50; // Add extra buffer

        // Also set min-height on container to force LiteGraph to respect it
        if (widget.container) {
            widget.container.style.minHeight = (size[1] - 30) + "px";
        }
    }

    node.setSize([node.size[0], height]);
    node?.graph?.setDirtyCanvas(true);
}

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

        createStyles();
        this._buildUI();
        this._initPresets();
        this._initCustomShaders();
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
        this.container.appendChild(canvasWrapper);

        // Playback controls (hidden until batch loaded)
        this.playbackRow = document.createElement("div");
        this.playbackRow.className = "purz-playback-row hidden";

        this.playBtn = document.createElement("button");
        this.playBtn.className = "purz-play-btn";
        this.playBtn.innerHTML = "▶";
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
        this.layers = this.layers.filter(l => l.id !== id);
        this._renderLayers();
        this._updatePreview();
        fitHeight(this.node, this);
    }

    _reorderLayer(draggedId, targetId, insertBefore) {
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
        dragHandle.innerHTML = "⋮⋮";
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

        const select = document.createElement("select");
        select.className = "purz-layer-select";

        // Group effects by category (including custom effects)
        const allEffects = this._getAllEffects();
        const categories = {};
        for (const [key, effect] of Object.entries(allEffects)) {
            const cat = effect.category || "Other";
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ key, effect });
        }

        // Sort categories with Custom at the end
        const categoryOrder = ["Basic", "Color", "Tone", "Detail", "Effects", "Artistic", "Creative", "Lens", "Custom"];
        const sortedCategories = Object.entries(categories).sort((a, b) => {
            const aIdx = categoryOrder.indexOf(a[0]);
            const bIdx = categoryOrder.indexOf(b[0]);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });

        // Add options grouped by category
        for (const [category, effects] of sortedCategories) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = category;
            for (const { key, effect } of effects) {
                const opt = document.createElement("option");
                opt.value = key;
                opt.textContent = effect.name;
                opt.selected = key === layer.effect;
                optgroup.appendChild(opt);
            }
            select.appendChild(optgroup);
        }
        select.addEventListener("change", async () => {
            layer.effect = select.value;
            layer.params = {};
            const effectDef = this._getEffectDef(layer.effect);
            if (effectDef) {
                for (const param of effectDef.params) {
                    layer.params[param.name] = param.default;
                }
                // Generate seed for effects that need it
                if (effectDef.needsSeed) {
                    layer.params.seed = Math.random() * 1000;
                }
                // Ensure custom shader is compiled
                await this._ensureCustomShaderCompiled(layer.effect);
            }
            this._renderLayers();
            this._updatePreview();
        });
        header.appendChild(select);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "purz-layer-delete";
        deleteBtn.textContent = "×";
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
                    layer.params[param.name] = checkbox.checked;
                    this._updatePreview();
                    this._syncToBackend();
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
                layer.params[param.name] = parseFloat(slider.value);
                valueSpan.textContent = parseFloat(slider.value).toFixed(2);
                this._updatePreview();
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
        });

        opacityRow.appendChild(opacitySlider);
        opacityRow.appendChild(opacityValue);
        controls.appendChild(opacityRow);

        el.appendChild(controls);
        return el;
    }

    _updatePreview() {
        if (!this.engine || !this.engine.imageLoaded) return;
        this.engine.render(this.layers);

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
        if (!this.batchImages || this.batchImages.length === 0) return;
        if (this.batchProcessing) return; // Prevent concurrent processing

        if (this.layers.length === 0) {
            // No filters, clear any previous rendered batch
            api.fetchApi("/purz/interactive/set_rendered_batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    node_id: this.node.id,
                    rendered_frames: []
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

        // Store original seeds for layers that may animate
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
                        // Vary seed per frame for animated grain effect
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

        // Restore original seeds
        for (const layer of this.layers) {
            if (originalSeeds[layer.id] !== undefined) {
                layer.params.seed = originalSeeds[layer.id];
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
        this.playBtn.innerHTML = "⏸";
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
        this.playBtn.innerHTML = "▶";
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

            this._setStatus(`${img.naturalWidth}×${img.naturalHeight}`, "success");
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

        // Vertical layout: canvas + header/status + layers + actions
        const headerHeight = 40; // Status and layers header
        const layersHeight = this.layers.length > 0
            ? Math.max(50, this.layers.length * 90)
            : 40; // Empty state height
        const actionsHeight = 50; // Save/Reset buttons

        const padding = 20;

        const totalHeight = canvasDisplayHeight + headerHeight + layersHeight + actionsHeight + padding;
        return [width, totalHeight];
    }
}

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
            console.log("[Purz] Received batch_pending event:", event);
            const { node_id, batch_size, images } = event.detail;
            console.log(`[Purz] Backend waiting for batch processing: node ${node_id}, ${batch_size} frames`);

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

                const widget = new InteractiveFilterWidget(this);

                const domWidget = this.addDOMWidget("interactive_filter", "preview", widget.getElement(), {
                    serialize: false,
                    hideOnZoom: false,
                });

                domWidget.computeSize = (width) => widget.computeSize(width);

                this.filterWidget = widget;
                this.setSize([340, 500]);

                // Enforce minimum width based on image
                const originalOnResize = this.onResize;
                this.onResize = function(size) {
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
