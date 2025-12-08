/**
 * Tunnel Effect
 * Creates infinite tunnel zoom effect
 *
 * @param u_zoom - Tunnel zoom depth (0 to 5, default: 1)
 * @param u_twist - Tunnel twist amount (0 to 2, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_zoom;
uniform float u_twist;
uniform float u_opacity;
varying vec2 v_texCoord;

#define PI 3.14159265359

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = uv - 0.5;
    float r = length(centered);
    float theta = atan(centered.y, centered.x);

    // Tunnel mapping: inverse of radius gives depth
    float depth = 1.0 / (r + 0.001) * 0.1 * u_zoom;

    // Add twist based on depth
    theta += depth * u_twist * PI;

    // Map to texture coordinates
    vec2 tunnelUV = vec2(
        mod(theta / PI * 0.5 + 0.5, 1.0),
        mod(depth, 1.0)
    );

    vec4 tunnel = texture2D(u_image, tunnelUV);

    // Fade at center (very deep)
    float fade = smoothstep(0.0, 0.1, r);

    vec3 tunnelColor = mix(vec3(0.0), tunnel.rgb, fade);
    vec3 result = mix(original.rgb, tunnelColor, u_opacity);

    gl_FragColor = vec4(result, original.a);
}
