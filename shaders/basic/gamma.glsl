/**
 * Gamma Effect
 * Applies gamma correction to the image
 *
 * @param u_amount - Gamma value (0.2 to 3, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float g = 1.0 / max(u_amount, 0.01);
    vec3 adjusted = pow(color.rgb, vec3(g));
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
