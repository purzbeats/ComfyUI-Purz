/**
 * Midtone Contrast Effect
 * Adjusts contrast only in midtones, preserving shadows and highlights
 *
 * @param u_amount - Contrast amount (-1 to 1, default: 0)
 * @param u_center - Midtone center (0 to 1, default: 0.5)
 * @param u_width - Midtone range (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_center;
uniform float u_width;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Calculate midtone weight - bell curve centered at u_center
    float dist = abs(lum - u_center);
    float midtoneWeight = 1.0 - smoothstep(0.0, u_width, dist);

    // Apply contrast only to midtones
    vec3 contrasted = (color.rgb - u_center) * (1.0 + u_amount) + u_center;
    vec3 adjusted = mix(color.rgb, contrasted, midtoneWeight);
    adjusted = clamp(adjusted, 0.0, 1.0);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
