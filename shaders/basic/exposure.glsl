/**
 * Exposure Effect
 * Adjusts image exposure in stops (like camera exposure)
 *
 * @param u_amount - Exposure stops (-3 to 3, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted = color.rgb * pow(2.0, u_amount);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
