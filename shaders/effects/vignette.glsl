/**
 * Vignette Effect
 * Darkens image edges for focus effect
 *
 * @param u_amount - Vignette strength (0 to 2, default: 0.5)
 * @param u_softness - Edge softness (0 to 0.5, default: 0.2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_softness;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 center = v_texCoord - 0.5;
    float dist = length(center);
    float vig = 1.0 - smoothstep(0.5 - u_softness, 0.5 + u_softness * 0.5, dist * (1.0 + u_amount));
    vec3 adjusted = color.rgb * vig;
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
