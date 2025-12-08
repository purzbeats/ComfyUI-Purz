/**
 * Vibrance Pro Effect
 * Advanced vibrance with per-channel control and protection
 *
 * @param u_vibrance - Overall vibrance (-1 to 1, default: 0)
 * @param u_protectSkin - Skin tone protection (0 to 1, default: 0.5)
 * @param u_satBoost - Additional saturation boost (0 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_vibrance;
uniform float u_protectSkin;
uniform float u_satBoost;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    float maxC = max(color.r, max(color.g, color.b));
    float minC = min(color.r, min(color.g, color.b));
    float sat = maxC - minC;
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Vibrance: boost less saturated colors more
    float vibranceAmt = u_vibrance * (1.0 - sat);

    // Detect skin tones (warm colors with moderate saturation)
    float skinTone = 0.0;
    if (color.r > color.g && color.g > color.b) {
        float warmth = (color.r - color.b) / max(maxC, 0.001);
        skinTone = warmth * sat * (1.0 - sat);
    }

    // Reduce effect on skin tones
    float protection = 1.0 - skinTone * u_protectSkin;
    vibranceAmt *= protection;

    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 vibrant = mix(vec3(gray), color.rgb, 1.0 + vibranceAmt);

    // Additional saturation boost
    vec3 boosted = mix(vec3(gray), vibrant, 1.0 + u_satBoost);

    vec3 adjusted = clamp(boosted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
