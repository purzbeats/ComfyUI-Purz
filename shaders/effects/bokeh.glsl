/**
 * Bokeh Effect
 * Simulates out-of-focus highlight bokeh
 *
 * @param u_threshold - Brightness threshold (0.5 to 1, default: 0.8)
 * @param u_size - Bokeh size (1 to 20, default: 8)
 * @param u_intensity - Effect intensity (0 to 2, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_size;
uniform float u_intensity;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution;

    // Extract bright areas for bokeh
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Hexagonal bokeh sampling
    vec3 bokeh = vec3(0.0);
    float count = 0.0;

    for (float angle = 0.0; angle < 6.28; angle += 0.5) {
        for (float r = 1.0; r <= 3.0; r += 1.0) {
            vec2 offset = vec2(cos(angle), sin(angle)) * r * texelSize * u_size;
            vec4 sample = texture2D(u_image, v_texCoord + offset);
            float sampleLuma = dot(sample.rgb, vec3(0.299, 0.587, 0.114));

            // Only include bright samples
            float weight = smoothstep(u_threshold - 0.1, u_threshold + 0.1, sampleLuma);
            bokeh += sample.rgb * weight;
            count += weight;
        }
    }

    bokeh = count > 0.0 ? bokeh / count : color.rgb;

    // Blend based on brightness threshold
    float blend = smoothstep(u_threshold - 0.2, u_threshold, luma);
    vec3 result = mix(color.rgb, bokeh * u_intensity, blend * u_opacity);

    gl_FragColor = vec4(result, color.a);
}
