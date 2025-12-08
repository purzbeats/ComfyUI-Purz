/**
 * Zone System Effect
 * Ansel Adams-inspired zone system for tonal control
 *
 * @param u_zone0 - Zone 0 (deep black) adjustment (-1 to 1, default: 0)
 * @param u_zone3 - Zone III (dark) adjustment (-1 to 1, default: 0)
 * @param u_zone5 - Zone V (middle gray) adjustment (-1 to 1, default: 0)
 * @param u_zone7 - Zone VII (light) adjustment (-1 to 1, default: 0)
 * @param u_zone10 - Zone X (pure white) adjustment (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_zone0;
uniform float u_zone3;
uniform float u_zone5;
uniform float u_zone7;
uniform float u_zone10;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Create zone weights
    float w0 = max(0.0, 1.0 - lum * 10.0);
    float w3 = max(0.0, 1.0 - abs(lum - 0.3) * 5.0);
    float w5 = max(0.0, 1.0 - abs(lum - 0.5) * 5.0);
    float w7 = max(0.0, 1.0 - abs(lum - 0.7) * 5.0);
    float w10 = max(0.0, (lum - 0.9) * 10.0);

    // Normalize weights
    float totalWeight = w0 + w3 + w5 + w7 + w10 + 0.001;

    // Calculate adjustment
    float adjustment = (u_zone0 * w0 + u_zone3 * w3 + u_zone5 * w5 +
                       u_zone7 * w7 + u_zone10 * w10) / totalWeight;

    vec3 adjusted = color.rgb + vec3(adjustment * 0.2);
    adjusted = clamp(adjusted, 0.0, 1.0);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
