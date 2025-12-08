/**
 * Local Contrast Effect
 * Enhances local contrast for more depth and dimension
 *
 * @param u_amount - Local contrast amount (-1 to 1, default: 0)
 * @param u_radius - Effect radius (1 to 20, default: 5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_amount;
uniform float u_radius;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution;

    // Sample surrounding area to get local average
    vec3 sum = vec3(0.0);
    float count = 0.0;

    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize * u_radius;
            sum += texture2D(u_image, v_texCoord + offset).rgb;
            count += 1.0;
        }
    }

    vec3 localAvg = sum / count;

    // Enhance difference from local average
    vec3 diff = color.rgb - localAvg;
    vec3 adjusted = color.rgb + diff * u_amount;
    adjusted = clamp(adjusted, 0.0, 1.0);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
