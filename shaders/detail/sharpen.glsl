/**
 * Sharpen Effect
 * Enhances edge contrast for sharpening
 *
 * @param u_amount - Sharpen amount (0 to 2, default: 0.5)
 * @param u_resolution - Image resolution (vec2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 pixel = 1.0 / u_resolution;
    vec4 sum = vec4(0.0);
    sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * -1.0;
    sum += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * -1.0;
    sum += texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * -1.0;
    sum += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * -1.0;
    sum += texture2D(u_image, v_texCoord) * 5.0;
    vec3 sharpened = mix(color.rgb, sum.rgb, u_amount);
    sharpened = clamp(sharpened, 0.0, 1.0);
    vec3 result = mix(color.rgb, sharpened, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
