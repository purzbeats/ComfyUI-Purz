/**
 * RGB Curves Effect
 * Individual curve adjustments for each color channel
 *
 * @param u_redLift - Red shadows (-1 to 1, default: 0)
 * @param u_redGamma - Red midtones (-1 to 1, default: 0)
 * @param u_redGain - Red highlights (-1 to 1, default: 0)
 * @param u_greenLift - Green shadows (-1 to 1, default: 0)
 * @param u_greenGamma - Green midtones (-1 to 1, default: 0)
 * @param u_greenGain - Green highlights (-1 to 1, default: 0)
 * @param u_blueLift - Blue shadows (-1 to 1, default: 0)
 * @param u_blueGamma - Blue midtones (-1 to 1, default: 0)
 * @param u_blueGain - Blue highlights (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_redLift;
uniform float u_redGamma;
uniform float u_redGain;
uniform float u_greenLift;
uniform float u_greenGamma;
uniform float u_greenGain;
uniform float u_blueLift;
uniform float u_blueGamma;
uniform float u_blueGain;
uniform float u_opacity;
varying vec2 v_texCoord;

float applyCurve(float value, float lift, float gamma, float gain) {
    // Lift (shadows)
    value = value + lift * (1.0 - value) * 0.5;
    // Gamma (midtones)
    float g = 1.0 / max(1.0 - gamma * 0.5, 0.1);
    value = pow(max(value, 0.0), g);
    // Gain (highlights)
    value = value * (1.0 + gain * 0.5);
    return clamp(value, 0.0, 1.0);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    vec3 adjusted;
    adjusted.r = applyCurve(color.r, u_redLift, u_redGamma, u_redGain);
    adjusted.g = applyCurve(color.g, u_greenLift, u_greenGamma, u_greenGain);
    adjusted.b = applyCurve(color.b, u_blueLift, u_blueGamma, u_blueGain);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
