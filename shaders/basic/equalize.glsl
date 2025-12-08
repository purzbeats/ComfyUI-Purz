/**
 * Equalize Effect
 * Redistributes brightness levels for more even distribution
 *
 * @param u_amount - Equalization strength (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    // S-curve equalization
    float eq = lum < 0.5
        ? 2.0 * lum * lum
        : 1.0 - 2.0 * (1.0 - lum) * (1.0 - lum);
    float newLum = mix(lum, eq, u_amount);
    float scale = lum > 0.001 ? newLum / lum : 1.0;
    vec3 adjusted = color.rgb * scale;
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
