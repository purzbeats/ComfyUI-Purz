/**
 * Color Balance Effect
 * Adjusts color balance in shadows, midtones, and highlights
 *
 * @param u_shadowsCyan - Shadows cyan/red shift (-1 to 1, default: 0)
 * @param u_shadowsMagenta - Shadows magenta/green shift (-1 to 1, default: 0)
 * @param u_shadowsYellow - Shadows yellow/blue shift (-1 to 1, default: 0)
 * @param u_midsCyan - Midtones cyan/red shift (-1 to 1, default: 0)
 * @param u_midsMagenta - Midtones magenta/green shift (-1 to 1, default: 0)
 * @param u_midsYellow - Midtones yellow/blue shift (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_shadowsCyan;
uniform float u_shadowsMagenta;
uniform float u_shadowsYellow;
uniform float u_midsCyan;
uniform float u_midsMagenta;
uniform float u_midsYellow;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Calculate weights for shadows and midtones
    float shadowWeight = 1.0 - smoothstep(0.0, 0.5, lum);
    float midWeight = 1.0 - abs(lum - 0.5) * 2.0;

    // Apply color shifts
    vec3 adjusted = color.rgb;

    // Shadows adjustment
    adjusted.r += u_shadowsCyan * shadowWeight * 0.1;
    adjusted.g += u_shadowsMagenta * shadowWeight * 0.1;
    adjusted.b += u_shadowsYellow * shadowWeight * 0.1;

    // Midtones adjustment
    adjusted.r += u_midsCyan * midWeight * 0.15;
    adjusted.g += u_midsMagenta * midWeight * 0.15;
    adjusted.b += u_midsYellow * midWeight * 0.15;

    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
