/**
 * Offset Effect
 * Adds RGB offset values to shift color balance
 *
 * @param u_red - Red channel offset (-1 to 1, default: 0)
 * @param u_green - Green channel offset (-1 to 1, default: 0)
 * @param u_blue - Blue channel offset (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_red;
uniform float u_green;
uniform float u_blue;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted = color.rgb + vec3(u_red, u_green, u_blue);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
