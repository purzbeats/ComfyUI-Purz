/**
 * Purz Filter Engine Module
 * WebGL shader definitions, effect metadata, and the FilterEngine class.
 */

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

    /**
     * Render only the original image (no filters).
     */
    renderOriginal() {
        if (!this.imageLoaded || !this.gl) return;
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this._useProgram(this.programs.passthrough);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
        gl.uniform1i(gl.getUniformLocation(this.programs.passthrough, "u_image"), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /**
     * Render A/B split: left side = original, right side = filtered.
     * Uses WebGL scissor test for clean split.
     */
    renderSplit(layers, splitPosition) {
        if (!this.imageLoaded || !this.gl) return;
        const gl = this.gl;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const splitX = Math.floor(width * splitPosition);

        gl.viewport(0, 0, width, height);

        // First pass: render filtered to a framebuffer
        // Reuse ping-pong approach but render full filtered result to framebuffer 0
        const enabledLayers = layers.filter(l => l.enabled);

        if (enabledLayers.length > 0) {
            // Process all layers, but render last layer to framebuffer instead of screen
            let pingPong = 0;
            let inputTexture = this.sourceTexture;

            for (let i = 0; i < enabledLayers.length; i++) {
                const layer = enabledLayers[i];
                const program = this.programs[layer.effect];
                if (!program) continue;

                // Always render to framebuffer (we'll composite to screen later)
                const fbIdx = (i === enabledLayers.length - 1) ? 0 : pingPong;
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[fbIdx].framebuffer);

                this._useProgram(program);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, inputTexture);
                gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);

                const effectDef = EFFECTS[layer.effect] || CustomShaderLoader.customEffects[layer.effect];
                if (!effectDef) continue;
                for (const param of effectDef.params) {
                    const value = layer.params[param.name] ?? param.default;
                    gl.uniform1f(gl.getUniformLocation(program, `u_${param.name}`), value);
                }
                gl.uniform1f(gl.getUniformLocation(program, "u_opacity"), layer.opacity);
                if (effectDef.needsResolution) {
                    gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), width, height);
                }
                if (effectDef.needsSeed) {
                    const seed = layer.params.seed !== undefined ? layer.params.seed : 0;
                    gl.uniform1f(gl.getUniformLocation(program, "u_seed"), seed);
                }
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                if (i < enabledLayers.length - 1) {
                    inputTexture = this.framebuffers[pingPong].texture;
                    pingPong = 1 - pingPong;
                }
            }
        }

        // Now composite to screen using scissor test
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.enable(gl.SCISSOR_TEST);

        // Left side: original
        gl.scissor(0, 0, splitX, height);
        this._useProgram(this.programs.passthrough);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
        gl.uniform1i(gl.getUniformLocation(this.programs.passthrough, "u_image"), 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Right side: filtered (from framebuffer 0, or original if no layers)
        gl.scissor(splitX, 0, width - splitX, height);
        if (enabledLayers.length > 0) {
            gl.bindTexture(gl.TEXTURE_2D, this.framebuffers[0].texture);
        }
        // else: sourceTexture is already bound (same as left side)
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.disable(gl.SCISSOR_TEST);
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

    /**
     * Clean up WebGL resources.
     * Call this when the widget is being destroyed to prevent memory leaks.
     */
    cleanup() {
        const gl = this.gl;
        if (!gl) return;

        // Delete framebuffers and their textures
        for (const fb of this.framebuffers) {
            if (fb.framebuffer) gl.deleteFramebuffer(fb.framebuffer);
            if (fb.texture) gl.deleteTexture(fb.texture);
        }
        this.framebuffers = [];

        // Delete source texture
        if (this.sourceTexture) {
            gl.deleteTexture(this.sourceTexture);
            this.sourceTexture = null;
        }

        // Delete buffers
        if (this.positionBuffer) {
            gl.deleteBuffer(this.positionBuffer);
            this.positionBuffer = null;
        }
        if (this.texCoordBuffer) {
            gl.deleteBuffer(this.texCoordBuffer);
            this.texCoordBuffer = null;
        }

        // Delete all shader programs
        for (const [key, program] of Object.entries(this.programs)) {
            if (program) gl.deleteProgram(program);
        }
        this.programs = {};

        // Lose WebGL context to free GPU memory
        const loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) {
            loseContext.loseContext();
        }

        this.gl = null;
        this.imageLoaded = false;
    }
}

export { CustomShaderLoader, VERTEX_SHADER, PASSTHROUGH_SHADER, EFFECT_SHADERS, EFFECTS, FilterEngine };
