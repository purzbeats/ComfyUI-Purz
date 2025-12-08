/**
 * Mustache Distortion Effect
 * Complex distortion: barrel in center, pincushion at edges
 *
 * @param u_barrel - Barrel component (0 to 1, default: 0.2)
 * @param u_pincushion - Pincushion component (0 to 1, default: 0.1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_barrel;
uniform float u_pincushion;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = (uv - 0.5) * 2.0;
    float r = length(centered);
    float r2 = r * r;
    float r4 = r2 * r2;
    float theta = atan(centered.y, centered.x);

    // Mustache distortion: combination of barrel (r^2) and pincushion (r^4)
    float distortedR = r * (1.0 + u_barrel * r2 - u_pincushion * r4);

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
