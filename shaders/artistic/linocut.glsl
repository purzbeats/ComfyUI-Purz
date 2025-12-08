/**
 * Linocut Effect
 * Simulates linoleum block print with carved textures
 *
 * @param u_threshold - Cut threshold (0 to 1, default: 0.5)
 * @param u_carveWidth - Carve line width (1 to 5, default: 2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_carveWidth;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 texelSize = 1.0 / u_resolution;

    vec4 color = texture2D(u_image, uv);
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Diagonal carve lines
    vec2 pixelCoord = uv * u_resolution;
    float carve1 = mod(pixelCoord.x + pixelCoord.y, u_carveWidth * 4.0);
    float carve2 = mod(pixelCoord.x - pixelCoord.y, u_carveWidth * 4.0);

    float carvePattern = min(carve1, carve2) < u_carveWidth ? 1.0 : 0.0;

    // Threshold base
    float base = luma > u_threshold ? 1.0 : 0.0;

    // Edge detection for outlines
    float edge = 0.0;
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
            float sample = dot(texture2D(u_image, uv + vec2(x, y) * texelSize * u_carveWidth).rgb, vec3(0.299, 0.587, 0.114));
            edge += abs(sample - luma);
        }
    }
    edge /= 9.0;

    // Combine: dark areas with carve texture, edges as black
    float linocut = base;
    if (base < 0.5) {
        linocut = carvePattern * 0.3;
    }
    if (edge > 0.1) {
        linocut = 0.0;
    }

    vec3 result = mix(color.rgb, vec3(linocut), u_opacity);
    gl_FragColor = vec4(result, color.a);
}
