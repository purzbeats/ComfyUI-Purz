/**
 * CRT Scanlines Effect
 * Simulates CRT monitor scanlines and curvature
 *
 * @param u_intensity - Scanline intensity (0 to 1, default: 0.5)
 * @param u_density - Line density (100 to 1000, default: 400)
 * @param u_curvature - Screen curvature (0 to 1, default: 0.3)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform float u_density;
uniform float u_curvature;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;

    // Apply CRT curvature
    vec2 centered = uv - 0.5;
    float dist = length(centered);
    vec2 curved = centered * (1.0 + dist * dist * u_curvature * 0.5);
    uv = curved + 0.5;

    // Check bounds
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 color = texture2D(u_image, uv);

    // Scanlines
    float scanline = sin(uv.y * u_density) * 0.5 + 0.5;
    scanline = pow(scanline, 1.5);

    // RGB separation (slight chromatic aberration)
    float r = texture2D(u_image, uv + vec2(0.001 * u_curvature, 0.0)).r;
    float g = color.g;
    float b = texture2D(u_image, uv - vec2(0.001 * u_curvature, 0.0)).b;

    vec3 rgbSeparated = vec3(r, g, b);

    // Apply scanline darkening
    vec3 scanned = rgbSeparated * (1.0 - scanline * u_intensity * 0.3);

    // Vignette for CRT edges
    float vignette = 1.0 - dist * dist * u_curvature;

    vec3 result = scanned * vignette;
    result = mix(color.rgb, result, u_opacity);

    gl_FragColor = vec4(result, color.a);
}
