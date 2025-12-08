/**
 * Emboss Effect
 * Creates raised/embossed appearance
 *
 * @param u_amount - Emboss strength (0 to 4, default: 2)
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
    vec4 tl = texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y));
    vec4 br = texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y));
    vec3 embossed = vec3(0.5) + (br.rgb - tl.rgb) * u_amount;
    embossed = clamp(embossed, 0.0, 1.0);
    vec3 result = mix(color.rgb, embossed, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
