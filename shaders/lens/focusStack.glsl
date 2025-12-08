/**
 * Focus Stack Effect
 * Simulates focus stacking with enhanced depth sharpness
 *
 * @param u_sharpness - Overall sharpness boost (0 to 2, default: 1)
 * @param u_depthAware - Depth-aware sharpening (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_sharpness;
uniform float u_depthAware;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 color = texture2D(u_image, uv);
    vec2 texelSize = 1.0 / u_resolution;

    // Multi-scale sharpening
    vec3 sharpened = color.rgb;

    // Fine detail sharpening
    vec3 blur1 = vec3(0.0);
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
            blur1 += texture2D(u_image, uv + vec2(x, y) * texelSize).rgb;
        }
    }
    blur1 /= 9.0;
    vec3 detail1 = color.rgb - blur1;

    // Medium detail sharpening
    vec3 blur2 = vec3(0.0);
    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            blur2 += texture2D(u_image, uv + vec2(x, y) * texelSize * 2.0).rgb;
        }
    }
    blur2 /= 25.0;
    vec3 detail2 = color.rgb - blur2;

    // Combine details with depth awareness
    float depthFactor = 1.0 - abs(uv.y - 0.5) * 2.0 * u_depthAware;
    sharpened = color.rgb + detail1 * u_sharpness * depthFactor + detail2 * u_sharpness * 0.5 * depthFactor;
    sharpened = clamp(sharpened, 0.0, 1.0);

    vec3 result = mix(color.rgb, sharpened, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
