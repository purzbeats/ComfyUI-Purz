/**
 * Duotone Effect
 * Maps image to two-color gradient
 *
 * @param u_shadowR/G/B - Shadow color RGB (0-1 each)
 * @param u_highlightR/G/B - Highlight color RGB (0-1 each)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_shadowR;
uniform float u_shadowG;
uniform float u_shadowB;
uniform float u_highlightR;
uniform float u_highlightG;
uniform float u_highlightB;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 shadow = vec3(u_shadowR, u_shadowG, u_shadowB);
    vec3 highlight = vec3(u_highlightR, u_highlightG, u_highlightB);
    vec3 adjusted = mix(shadow, highlight, gray);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
