/**
 * Frosted Glass Effect
 * Simulates frosted/textured glass distortion
 *
 * @param u_amount - Frost intensity (0 to 1, default: 0.5)
 * @param u_scale - Texture scale (1 to 50, default: 20)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_amount;
uniform float u_scale;
uniform float u_opacity;
varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    vec2 uv = v_texCoord;

    // Create frosted texture displacement
    vec2 noiseCoord = uv * u_scale;

    float n1 = noise(noiseCoord);
    float n2 = noise(noiseCoord + 100.0);

    vec2 displacement = vec2(n1 - 0.5, n2 - 0.5) * u_amount * 0.05;

    // Sample with displacement
    vec3 sum = vec3(0.0);
    float count = 0.0;

    // Multi-sample for blur effect
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
            vec2 offset = vec2(x, y) / u_resolution * u_amount * 3.0;
            sum += texture2D(u_image, uv + displacement + offset).rgb;
            count += 1.0;
        }
    }

    vec3 frosted = sum / count;

    vec4 original = texture2D(u_image, uv);
    vec3 result = mix(original.rgb, frosted, u_opacity);

    gl_FragColor = vec4(result, original.a);
}
