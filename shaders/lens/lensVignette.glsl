/**
 * Lens Vignette Effect
 * Realistic optical vignetting with falloff control
 *
 * @param u_amount - Vignette strength (0 to 2, default: 0.5)
 * @param u_falloff - Falloff curve (1 to 4, default: 2)
 * @param u_roundness - Shape roundness (0.5 to 2, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_falloff;
uniform float u_roundness;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 color = texture2D(u_image, uv);

    // Calculate distance from center with roundness
    vec2 centered = (uv - 0.5) * 2.0;
    centered.x *= u_roundness;
    float r = length(centered);

    // Vignette falloff
    float vignette = 1.0 - pow(r * 0.707, u_falloff) * u_amount;
    vignette = clamp(vignette, 0.0, 1.0);

    // Optical vignette also slightly shifts color (redder in corners)
    vec3 vignetted = color.rgb * vignette;

    // Add subtle warmth in vignetted areas
    float warmth = (1.0 - vignette) * 0.1;
    vignetted.r += warmth;
    vignetted.b -= warmth * 0.5;
    vignetted = clamp(vignetted, 0.0, 1.0);

    vec3 result = mix(color.rgb, vignetted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
