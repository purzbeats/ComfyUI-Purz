/**
 * Grain Effect
 * Adds film-like grain noise
 *
 * @param u_amount - Grain intensity (0 to 0.5, default: 0.1)
 * @param u_size - Grain size (1 to 500, default: 100)
 * @param u_seed - Random seed for animation
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_size;
uniform float u_opacity;
uniform float u_seed;
varying vec2 v_texCoord;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 st = v_texCoord * u_size + u_seed;
    float noise = random(st) * 2.0 - 1.0;
    vec3 adjusted = color.rgb + vec3(noise * u_amount);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
