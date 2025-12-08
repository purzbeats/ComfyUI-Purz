/**
 * Chromatic Aberration Red/Cyan Effect
 * Simulates red-cyan fringing at edges
 *
 * @param u_amount - Aberration strength (0 to 0.02, default: 0.005)
 * @param u_radial - Radial vs linear (0 to 1, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_radial;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = uv - 0.5;
    float r = length(centered);

    // Calculate offset direction
    vec2 offset;
    if (u_radial > 0.5) {
        // Radial: increases toward edges
        offset = normalize(centered + 0.001) * r * u_amount * 2.0;
    } else {
        // Linear: constant direction
        offset = vec2(u_amount, 0.0);
    }

    // Sample channels with offset
    float red = texture2D(u_image, uv + offset).r;
    float green = original.g;
    float blue = texture2D(u_image, uv - offset).b;

    vec3 aberrated = vec3(red, green, blue);

    vec3 result = mix(original.rgb, aberrated, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
