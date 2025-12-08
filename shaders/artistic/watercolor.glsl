/**
 * Watercolor Effect
 * Simulates watercolor painting with soft edges and color bleeding
 *
 * @param u_wetness - Paint wetness/bleeding (0 to 1, default: 0.5)
 * @param u_granulation - Paper texture granulation (0 to 1, default: 0.3)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_wetness;
uniform float u_granulation;
uniform float u_opacity;
varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 uv = v_texCoord;
    vec2 texelSize = 1.0 / u_resolution;

    // Paper granulation noise
    float grain = hash(floor(uv * u_resolution * 0.5)) * u_granulation;

    // Wet edge bleeding effect - sample in a wobbly pattern
    vec2 wobble = vec2(
        hash(uv * 100.0) - 0.5,
        hash(uv * 100.0 + 50.0) - 0.5
    ) * u_wetness * 0.02;

    // Kuwahara-like region sampling for painterly look
    vec3 sum = vec3(0.0);
    float count = 0.0;

    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize * (3.0 + u_wetness * 5.0) + wobble;
            sum += texture2D(u_image, uv + offset).rgb;
            count += 1.0;
        }
    }

    vec3 blended = sum / count;

    // Reduce saturation slightly for watercolor look
    float luma = dot(blended, vec3(0.299, 0.587, 0.114));
    blended = mix(vec3(luma), blended, 0.85);

    // Add paper grain
    blended = blended + (grain - 0.5) * 0.1;
    blended = clamp(blended, 0.0, 1.0);

    vec4 original = texture2D(u_image, uv);
    vec3 result = mix(original.rgb, blended, u_opacity);

    gl_FragColor = vec4(result, original.a);
}
