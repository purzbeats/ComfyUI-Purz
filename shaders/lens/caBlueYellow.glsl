/**
 * Chromatic Aberration Blue/Yellow Effect
 * Simulates blue-yellow fringing
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
        offset = vec2(0.0, u_amount);
    }

    // Blue/Yellow split (affects RG vs B channels)
    vec2 uvBlue = uv + offset;
    vec2 uvYellow = uv - offset;

    uvBlue = clamp(uvBlue, 0.0, 1.0);
    uvYellow = clamp(uvYellow, 0.0, 1.0);

    vec3 blue = texture2D(u_image, uvBlue).rgb;
    vec3 yellow = texture2D(u_image, uvYellow).rgb;

    // Blue channel from one, RG from other
    float r_ch = yellow.r;
    float g_ch = yellow.g;
    float b_ch = blue.b;

    vec3 aberrated = vec3(r_ch, g_ch, b_ch);

    vec3 result = mix(original.rgb, aberrated, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
