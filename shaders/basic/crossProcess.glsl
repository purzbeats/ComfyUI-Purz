/**
 * Cross Process Effect
 * Simulates cross-processed film with shifted colors and increased contrast
 *
 * @param u_amount - Effect intensity (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted;
    // Push reds/yellows, suppress greens, add blue to shadows
    adjusted.r = color.r + (color.r - 0.5) * u_amount * 0.5 + u_amount * 0.1;
    adjusted.g = color.g - u_amount * 0.05;
    adjusted.b = color.b + (0.5 - color.b) * u_amount * 0.3 + u_amount * 0.15;
    adjusted = clamp(adjusted, 0.0, 1.0);
    // Increase contrast
    float contrast = 1.0 + u_amount * 0.3;
    adjusted = (adjusted - 0.5) * contrast + 0.5;
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
