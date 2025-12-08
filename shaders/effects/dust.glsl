/**
 * Dust Effect
 * Adds dust particles and specks
 *
 * @param u_density - Dust density (0 to 1, default: 0.3)
 * @param u_size - Particle size (0.5 to 3, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_density;
uniform float u_size;
uniform float u_seed;
uniform float u_opacity;
varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p + u_seed * 0.1, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    float dust = 0.0;

    // Grid-based dust particles
    vec2 cellSize = vec2(10.0, 10.0) / u_size;
    vec2 cell = floor(v_texCoord * cellSize);

    for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
        for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
            vec2 neighborCell = cell + vec2(dx, dy);
            float cellRand = hash(neighborCell);

            if (cellRand < u_density) {
                // Random position within cell
                vec2 dustPos = (neighborCell + vec2(hash(neighborCell + 1.0), hash(neighborCell + 2.0))) / cellSize;
                float dist = length(v_texCoord - dustPos) * cellSize.x;

                // Particle size variation
                float size = 0.3 + hash(neighborCell + 3.0) * 0.7;
                float particle = 1.0 - smoothstep(0.0, size * u_size * 0.3, dist);

                // Some particles are dark, some light
                float brightness = hash(neighborCell + 4.0) > 0.5 ? 1.0 : -0.5;
                dust += particle * brightness;
            }
        }
    }

    dust = clamp(dust, -1.0, 1.0) * 0.3;

    vec3 dusted = color.rgb + vec3(dust);
    dusted = clamp(dusted, 0.0, 1.0);

    vec3 result = mix(color.rgb, dusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
