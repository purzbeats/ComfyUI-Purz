/**
 * Vibrance Effect
 * Intelligently boosts saturation of less-saturated colors
 *
 * @param u_amount - Vibrance amount (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float maxC = max(color.r, max(color.g, color.b));
    float minC = min(color.r, min(color.g, color.b));
    float sat = maxC - minC;
    float amt = u_amount * (1.0 - sat);
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 adjusted = mix(vec3(gray), color.rgb, 1.0 + amt);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
