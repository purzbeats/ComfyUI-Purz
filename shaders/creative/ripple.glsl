/**
 * Ripple Effect
 * Creates concentric ripple distortion
 *
 * @param u_amplitude - Wave amplitude (0 to 0.1, default: 0.03)
 * @param u_frequency - Wave frequency (5 to 50, default: 20)
 * @param u_phase - Animation phase (0 to 10, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amplitude;
uniform float u_frequency;
uniform float u_phase;
uniform float u_opacity;
varying vec2 v_texCoord;

#define PI 3.14159265359

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = uv - 0.5;
    float r = length(centered);
    float theta = atan(centered.y, centered.x);

    // Ripple displacement
    float ripple = sin(r * u_frequency * PI * 2.0 - u_phase) * u_amplitude;

    // Dampen at edges
    ripple *= smoothstep(0.7, 0.0, r);

    // Displace radially
    vec2 displacement = normalize(centered + 0.001) * ripple;
    vec2 rippleUV = uv + displacement;

    rippleUV = clamp(rippleUV, 0.0, 1.0);
    vec4 rippled = texture2D(u_image, rippleUV);

    vec3 result = mix(original.rgb, rippled.rgb, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
