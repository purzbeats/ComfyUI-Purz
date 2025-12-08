/**
 * Lift Effect
 * Adds brightness to shadows/dark areas while preserving highlights
 *
 * @param u_amount - Lift amount (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted = color.rgb + vec3(u_amount) * (1.0 - color.rgb);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
