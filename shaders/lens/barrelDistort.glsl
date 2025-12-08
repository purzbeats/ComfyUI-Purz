/**
 * Barrel Distortion Effect
 * Creates barrel (convex) lens distortion
 *
 * @param u_amount - Distortion amount (0 to 1, default: 0.3)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = (uv - 0.5) * 2.0;
    float r = length(centered);
    float theta = atan(centered.y, centered.x);

    // Barrel distortion formula
    float distortedR = r * (1.0 + u_amount * r * r);

    vec2 distortedUV = vec2(
        cos(theta) * distortedR * 0.5 + 0.5,
        sin(theta) * distortedR * 0.5 + 0.5
    );

    if (distortedUV.x < 0.0 || distortedUV.x > 1.0 || distortedUV.y < 0.0 || distortedUV.y > 1.0) {
        vec3 result = mix(original.rgb, vec3(0.0), u_opacity);
        gl_FragColor = vec4(result, original.a);
    } else {
        vec4 distorted = texture2D(u_image, distortedUV);
        vec3 result = mix(original.rgb, distorted.rgb, u_opacity);
        gl_FragColor = vec4(result, original.a);
    }
}
