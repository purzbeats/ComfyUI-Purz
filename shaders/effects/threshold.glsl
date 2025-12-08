/**
 * Threshold Effect
 * Converts to black and white based on brightness threshold
 *
 * @param u_threshold - Brightness cutoff (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_threshold;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 adjusted = vec3(step(u_threshold, gray));
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
