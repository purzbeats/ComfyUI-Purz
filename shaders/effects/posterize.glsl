/**
 * Posterize Effect
 * Reduces color levels for poster-like effect
 *
 * @param u_levels - Number of color levels (2 to 32, default: 8)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_levels;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float levels = max(2.0, floor(u_levels));
    vec3 adjusted = floor(color.rgb * levels) / (levels - 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
