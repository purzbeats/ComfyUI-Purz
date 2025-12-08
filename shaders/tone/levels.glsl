/**
 * Levels Effect
 * Adjusts black point, white point, and midtones
 *
 * @param u_blackPoint - Black point (0 to 0.5, default: 0)
 * @param u_whitePoint - White point (0.5 to 1, default: 1)
 * @param u_midtones - Midtone gamma (0.1 to 3, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_blackPoint;
uniform float u_whitePoint;
uniform float u_midtones;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted = (color.rgb - u_blackPoint) / max(u_whitePoint - u_blackPoint, 0.001);
    adjusted = clamp(adjusted, 0.0, 1.0);
    adjusted = pow(adjusted, vec3(1.0 / max(u_midtones, 0.01)));
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
