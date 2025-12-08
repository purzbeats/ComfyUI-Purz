/**
 * Solarize Effect
 * Inverts colors above a threshold, creating a psychedelic effect
 *
 * @param u_threshold - Threshold above which colors invert (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_threshold;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted;
    adjusted.r = color.r > u_threshold ? 1.0 - color.r : color.r;
    adjusted.g = color.g > u_threshold ? 1.0 - color.g : color.g;
    adjusted.b = color.b > u_threshold ? 1.0 - color.b : color.b;
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
