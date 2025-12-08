/**
 * Light Leak Effect
 * Simulates film light leaks and flares
 *
 * @param u_intensity - Leak intensity (0 to 1, default: 0.5)
 * @param u_position - Leak position (0 to 1, default: 0.3)
 * @param u_color - Leak warmth/coolness (-1 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform float u_position;
uniform float u_color;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    // Create leak gradient from edge
    float leak = 1.0 - length(v_texCoord - vec2(u_position, 0.5));
    leak = smoothstep(0.0, 0.8, leak);
    leak = pow(leak, 2.0);

    // Color the leak
    vec3 warmColor = vec3(1.0, 0.6, 0.2);
    vec3 coolColor = vec3(0.4, 0.6, 1.0);
    vec3 leakColor = mix(coolColor, warmColor, u_color * 0.5 + 0.5);

    // Blend with screen mode
    vec3 leaked = 1.0 - (1.0 - color.rgb) * (1.0 - leakColor * leak * u_intensity);

    vec3 result = mix(color.rgb, leaked, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
