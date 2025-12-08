/**
 * Halftone Effect
 * Creates newspaper-style dot pattern
 *
 * @param u_size - Dot size (2 to 20, default: 8)
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
    float size = max(2.0, u_size);
    vec2 pos = v_texCoord * u_resolution / size;
    vec2 center = (floor(pos) + 0.5) * size / u_resolution;
    float dist = length(fract(pos) - 0.5);
    float lum = dot(texture2D(u_image, center).rgb, vec3(0.299, 0.587, 0.114));
    float radius = sqrt(1.0 - lum) * 0.5;
    float dot = 1.0 - step(radius, dist);
    vec3 adjusted = vec3(dot);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
