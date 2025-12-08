/**
 * Split Tone Effect
 * Applies different color tints to shadows and highlights
 *
 * @param u_shadowHue - Shadow tint hue (0 to 1, default: 0.6)
 * @param u_shadowSat - Shadow tint saturation (0 to 1, default: 0.3)
 * @param u_highlightHue - Highlight tint hue (0 to 1, default: 0.1)
 * @param u_highlightSat - Highlight tint saturation (0 to 1, default: 0.3)
 * @param u_balance - Balance between shadows and highlights (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_shadowHue;
uniform float u_shadowSat;
uniform float u_highlightHue;
uniform float u_highlightSat;
uniform float u_balance;
uniform float u_opacity;
varying vec2 v_texCoord;

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    vec3 rgb;
    if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
    else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
    else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
    else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
    else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + m;
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Create shadow and highlight tints
    vec3 shadowTint = hsl2rgb(vec3(u_shadowHue, u_shadowSat, 0.5));
    vec3 highlightTint = hsl2rgb(vec3(u_highlightHue, u_highlightSat, 0.5));

    // Calculate blend weights with balance adjustment
    float shadowWeight = (1.0 - lum) * (1.0 - u_balance * 0.5);
    float highlightWeight = lum * (1.0 + u_balance * 0.5);

    // Apply tints
    vec3 tinted = color.rgb;
    tinted = mix(tinted, tinted * shadowTint * 2.0, shadowWeight * u_shadowSat);
    tinted = mix(tinted, tinted + highlightTint * 0.5, highlightWeight * u_highlightSat);

    vec3 adjusted = clamp(tinted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
