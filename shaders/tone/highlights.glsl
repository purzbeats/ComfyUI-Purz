/**
 * Highlights Effect
 * Adjusts brightness of highlight (bright) areas
 *
 * @param u_amount - Highlights adjustment (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float highlightMask = smoothstep(0.5, 1.0, lum);
    vec3 adjusted = color.rgb + vec3(u_amount * highlightMask);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
