/**
 * Depth of Field Effect
 * Simulates camera depth of field blur
 *
 * @param u_focusPoint - Focus distance (0 to 1, default: 0.5)
 * @param u_focalRange - Sharp focus range (0 to 0.5, default: 0.1)
 * @param u_blurAmount - Maximum blur (0 to 20, default: 10)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_focusPoint;
uniform float u_focalRange;
uniform float u_blurAmount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);
    vec2 texelSize = 1.0 / u_resolution;

    // Distance from focus point (using Y coordinate as depth proxy)
    float depth = abs(uv.y - u_focusPoint);
    float blur = smoothstep(0.0, u_focalRange, depth) * u_blurAmount;

    // Gaussian-like blur
    vec3 sum = vec3(0.0);
    float totalWeight = 0.0;

    for (float x = -3.0; x <= 3.0; x += 1.0) {
        for (float y = -3.0; y <= 3.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize * blur;
            float weight = exp(-(x*x + y*y) / 8.0);
            sum += texture2D(u_image, uv + offset).rgb * weight;
            totalWeight += weight;
        }
    }

    vec3 blurred = sum / totalWeight;

    vec3 result = mix(original.rgb, blurred, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
