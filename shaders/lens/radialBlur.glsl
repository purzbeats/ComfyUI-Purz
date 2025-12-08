/**
 * Radial Blur Effect
 * Zoom blur emanating from center
 *
 * @param u_amount - Blur intensity (0 to 1, default: 0.3)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 center = v_texCoord - 0.5;
    vec4 sum = vec4(0.0);
    float samples = 10.0;
    for (float i = 0.0; i < 10.0; i++) {
        float scale = 1.0 - u_amount * 0.02 * i;
        sum += texture2D(u_image, center * scale + 0.5);
    }
    sum /= samples;
    vec3 result = mix(color.rgb, sum.rgb, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
