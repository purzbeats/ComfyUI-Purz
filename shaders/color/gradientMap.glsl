/**
 * Gradient Map Effect
 * Maps luminance to a color gradient from shadows to highlights
 *
 * @param u_shadowR - Shadow color red (0 to 1, default: 0)
 * @param u_shadowG - Shadow color green (0 to 1, default: 0)
 * @param u_shadowB - Shadow color blue (0 to 1, default: 0.2)
 * @param u_midR - Midtone color red (0 to 1, default: 0.5)
 * @param u_midG - Midtone color green (0 to 1, default: 0.3)
 * @param u_midB - Midtone color blue (0 to 1, default: 0.4)
 * @param u_highlightR - Highlight color red (0 to 1, default: 1)
 * @param u_highlightG - Highlight color green (0 to 1, default: 0.9)
 * @param u_highlightB - Highlight color blue (0 to 1, default: 0.8)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_shadowR;
uniform float u_shadowG;
uniform float u_shadowB;
uniform float u_midR;
uniform float u_midG;
uniform float u_midB;
uniform float u_highlightR;
uniform float u_highlightG;
uniform float u_highlightB;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    vec3 shadowColor = vec3(u_shadowR, u_shadowG, u_shadowB);
    vec3 midColor = vec3(u_midR, u_midG, u_midB);
    vec3 highlightColor = vec3(u_highlightR, u_highlightG, u_highlightB);

    vec3 mapped;
    if (lum < 0.5) {
        mapped = mix(shadowColor, midColor, lum * 2.0);
    } else {
        mapped = mix(midColor, highlightColor, (lum - 0.5) * 2.0);
    }

    vec3 result = mix(color.rgb, mapped, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
