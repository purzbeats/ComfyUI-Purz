/**
 * Bilateral Filter Effect
 * Edge-preserving smoothing that keeps edges sharp
 *
 * @param u_spatialSigma - Spatial smoothing (1 to 20, default: 5)
 * @param u_rangeSigma - Range/intensity threshold (0.01 to 0.5, default: 0.1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_spatialSigma;
uniform float u_rangeSigma;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 centerColor = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution;

    vec3 sum = vec3(0.0);
    float weightSum = 0.0;

    float spatialFactor = -0.5 / (u_spatialSigma * u_spatialSigma);
    float rangeFactor = -0.5 / (u_rangeSigma * u_rangeSigma);

    for (float x = -3.0; x <= 3.0; x += 1.0) {
        for (float y = -3.0; y <= 3.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize * u_spatialSigma * 0.5;
            vec4 sampleColor = texture2D(u_image, v_texCoord + offset);

            // Spatial weight
            float spatialDist = x * x + y * y;
            float spatialWeight = exp(spatialDist * spatialFactor);

            // Range weight based on color difference
            vec3 colorDiff = sampleColor.rgb - centerColor.rgb;
            float rangeDist = dot(colorDiff, colorDiff);
            float rangeWeight = exp(rangeDist * rangeFactor * 100.0);

            float weight = spatialWeight * rangeWeight;
            sum += sampleColor.rgb * weight;
            weightSum += weight;
        }
    }

    vec3 filtered = sum / max(weightSum, 0.001);
    vec3 result = mix(centerColor.rgb, filtered, u_opacity);
    gl_FragColor = vec4(result, centerColor.a);
}
