/**
 * Normalize Effect
 * Stretches color range to use full 0-1 range per pixel
 *
 * @param u_amount - Normalization strength (0 to 1, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float minC = min(color.r, min(color.g, color.b));
    float maxC = max(color.r, max(color.g, color.b));
    float range = maxC - minC;
    vec3 normalized = range > 0.001 ? (color.rgb - minC) / range : color.rgb;
    vec3 adjusted = mix(color.rgb, normalized, u_amount);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
