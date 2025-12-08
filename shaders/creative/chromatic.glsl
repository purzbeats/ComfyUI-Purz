/**
 * Chromatic Aberration Effect
 * Separates RGB channels for lens distortion look
 *
 * @param u_amount - Aberration strength (0 to 1, default: 0.3)
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
    vec2 dir = (v_texCoord - 0.5) * u_amount / u_resolution * 100.0;
    float r = texture2D(u_image, v_texCoord + dir).r;
    float g = texture2D(u_image, v_texCoord).g;
    float b = texture2D(u_image, v_texCoord - dir).b;
    vec3 adjusted = vec3(r, g, b);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
