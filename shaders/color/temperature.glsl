/**
 * Temperature Effect
 * Adjusts color temperature (warm/cool)
 *
 * @param u_amount - Temperature (-1 to 1, negative=cool, positive=warm)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 adjusted = color.rgb;
    adjusted.r = clamp(color.r + u_amount * 0.3, 0.0, 1.0);
    adjusted.b = clamp(color.b - u_amount * 0.3, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
