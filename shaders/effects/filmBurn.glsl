/**
 * Film Burn Effect
 * Simulates overexposed film burn marks
 *
 * @param u_intensity - Burn intensity (0 to 1, default: 0.5)
 * @param u_position - Burn position (0 to 1, default: 0.2)
 * @param u_spread - Burn spread (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_intensity;
uniform float u_position;
uniform float u_spread;
uniform float u_opacity;
varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    // Create organic burn shape
    float burn = 0.0;
    vec2 burnCenter = vec2(u_position, 0.5 + (hash(vec2(u_position)) - 0.5) * 0.3);

    float dist = length(v_texCoord - burnCenter);
    float noise = hash(v_texCoord * 10.0) * 0.3;

    burn = 1.0 - smoothstep(0.0, u_spread, dist + noise);
    burn = pow(burn, 1.5);

    // Burn color progression: yellow -> orange -> white
    vec3 burnColor = vec3(1.0);
    if (burn < 0.7) {
        burnColor = mix(vec3(1.0, 0.6, 0.0), vec3(1.0, 0.9, 0.5), burn / 0.7);
    }

    // Apply burn with screen blend
    vec3 burned = 1.0 - (1.0 - color.rgb) * (1.0 - burnColor * burn * u_intensity);

    vec3 result = mix(color.rgb, burned, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
