/**
 * Shadow Recovery Effect
 * Recovers detail in shadow areas without affecting highlights
 *
 * @param u_amount - Recovery amount (0 to 1, default: 0.5)
 * @param u_range - Shadow range (0 to 0.5, default: 0.25)
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

    // Calculate shadow weight - strongest in deep shadows
    float shadowWeight = 1.0 - smoothstep(0.0, u_range * 2.0, lum);

    // Lift shadows while preserving color
    float boost = 1.0 + u_amount * shadowWeight * 2.0;
    vec3 adjusted = color.rgb * boost;

    // Prevent clipping
    float maxVal = max(adjusted.r, max(adjusted.g, adjusted.b));
    if (maxVal > 1.0) {
        adjusted /= maxVal;
    }

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
