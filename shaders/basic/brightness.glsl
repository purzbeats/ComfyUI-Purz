/**
 * Brightness Effect
 * Adjusts overall image brightness
 *
 * @param u_amount - Brightness adjustment (-1 to 1, default: 0)
 */
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
