/**
 * Curves Effect
 * S-curve adjustment for shadows, midtones, and highlights
 *
 * @param u_shadows - Shadow curve (-1 to 1, default: 0)
 * @param u_midtones - Midtone curve (-1 to 1, default: 0)
 * @param u_highlights - Highlight curve (-1 to 1, default: 0)
 */
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
