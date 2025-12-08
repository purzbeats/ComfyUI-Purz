/**
 * Blur Effect
 * Gaussian-style box blur
 *
 * @param u_amount - Blur radius (0 to 20, default: 5)
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
    vec2 pixel = u_amount / u_resolution;
    vec4 sum = vec4(0.0);
    sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y)) * 0.0625;
    sum += texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * 0.125;
    sum += texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y)) * 0.0625;
    sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * 0.125;
    sum += texture2D(u_image, v_texCoord) * 0.25;
    sum += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * 0.125;
    sum += texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y)) * 0.0625;
    sum += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * 0.125;
    sum += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y)) * 0.0625;
    vec3 result = mix(color.rgb, sum.rgb, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
