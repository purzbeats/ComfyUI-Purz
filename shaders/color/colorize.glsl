/**
 * Colorize Effect
 * Applies a single hue to the entire image
 *
 * @param u_hue - Target hue (0 to 1, default: 0)
 * @param u_saturation - Color saturation (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_hue;
uniform float u_saturation;
uniform float u_opacity;
varying vec2 v_texCoord;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 adjusted = hsv2rgb(vec3(u_hue, u_saturation, lum));
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
