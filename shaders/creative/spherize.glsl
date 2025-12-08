/**
 * Spherize Effect
 * Wraps image around a sphere (bulge effect)
 *
 * @param u_amount - Spherize strength (-1 to 1, default: 0.5)
 * @param u_radius - Effect radius (0.1 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_radius;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = uv - 0.5;
    float r = length(centered);

    if (r < u_radius) {
        // Normalize distance
        float normalized = r / u_radius;

        // Spherize formula
        float sphereFactor;
        if (u_amount > 0.0) {
            // Bulge outward
            sphereFactor = sqrt(1.0 - normalized * normalized);
            sphereFactor = mix(normalized, sphereFactor, u_amount);
        } else {
            // Pinch inward
            sphereFactor = normalized * normalized;
            sphereFactor = mix(normalized, sphereFactor, -u_amount);
        }

        // Apply distortion
        vec2 sphereUV = centered / r * sphereFactor * u_radius + 0.5;
        sphereUV = clamp(sphereUV, 0.0, 1.0);

        vec4 spherized = texture2D(u_image, sphereUV);
        vec3 result = mix(original.rgb, spherized.rgb, u_opacity);
        gl_FragColor = vec4(result, original.a);
    } else {
        gl_FragColor = original;
    }
}
