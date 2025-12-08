/**
 * Auto Contrast Effect
 * Automatically adjusts contrast based on image content
 *
 * @param u_amount - Strength of auto contrast (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted = (color.rgb - 0.5) * (1.0 + u_amount * 2.0) + 0.5;
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
