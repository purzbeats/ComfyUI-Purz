/**
 * Tilt Shift Effect
 * Miniature/diorama effect with selective focus
 *
 * @param u_focus - Focus position (0 to 1, default: 0.5)
 * @param u_range - Focus range (0 to 0.5, default: 0.2)
 * @param u_blur - Blur amount (0 to 20, default: 10)
 * @param u_resolution - Image resolution (vec2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_focus;
uniform float u_range;
uniform float u_blur;
uniform float u_opacity;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float dist = abs(v_texCoord.y - u_focus);
    float blurAmount = smoothstep(0.0, u_range, dist) * u_blur;
    vec2 pixel = blurAmount / u_resolution;
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
