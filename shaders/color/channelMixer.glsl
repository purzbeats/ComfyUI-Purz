/**
 * Channel Mixer Effect
 * Individually adjusts RGB channels
 *
 * @param u_redShift - Red channel adjustment (-1 to 1, default: 0)
 * @param u_greenShift - Green channel adjustment (-1 to 1, default: 0)
 * @param u_blueShift - Blue channel adjustment (-1 to 1, default: 0)
 */
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
