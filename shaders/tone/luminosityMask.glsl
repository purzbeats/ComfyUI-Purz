/**
 * Luminosity Mask Effect
 * Adjusts specific luminosity ranges independently
 *
 * @param u_darks - Dark areas adjustment (-1 to 1, default: 0)
 * @param u_mids - Midtone adjustment (-1 to 1, default: 0)
 * @param u_lights - Light areas adjustment (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_darks;
uniform float u_mids;
uniform float u_lights;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Create luminosity masks
    float darksMask = 1.0 - smoothstep(0.0, 0.4, lum);
    float midsMask = 1.0 - abs(lum - 0.5) * 2.5;
    midsMask = max(0.0, midsMask);
    float lightsMask = smoothstep(0.6, 1.0, lum);

    // Calculate total adjustment
    float adjustment = u_darks * darksMask + u_mids * midsMask + u_lights * lightsMask;

    vec3 adjusted = color.rgb + vec3(adjustment * 0.3);
    adjusted = clamp(adjusted, 0.0, 1.0);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
