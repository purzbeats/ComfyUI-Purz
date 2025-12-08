/**
 * Twirl Effect
 * Creates spiral twist distortion
 *
 * @param u_angle - Twist angle (-3 to 3, default: 1)
 * @param u_radius - Effect radius (0.1 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_angle;
uniform float u_radius;
uniform float u_opacity;
varying vec2 v_texCoord;

#define PI 3.14159265359

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = uv - 0.5;
    float r = length(centered);
    float theta = atan(centered.y, centered.x);

    // Twirl amount decreases with distance from center
    float twistAmount = 1.0 - smoothstep(0.0, u_radius, r);
    theta += twistAmount * u_angle * PI;

    // Convert back to cartesian
    vec2 twirlUV = vec2(
        cos(theta) * r + 0.5,
        sin(theta) * r + 0.5
    );

    twirlUV = clamp(twirlUV, 0.0, 1.0);
    vec4 twirled = texture2D(u_image, twirlUV);

    vec3 result = mix(original.rgb, twirled.rgb, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
