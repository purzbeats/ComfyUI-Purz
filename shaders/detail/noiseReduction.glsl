/**
 * Noise Reduction Effect
 * Reduces noise while preserving edge detail
 *
 * @param u_strength - Reduction strength (0 to 1, default: 0.5)
 * @param u_threshold - Edge preservation threshold (0.01 to 0.3, default: 0.1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_strength;
uniform float u_threshold;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 centerColor = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution;

    // Median-like noise reduction using weighted average
    vec3 sum = vec3(0.0);
    float totalWeight = 0.0;

    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize;
            vec4 sampleColor = texture2D(u_image, v_texCoord + offset);

            // Distance weight
            float dist = length(vec2(x, y)) / 2.83; // normalize to max distance
            float spatialWeight = exp(-dist * dist * 2.0);

            // Color similarity weight
            float colorDiff = length(sampleColor.rgb - centerColor.rgb);
            float colorWeight = colorDiff < u_threshold ? 1.0 - colorDiff / u_threshold : 0.0;

            float weight = spatialWeight * colorWeight;
            sum += sampleColor.rgb * weight;
            totalWeight += weight;
        }
    }

    vec3 denoised = totalWeight > 0.0 ? sum / totalWeight : centerColor.rgb;
    vec3 blended = mix(centerColor.rgb, denoised, u_strength);

    vec3 result = mix(centerColor.rgb, blended, u_opacity);
    gl_FragColor = vec4(result, centerColor.a);
}
