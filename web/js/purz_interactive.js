/**
 * Purz Interactive Image Filter System
 *
 * A layer-based real-time image filter system with WebGL shaders.
 * Each layer can have its own effect and opacity.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

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
            { name: "size", label: "Size", min: 1, max: 500, default: 100, step: 10 }
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

            // Set effect parameters
            const effectDef = EFFECTS[layer.effect];
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

        createStyles();
        this._buildUI();
    }

    _buildUI() {
        this.container = document.createElement("div");
        this.container.className = "purz-filter-container";

        // Canvas wrapper (visible preview)
        const canvasWrapper = document.createElement("div");
        canvasWrapper.className = "purz-canvas-wrapper";

        this.canvas = document.createElement("canvas");
        this.canvas.className = "purz-canvas";
        this.canvas.width = 200;
        this.canvas.height = 200;
        canvasWrapper.appendChild(this.canvas);
        this.container.appendChild(canvasWrapper);

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

    _addLayer(effectType = "desaturate") {
        const layer = {
            id: ++this.layerIdCounter,
            effect: effectType,
            enabled: true,
            opacity: 1.0,
            params: {}
        };

        // Set default params
        for (const param of EFFECTS[effectType].params) {
            layer.params[param.name] = param.default;
        }

        // Generate and store seed for effects that need it (ensures preview matches output)
        const effectDef = EFFECTS[effectType];
        if (effectDef && effectDef.needsSeed) {
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

        // Header row
        const header = document.createElement("div");
        header.className = "purz-layer-header";

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

        // Group effects by category
        const categories = {};
        for (const [key, effect] of Object.entries(EFFECTS)) {
            const cat = effect.category || "Other";
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ key, effect });
        }

        // Add options grouped by category
        for (const [category, effects] of Object.entries(categories)) {
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
        select.addEventListener("change", () => {
            layer.effect = select.value;
            layer.params = {};
            for (const param of EFFECTS[layer.effect].params) {
                layer.params[param.name] = param.default;
            }
            // Generate seed for effects that need it
            const effectDef = EFFECTS[layer.effect];
            if (effectDef && effectDef.needsSeed) {
                layer.params.seed = Math.random() * 1000;
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

        // Effect params
        const effect = EFFECTS[layer.effect];
        for (const param of effect.params) {
            const row = document.createElement("div");
            row.className = "purz-control-row";

            const label = document.createElement("span");
            label.className = "purz-control-label";
            label.textContent = param.label;
            row.appendChild(label);

            const slider = document.createElement("input");
            slider.type = "range";
            slider.className = "purz-control-slider";
            slider.min = param.min;
            slider.max = param.max;
            slider.step = param.step;
            slider.value = layer.params[param.name] ?? param.default;

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
        this._syncLayersToBackend();
    }

    _syncLayersToBackend() {
        // Send layer state AND full-resolution rendered image to backend
        // This ensures workflow output exactly matches preview at full quality
        if (!this.node?.id) return;

        const layerData = this.layers.map(l => ({
            effect: l.effect,
            enabled: l.enabled,
            opacity: l.opacity,
            params: { ...l.params }
        }));

        // Capture the rendered image at FULL resolution for output quality
        let renderedImage = null;
        if (this.engine && this.engine.imageLoaded && this.layers.length > 0 && this.sourceImage) {
            // Render at full resolution to match input image size
            renderedImage = this.engine.getFullResolutionImageData(this.layers, this.sourceImage);
        }

        api.fetchApi("/purz/interactive/set_layers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                node_id: this.node.id,
                layers: layerData,
                rendered_image: renderedImage
            })
        }).catch(err => {
            console.warn("[Purz] Failed to sync layers:", err);
        });
    }

    _reset() {
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

                // Look for purz_images (custom key to avoid ComfyUI's default preview)
                if (message?.purz_images?.length > 0) {
                    const imgInfo = message.purz_images[0];
                    const params = new URLSearchParams({
                        filename: imgInfo.filename,
                        subfolder: imgInfo.subfolder || "",
                        type: imgInfo.type || "temp"
                    });
                    this.filterWidget.loadImageFromUrl(`/view?${params.toString()}`);
                }
            };
        }
    }
});
