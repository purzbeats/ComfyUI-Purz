/**
 * Micro Contrast Effect
 * Enhances fine detail contrast for added texture definition
 *
 * @param u_amount - Contrast enhancement (0 to 2, default: 0.5)
 * @param u_radius - Detail scale (1 to 10, default: 3)
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

    // Local average (small radius blur)
    vec3 sum = vec3(0.0);
    float count = 0.0;

    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize * u_radius * 0.5;
            sum += texture2D(u_image, v_texCoord + offset).rgb;
            count += 1.0;
        }
    }

    vec3 localAvg = sum / count;

    // Micro contrast = boost difference from local average
    vec3 detail = color.rgb - localAvg;
    vec3 enhanced = color.rgb + detail * u_amount;
    enhanced = clamp(enhanced, 0.0, 1.0);

    vec3 result = mix(color.rgb, enhanced, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
