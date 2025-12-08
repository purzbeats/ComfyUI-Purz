/**
 * Pixelate Effect
 * Creates retro pixel art look
 *
 * @param u_size - Pixel block size (1 to 50, default: 8)
 * @param u_resolution - Image resolution (vec2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_size;
uniform float u_opacity;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float size = max(1.0, u_size);
    vec2 pixelSize = size / u_resolution;
    vec2 coord = pixelSize * floor(v_texCoord / pixelSize) + pixelSize * 0.5;
    vec4 pixelated = texture2D(u_image, coord);
    vec3 result = mix(color.rgb, pixelated.rgb, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
