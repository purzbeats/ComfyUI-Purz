/**
 * HDR Tone Effect
 * Simulates HDR-like tone mapping with local contrast
 *
 * @param u_strength - HDR effect strength (0 to 1, default: 0.5)
 * @param u_detail - Local detail enhancement (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_strength;
uniform float u_detail;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Tone mapping - compress highlights, lift shadows
    float mapped = lum / (lum + 0.5);
    float lumScale = lum > 0.001 ? mapped / lum : 1.0;

    vec3 toneMapped = color.rgb * lumScale;

    // Local contrast enhancement
    float contrastBoost = 1.0 + u_detail * (0.5 - abs(lum - 0.5));
    vec3 detailed = (toneMapped - 0.5) * contrastBoost + 0.5;

    vec3 adjusted = mix(color.rgb, detailed, u_strength);
    adjusted = clamp(adjusted, 0.0, 1.0);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
