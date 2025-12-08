/**
 * Desaturate Effect
 * Converts image to grayscale based on luminance weighting
 *
 * @param u_amount - Desaturation amount (0-1, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 desaturated = mix(color.rgb, vec3(gray), u_amount);
    vec3 result = mix(color.rgb, desaturated, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
