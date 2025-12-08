/**
 * Color Lookup Effect
 * Simulates film-like color grading with preset looks
 *
 * @param u_intensity - Effect intensity (0 to 1, default: 0.5)
 * @param u_warmth - Warm/cool shift (-1 to 1, default: 0)
 * @param u_tealOrange - Teal-orange color grading (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_intensity;
uniform float u_warmth;
uniform float u_tealOrange;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    vec3 adjusted = color.rgb;

    // Apply warmth
    adjusted.r += u_warmth * 0.1 * u_intensity;
    adjusted.b -= u_warmth * 0.1 * u_intensity;

    // Apply teal-orange look (orange in highlights, teal in shadows)
    float shadowMask = 1.0 - smoothstep(0.0, 0.5, lum);
    float highlightMask = smoothstep(0.5, 1.0, lum);

    // Teal in shadows
    adjusted.r -= u_tealOrange * shadowMask * 0.1 * u_intensity;
    adjusted.g += u_tealOrange * shadowMask * 0.05 * u_intensity;
    adjusted.b += u_tealOrange * shadowMask * 0.1 * u_intensity;

    // Orange in highlights
    adjusted.r += u_tealOrange * highlightMask * 0.1 * u_intensity;
    adjusted.g += u_tealOrange * highlightMask * 0.03 * u_intensity;
    adjusted.b -= u_tealOrange * highlightMask * 0.05 * u_intensity;

    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
