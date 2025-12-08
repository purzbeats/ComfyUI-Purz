/**
 * Saturation Effect
 * Adjusts overall color saturation
 *
 * @param u_amount - Saturation adjustment (-1 to 2, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 adjusted = mix(vec3(gray), color.rgb, 1.0 + u_amount);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
