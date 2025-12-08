/**
 * Wave Distortion Effect
 * Creates sinusoidal wave distortion
 *
 * @param u_amplitudeX - Horizontal wave strength (0 to 0.1, default: 0.02)
 * @param u_amplitudeY - Vertical wave strength (0 to 0.1, default: 0.02)
 * @param u_frequencyX - Horizontal wave count (1 to 20, default: 5)
 * @param u_frequencyY - Vertical wave count (1 to 20, default: 5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amplitudeX;
uniform float u_amplitudeY;
uniform float u_frequencyX;
uniform float u_frequencyY;
uniform float u_opacity;
varying vec2 v_texCoord;

#define PI 3.14159265359

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    // Apply wave distortion
    vec2 wave = vec2(
        sin(uv.y * u_frequencyY * PI * 2.0) * u_amplitudeX,
        sin(uv.x * u_frequencyX * PI * 2.0) * u_amplitudeY
    );

    vec2 waveUV = uv + wave;
    waveUV = clamp(waveUV, 0.0, 1.0);

    vec4 waved = texture2D(u_image, waveUV);

    vec3 result = mix(original.rgb, waved.rgb, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
