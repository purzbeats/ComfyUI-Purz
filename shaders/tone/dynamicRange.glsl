/**
 * Dynamic Range Effect
 * Compresses or expands the tonal range
 *
 * @param u_compression - Range compression/expansion (-1 to 1, default: 0)
 * @param u_blackPoint - Black point (0 to 0.3, default: 0)
 * @param u_whitePoint - White point (0.7 to 1, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_compression;
uniform float u_blackPoint;
uniform float u_whitePoint;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    // Remap range
    float range = u_whitePoint - u_blackPoint;
    vec3 remapped = (color.rgb - u_blackPoint) / max(range, 0.001);

    // Apply compression curve
    vec3 adjusted;
    if (u_compression > 0.0) {
        // Compress - pull extremes toward middle
        adjusted = mix(remapped, smoothstep(0.0, 1.0, remapped), u_compression);
    } else {
        // Expand - push midtones toward extremes
        vec3 expanded = remapped * remapped * (3.0 - 2.0 * remapped); // S-curve
        adjusted = mix(remapped, sign(remapped - 0.5) * pow(abs(remapped - 0.5) * 2.0, 0.5 - u_compression * 0.5) * 0.5 + 0.5, -u_compression);
    }

    adjusted = clamp(adjusted, 0.0, 1.0);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
