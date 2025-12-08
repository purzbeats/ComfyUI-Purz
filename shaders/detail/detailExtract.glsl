/**
 * Detail Extract Effect
 * Separates and enhances detail layer from base
 *
 * @param u_radius - Extraction radius (1 to 30, default: 10)
 * @param u_boost - Detail boost amount (0 to 3, default: 1)
 * @param u_mode - Output mode: 0=enhanced, 1=detail only (0 or 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_radius;
uniform float u_boost;
uniform float u_mode;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution;

    // Calculate base layer (blur)
    vec3 sum = vec3(0.0);
    float count = 0.0;
    float r = floor(u_radius / 4.0);

    for (float x = -3.0; x <= 3.0; x += 1.0) {
        for (float y = -3.0; y <= 3.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize * r;
            float weight = exp(-(x*x + y*y) / 8.0);
            sum += texture2D(u_image, v_texCoord + offset).rgb * weight;
            count += weight;
        }
    }

    vec3 base = sum / count;

    // Detail layer = original - base
    vec3 detail = color.rgb - base;

    // Enhanced = base + boosted detail
    vec3 enhanced = base + detail * (1.0 + u_boost);
    enhanced = clamp(enhanced, 0.0, 1.0);

    // Detail only (centered at 0.5)
    vec3 detailOnly = detail * u_boost + 0.5;
    detailOnly = clamp(detailOnly, 0.0, 1.0);

    vec3 output = mix(enhanced, detailOnly, u_mode);
    vec3 result = mix(color.rgb, output, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
