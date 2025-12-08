/**
 * Tone Split Effect
 * Splits tones at a threshold for creative effects
 *
 * @param u_threshold - Split threshold (0 to 1, default: 0.5)
 * @param u_softness - Edge softness (0 to 1, default: 0.2)
 * @param u_lowShift - Lower tone shift (-1 to 1, default: 0)
 * @param u_highShift - Upper tone shift (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_threshold;
uniform float u_softness;
uniform float u_lowShift;
uniform float u_highShift;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Calculate split mask with softness
    float soft = max(u_softness, 0.01);
    float splitMask = smoothstep(u_threshold - soft, u_threshold + soft, lum);

    // Apply different shifts to low and high tones
    vec3 lowAdjusted = color.rgb + vec3(u_lowShift * 0.3);
    vec3 highAdjusted = color.rgb + vec3(u_highShift * 0.3);

    vec3 adjusted = mix(lowAdjusted, highAdjusted, splitMask);
    adjusted = clamp(adjusted, 0.0, 1.0);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
