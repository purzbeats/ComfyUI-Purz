/**
 * Invert Effect
 * Inverts image colors (negative)
 *
 * @param u_amount - Inversion amount (0 to 1, default: 1)
 */
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
