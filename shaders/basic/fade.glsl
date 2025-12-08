/**
 * Fade Effect
 * Creates a washed-out, faded look by reducing contrast and lifting blacks
 *
 * @param u_amount - Fade intensity (0 to 1, default: 0.3)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    // Reduce contrast
    vec3 faded = mix(color.rgb, vec3(0.5), u_amount * 0.5);
    // Lift blacks
    faded = faded + vec3(u_amount * 0.15);
    // Slightly desaturate
    float gray = dot(faded, vec3(0.299, 0.587, 0.114));
    vec3 adjusted = mix(faded, vec3(gray), u_amount * 0.2);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
