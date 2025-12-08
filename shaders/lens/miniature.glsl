/**
 * Miniature/Tilt-Shift Effect
 * Makes scenes look like miniature models
 *
 * @param u_focusY - Focus band Y position (0 to 1, default: 0.5)
 * @param u_focusWidth - Focus band width (0.05 to 0.5, default: 0.15)
 * @param u_blur - Blur strength (0 to 30, default: 15)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_focusY;
uniform float u_focusWidth;
uniform float u_blur;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);
    vec2 texelSize = 1.0 / u_resolution;

    // Distance from focus band
    float dist = abs(uv.y - u_focusY);
    float blurFactor = smoothstep(0.0, u_focusWidth, dist);
    float blur = blurFactor * blurFactor * u_blur;

    // Blur sampling
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

    // Boost saturation for toy-like effect
    float luma = dot(blurred, vec3(0.299, 0.587, 0.114));
    blurred = mix(vec3(luma), blurred, 1.2 + blurFactor * 0.3);
    blurred = clamp(blurred, 0.0, 1.0);

    vec3 result = mix(original.rgb, blurred, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
