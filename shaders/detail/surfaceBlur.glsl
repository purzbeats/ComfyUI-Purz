/**
 * Surface Blur Effect
 * Smooths surfaces while preserving edges, great for skin
 *
 * @param u_radius - Blur radius (1 to 20, default: 5)
 * @param u_threshold - Edge threshold (0.01 to 0.5, default: 0.15)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_radius;
uniform float u_threshold;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 centerColor = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution;

    vec3 sum = centerColor.rgb;
    float count = 1.0;

    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            if (x == 0.0 && y == 0.0) continue;

            vec2 offset = vec2(x, y) * texelSize * u_radius * 0.5;
            vec4 sampleColor = texture2D(u_image, v_texCoord + offset);

            // Only include samples within threshold
            float diff = length(sampleColor.rgb - centerColor.rgb);
            if (diff < u_threshold) {
                float weight = 1.0 - diff / u_threshold;
                sum += sampleColor.rgb * weight;
                count += weight;
            }
        }
    }

    vec3 blurred = sum / count;
    vec3 result = mix(centerColor.rgb, blurred, u_opacity);
    gl_FragColor = vec4(result, centerColor.a);
}
