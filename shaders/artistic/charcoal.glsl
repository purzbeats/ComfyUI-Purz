/**
 * Charcoal Effect
 * Simulates charcoal drawing with smudged edges
 *
 * @param u_intensity - Charcoal darkness (0 to 2, default: 1)
 * @param u_smudge - Smudge amount (0 to 1, default: 0.3)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform float u_smudge;
uniform float u_opacity;
varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 uv = v_texCoord;
    vec2 texelSize = 1.0 / u_resolution;

    // Smudge by sampling nearby with noise
    vec2 smudgeOffset = vec2(
        hash(floor(uv * u_resolution * 0.3)) - 0.5,
        hash(floor(uv * u_resolution * 0.3) + 100.0) - 0.5
    ) * u_smudge * 0.03;

    vec4 color = texture2D(u_image, uv + smudgeOffset);
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Multi-scale edge detection for charcoal strokes
    float edge = 0.0;
    for (float s = 1.0; s <= 3.0; s += 1.0) {
        vec2 ts = texelSize * s;
        float l = dot(texture2D(u_image, uv - vec2(ts.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
        float r = dot(texture2D(u_image, uv + vec2(ts.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
        float t = dot(texture2D(u_image, uv - vec2(0.0, ts.y)).rgb, vec3(0.299, 0.587, 0.114));
        float b = dot(texture2D(u_image, uv + vec2(0.0, ts.y)).rgb, vec3(0.299, 0.587, 0.114));
        edge += abs(l - r) + abs(t - b);
    }
    edge /= 3.0;

    // Paper texture noise
    float paperNoise = hash(floor(uv * u_resolution * 2.0)) * 0.1;

    // Charcoal rendering
    float charcoal = 1.0 - luma * 0.5 - edge * u_intensity * 2.0;
    charcoal = charcoal + paperNoise - 0.05;
    charcoal = clamp(charcoal, 0.0, 1.0);

    // Slightly warm paper tone
    vec3 paperColor = vec3(0.95, 0.93, 0.9);
    vec3 charcoalResult = paperColor * charcoal;

    vec3 result = mix(color.rgb, charcoalResult, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
