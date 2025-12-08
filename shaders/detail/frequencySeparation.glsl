/**
 * Frequency Separation Effect
 * Separates low and high frequency for retouching workflows
 *
 * @param u_radius - Separation radius (1 to 50, default: 15)
 * @param u_output - Output: 0=combined, 1=low freq, 2=high freq (0-2, default: 0)
 * @param u_highBoost - High frequency boost (0 to 2, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_radius;
uniform float u_output;
uniform float u_highBoost;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution;

    // Low frequency (gaussian-like blur)
    vec3 lowFreq = vec3(0.0);
    float totalWeight = 0.0;
    float r = u_radius / 5.0;

    for (float x = -4.0; x <= 4.0; x += 1.0) {
        for (float y = -4.0; y <= 4.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize * r;
            float weight = exp(-(x*x + y*y) / 8.0);
            lowFreq += texture2D(u_image, v_texCoord + offset).rgb * weight;
            totalWeight += weight;
        }
    }
    lowFreq /= totalWeight;

    // High frequency = original - low + 0.5 (linear light math)
    vec3 highFreq = color.rgb - lowFreq + 0.5;
    highFreq = clamp(highFreq, 0.0, 1.0);

    // Combined with boost
    vec3 boostedHigh = (highFreq - 0.5) * u_highBoost + 0.5;
    vec3 combined = lowFreq + boostedHigh - 0.5;
    combined = clamp(combined, 0.0, 1.0);

    // Select output based on mode
    vec3 output;
    if (u_output < 0.5) {
        output = combined;
    } else if (u_output < 1.5) {
        output = lowFreq;
    } else {
        output = highFreq;
    }

    vec3 result = mix(color.rgb, output, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
