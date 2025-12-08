/**
 * Scratch Effect
 * Adds film scratches and marks
 *
 * @param u_density - Scratch density (0 to 1, default: 0.3)
 * @param u_intensity - Scratch visibility (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_density;
uniform float u_intensity;
uniform float u_seed;
uniform float u_opacity;
varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p + u_seed * 0.1, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    float scratch = 0.0;

    // Vertical scratches
    float x = floor(v_texCoord.x * u_resolution.x / 4.0);
    float scratchRand = hash(vec2(x, u_seed));

    if (scratchRand < u_density * 0.3) {
        float scratchX = (x + 0.5) * 4.0 / u_resolution.x;
        float dist = abs(v_texCoord.x - scratchX) * u_resolution.x;
        scratch = max(scratch, 1.0 - smoothstep(0.0, 1.5, dist));
    }

    // Random short scratches
    vec2 cell = floor(v_texCoord * 20.0);
    float cellRand = hash(cell);
    if (cellRand < u_density * 0.2) {
        float angle = hash(cell + 1.0) * 3.14;
        vec2 dir = vec2(cos(angle), sin(angle));
        vec2 cellCenter = (cell + 0.5) / 20.0;
        float lineDist = abs(dot(v_texCoord - cellCenter, vec2(-dir.y, dir.x)));
        float along = dot(v_texCoord - cellCenter, dir);
        if (abs(along) < 0.02) {
            scratch = max(scratch, (1.0 - smoothstep(0.0, 0.003, lineDist)) * 0.5);
        }
    }

    // Apply scratch (lighter marks)
    vec3 scratched = color.rgb + vec3(scratch * u_intensity);

    vec3 result = mix(color.rgb, scratched, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
