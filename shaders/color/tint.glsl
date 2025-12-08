/**
 * Tint Effect
 * Adjusts magenta/green tint
 *
 * @param u_amount - Tint (-1 to 1, negative=magenta, positive=green)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted = color.rgb;
    adjusted.g = clamp(color.g + u_amount * 0.3, 0.0, 1.0);
    adjusted.r = clamp(color.r - u_amount * 0.15, 0.0, 1.0);
    adjusted.b = clamp(color.b - u_amount * 0.15, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
