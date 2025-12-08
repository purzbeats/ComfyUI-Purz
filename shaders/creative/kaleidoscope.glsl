/**
 * Kaleidoscope Effect
 * Creates kaleidoscope pattern with multiple reflections
 *
 * @param u_segments - Number of segments (2 to 16, default: 6)
 * @param u_rotation - Pattern rotation (0 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_segments;
uniform float u_rotation;
uniform float u_opacity;
varying vec2 v_texCoord;

#define PI 3.14159265359

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    // Center coordinates
    vec2 centered = uv - 0.5;

    // Convert to polar
    float r = length(centered) * 2.0;
    float theta = atan(centered.y, centered.x);

    // Add rotation
    theta += u_rotation * PI * 2.0;

    // Kaleidoscope reflection
    float segmentAngle = PI * 2.0 / u_segments;
    theta = mod(theta, segmentAngle);

    // Mirror within segment
    if (theta > segmentAngle * 0.5) {
        theta = segmentAngle - theta;
    }

    // Convert back to cartesian
    vec2 kaleidoUV = vec2(
        cos(theta) * r * 0.5 + 0.5,
        sin(theta) * r * 0.5 + 0.5
    );

    kaleidoUV = clamp(kaleidoUV, 0.0, 1.0);
    vec4 kaleido = texture2D(u_image, kaleidoUV);

    vec3 result = mix(original.rgb, kaleido.rgb, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
