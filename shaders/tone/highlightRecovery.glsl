/**
 * Highlight Recovery Effect
 * Recovers detail in blown highlights without affecting shadows
 *
 * @param u_amount - Recovery amount (0 to 1, default: 0.5)
 * @param u_range - Highlight range (0.5 to 1, default: 0.75)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_range;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Calculate highlight weight - strongest in bright areas
    float highlightWeight = smoothstep(u_range - 0.25, 1.0, lum);

    // Pull down highlights while preserving color ratios
    float reduction = 1.0 - u_amount * highlightWeight * 0.5;
    vec3 adjusted = color.rgb * reduction;

    // Restore some detail by compressing
    vec3 compressed = 1.0 - pow(1.0 - color.rgb, vec3(1.0 + u_amount * highlightWeight));
    adjusted = mix(adjusted, compressed, highlightWeight * 0.5);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
