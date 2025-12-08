/**
 * Oil Paint Effect
 * Simulates oil painting with blur and posterization
 *
 * @param u_radius - Brush radius (1 to 10, default: 3)
 * @param u_levels - Color levels (2 to 20, default: 8)
 * @param u_resolution - Image resolution (vec2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_radius;
uniform float u_levels;
uniform float u_opacity;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 pixel = 1.0 / u_resolution;
    float levels = max(2.0, u_levels);

    // Simplified oil paint: blur + posterize
    vec3 sum = vec3(0.0);
    float total = 0.0;
    for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
            vec2 offset = vec2(float(x), float(y)) * pixel * u_radius;
            sum += texture2D(u_image, v_texCoord + offset).rgb;
            total += 1.0;
        }
    }
    vec3 blurred = sum / total;
    vec3 adjusted = floor(blurred * levels) / levels;
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
