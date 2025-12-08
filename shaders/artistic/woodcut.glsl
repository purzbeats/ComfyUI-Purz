/**
 * Woodcut Effect
 * Simulates woodblock print with bold lines
 *
 * @param u_threshold - Black/white threshold (0 to 1, default: 0.5)
 * @param u_lineWeight - Line thickness (0.5 to 3, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_lineWeight;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 texelSize = 1.0 / u_resolution;

    vec4 color = texture2D(u_image, uv);
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Strong edge detection
    float edge = 0.0;
    float ts = u_lineWeight;

    float c = luma;
    float l = dot(texture2D(u_image, uv + vec2(-ts, 0.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float r = dot(texture2D(u_image, uv + vec2( ts, 0.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float t = dot(texture2D(u_image, uv + vec2(0.0, -ts) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float b = dot(texture2D(u_image, uv + vec2(0.0,  ts) * texelSize).rgb, vec3(0.299, 0.587, 0.114));

    edge = abs(l - r) + abs(t - b);
    edge = edge * 2.0;

    // Threshold to black/white with edges
    float woodcut = luma > u_threshold ? 1.0 : 0.0;

    // Add edge lines
    if (edge > 0.2) {
        woodcut = 0.0;
    }

    // Woodgrain texture lines
    vec2 pixelCoord = uv * u_resolution;
    float grain = sin(pixelCoord.x * 0.5 + pixelCoord.y * 0.2) * 0.5 + 0.5;
    if (woodcut < 0.5 && grain > 0.7) {
        woodcut = min(woodcut + 0.1, 1.0);
    }

    vec3 result = mix(color.rgb, vec3(woodcut), u_opacity);
    gl_FragColor = vec4(result, color.a);
}
