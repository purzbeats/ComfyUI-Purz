/**
 * Lens Flare Effect
 * Creates a simple lens flare effect
 *
 * @param u_intensity - Flare intensity (0 to 1, default: 0.5)
 * @param u_posX - Flare X position (0 to 1, default: 0.7)
 * @param u_posY - Flare Y position (0 to 1, default: 0.3)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_intensity;
uniform float u_posX;
uniform float u_posY;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 center = vec2(u_posX, u_posY);

    // Main flare
    float dist = length(v_texCoord - center);
    float flare = 1.0 - smoothstep(0.0, 0.3, dist);
    flare = pow(flare, 3.0);

    // Ghost flares (opposite side)
    vec2 ghost = center + (center - vec2(0.5)) * 2.0;
    float ghostDist = length(v_texCoord - ghost);
    float ghostFlare = 1.0 - smoothstep(0.0, 0.15, ghostDist);
    ghostFlare *= 0.3;

    // Ring artifact
    float ring = abs(dist - 0.2);
    ring = 1.0 - smoothstep(0.0, 0.03, ring);
    ring *= 0.2;

    // Combine flares
    float totalFlare = flare + ghostFlare + ring;

    // Color gradient (warm center, cool edges)
    vec3 flareColor = mix(vec3(1.0, 0.9, 0.7), vec3(0.6, 0.8, 1.0), dist * 2.0);

    vec3 result = color.rgb + flareColor * totalFlare * u_intensity;
    result = mix(color.rgb, result, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
