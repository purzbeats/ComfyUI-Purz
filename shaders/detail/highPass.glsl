/**
 * High Pass Effect
 * Extracts high-frequency detail, useful for sharpening workflows
 *
 * @param u_radius - Filter radius (1 to 50, default: 10)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_radius;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution;

    // Box blur to get low frequency
    vec3 sum = vec3(0.0);
    float count = 0.0;
    float r = floor(u_radius / 3.0);

    for (float x = -3.0; x <= 3.0; x += 1.0) {
        for (float y = -3.0; y <= 3.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize * r;
            sum += texture2D(u_image, v_texCoord + offset).rgb;
            count += 1.0;
        }
    }

    vec3 blurred = sum / count;

    // High pass = original - blurred + 0.5
    vec3 highPass = color.rgb - blurred + 0.5;
    highPass = clamp(highPass, 0.0, 1.0);

    vec3 result = mix(color.rgb, highPass, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
