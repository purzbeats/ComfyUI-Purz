/**
 * Dehaze Effect
 * Reduces haze by increasing contrast and saturation
 *
 * @param u_amount - Dehaze amount (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    // Simple dehaze: increase contrast and saturation in low-contrast areas
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 adjusted = (color.rgb - 0.5) * (1.0 + u_amount * 0.5) + 0.5;
    // Boost saturation slightly
    adjusted = mix(vec3(gray), adjusted, 1.0 + u_amount * 0.3);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
