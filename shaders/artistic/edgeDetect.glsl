/**
 * Edge Detect Effect
 * Sobel edge detection filter
 *
 * @param u_amount - Edge intensity (0 to 3, default: 1)
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
    vec4 h = vec4(0.0);
    h -= texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * 2.0;
    h += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * 2.0;
    h -= texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y));
    h -= texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y));
    h += texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y));
    h += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y));
    vec4 v = vec4(0.0);
    v -= texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * 2.0;
    v += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * 2.0;
    v -= texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y));
    v += texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y));
    v -= texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y));
    v += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y));
    vec3 edge = sqrt(h.rgb * h.rgb + v.rgb * v.rgb) * u_amount;
    edge = clamp(edge, 0.0, 1.0);
    vec3 result = mix(color.rgb, edge, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
