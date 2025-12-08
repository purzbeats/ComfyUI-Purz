/**
 * Contrast Effect
 * Adjusts image contrast around midpoint
 *
 * @param u_amount - Contrast adjustment (-1 to 2, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted = (color.rgb - 0.5) * (1.0 + u_amount) + 0.5;
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
