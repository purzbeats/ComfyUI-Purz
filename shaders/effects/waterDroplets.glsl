/**
 * Water Droplets Effect
 * Simulates water droplets on lens/glass
 *
 * @param u_density - Droplet density (0 to 1, default: 0.3)
 * @param u_size - Droplet size (0.5 to 5, default: 2)
 * @param u_distortion - Refraction amount (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_density;
uniform float u_size;
uniform float u_distortion;
uniform float u_seed;
uniform float u_opacity;
varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p + u_seed * 0.1, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 uv = v_texCoord;
    vec4 color = texture2D(u_image, uv);

    vec2 distortedUV = uv;
    float dropMask = 0.0;

    // Grid-based droplets
    vec2 cellSize = vec2(8.0, 8.0) / u_size;
    vec2 cell = floor(uv * cellSize);

    for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
        for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
            vec2 neighborCell = cell + vec2(dx, dy);
            float cellRand = hash(neighborCell);

            if (cellRand < u_density) {
                vec2 dropCenter = (neighborCell + vec2(hash(neighborCell + 1.0), hash(neighborCell + 2.0))) / cellSize;
                float dropSize = (0.5 + hash(neighborCell + 3.0) * 0.5) * u_size / cellSize.x;

                vec2 toCenter = uv - dropCenter;
                float dist = length(toCenter);

                if (dist < dropSize) {
                    float normalizedDist = dist / dropSize;
                    float drop = 1.0 - normalizedDist * normalizedDist;

                    // Refraction distortion
                    vec2 normal = normalize(toCenter);
                    distortedUV += normal * drop * u_distortion * 0.05;

                    dropMask = max(dropMask, drop);
                }
            }
        }
    }

    vec4 distortedColor = texture2D(u_image, distortedUV);

    // Add specular highlight to drops
    vec3 withHighlight = distortedColor.rgb + vec3(dropMask * 0.2);

    vec3 result = mix(color.rgb, withHighlight, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
