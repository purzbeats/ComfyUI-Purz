/**
 * Heat Distortion Effect
 * Simulates heat wave/mirage distortion
 *
 * @param u_amount - Distortion strength (0 to 1, default: 0.3)
 * @param u_frequency - Wave frequency (1 to 20, default: 10)
 * @param u_speed - Animation offset (0 to 10, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_amount;
uniform float u_frequency;
uniform float u_speed;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;

    // Heat rises from bottom, stronger distortion lower
    float heightFactor = 1.0 - uv.y;
    heightFactor = heightFactor * heightFactor;

    // Wave distortion
    float wave1 = sin(uv.y * u_frequency * 6.28 + u_speed) * 0.5 + 0.5;
    float wave2 = sin(uv.y * u_frequency * 0.7 * 6.28 + u_speed * 1.3 + 1.0) * 0.5 + 0.5;

    float distortX = (wave1 * 0.6 + wave2 * 0.4 - 0.5) * u_amount * 0.02 * heightFactor;
    float distortY = sin(uv.x * u_frequency * 6.28 + u_speed * 0.5) * u_amount * 0.005 * heightFactor;

    vec2 distortedUV = uv + vec2(distortX, distortY);

    // Clamp to image bounds
    distortedUV = clamp(distortedUV, 0.0, 1.0);

    vec4 distorted = texture2D(u_image, distortedUV);
    vec4 original = texture2D(u_image, uv);

    vec3 result = mix(original.rgb, distorted.rgb, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
