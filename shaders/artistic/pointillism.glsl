/**
 * Pointillism Effect
 * Creates dot-based painting like Seurat
 *
 * @param u_dotSize - Dot size (2 to 15, default: 5)
 * @param u_density - Dot density (0.5 to 1, default: 0.8)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_dotSize;
uniform float u_density;
uniform float u_opacity;
varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 uv = v_texCoord;
    vec2 pixelCoord = uv * u_resolution;

    // Grid of dots
    vec2 cellCoord = floor(pixelCoord / u_dotSize);
    vec2 withinCell = mod(pixelCoord, u_dotSize) / u_dotSize - 0.5;

    // Random offset for organic feel
    vec2 offset = vec2(
        hash(cellCoord) - 0.5,
        hash(cellCoord + 100.0) - 0.5
    ) * 0.3;

    float dist = length(withinCell + offset);

    // Sample color from dot center
    vec2 sampleUV = (cellCoord + 0.5) * u_dotSize / u_resolution;
    sampleUV = clamp(sampleUV, 0.0, 1.0);
    vec4 dotColor = texture2D(u_image, sampleUV);

    // Dot radius based on luminance and density
    float luma = dot(dotColor.rgb, vec3(0.299, 0.587, 0.114));
    float radius = 0.35 * u_density * (0.5 + luma * 0.5);

    // Canvas background
    vec3 canvas = vec3(0.95, 0.93, 0.9);

    // Color dots with slight variation
    float colorVar = hash(cellCoord + 200.0);
    vec3 paintColor = dotColor.rgb;

    // Add complementary color dots for pointillist effect
    if (colorVar > 0.7) {
        paintColor = mix(paintColor, 1.0 - paintColor, 0.2);
    }

    // Boost saturation
    float paintLuma = dot(paintColor, vec3(0.299, 0.587, 0.114));
    paintColor = mix(vec3(paintLuma), paintColor, 1.3);
    paintColor = clamp(paintColor, 0.0, 1.0);

    vec3 pointillist = dist < radius ? paintColor : canvas;

    vec4 original = texture2D(u_image, uv);
    vec3 result = mix(original.rgb, pointillist, u_opacity);

    gl_FragColor = vec4(result, original.a);
}
