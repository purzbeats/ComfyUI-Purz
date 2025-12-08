/**
 * Shadows Effect
 * Adjusts brightness of shadow (dark) areas
 *
 * @param u_amount - Shadows adjustment (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float shadowMask = 1.0 - smoothstep(0.0, 0.5, lum);
    vec3 adjusted = color.rgb + vec3(u_amount * shadowMask);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
