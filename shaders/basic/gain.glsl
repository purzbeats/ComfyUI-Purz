/**
 * Gain Effect
 * Multiplies highlight values while preserving shadows
 *
 * @param u_amount - Gain amount (0.1 to 3, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted = pow(color.rgb, vec3(1.0 / max(u_amount, 0.01)));
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
