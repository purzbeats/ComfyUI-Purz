/**
 * Sepia Effect
 * Applies vintage sepia tone
 *
 * @param u_amount - Sepia intensity (0 to 1, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 sepia;
    sepia.r = dot(color.rgb, vec3(0.393, 0.769, 0.189));
    sepia.g = dot(color.rgb, vec3(0.349, 0.686, 0.168));
    sepia.b = dot(color.rgb, vec3(0.272, 0.534, 0.131));
    sepia = clamp(sepia, 0.0, 1.0);
    vec3 adjusted = mix(color.rgb, sepia, u_amount);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
