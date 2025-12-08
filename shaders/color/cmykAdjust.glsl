/**
 * CMYK Adjust Effect
 * Adjust colors in CMYK color space
 *
 * @param u_cyan - Cyan adjustment (-1 to 1, default: 0)
 * @param u_magenta - Magenta adjustment (-1 to 1, default: 0)
 * @param u_yellow - Yellow adjustment (-1 to 1, default: 0)
 * @param u_black - Black/key adjustment (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_cyan;
uniform float u_magenta;
uniform float u_yellow;
uniform float u_black;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    // Convert RGB to CMY
    vec3 cmy = 1.0 - color.rgb;

    // Find K (black)
    float k = min(cmy.r, min(cmy.g, cmy.b));

    // Adjust CMYK values
    float newK = clamp(k + u_black * 0.3, 0.0, 1.0);
    vec3 newCmy;
    newCmy.r = clamp(cmy.r + u_cyan * 0.3, 0.0, 1.0);
    newCmy.g = clamp(cmy.g + u_magenta * 0.3, 0.0, 1.0);
    newCmy.b = clamp(cmy.b + u_yellow * 0.3, 0.0, 1.0);

    // Convert back to RGB
    vec3 adjusted = 1.0 - newCmy;
    adjusted = adjusted * (1.0 - newK * 0.5); // Apply black

    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
