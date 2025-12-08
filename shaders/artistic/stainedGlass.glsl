/**
 * Stained Glass Effect
 * Creates stained glass window appearance
 *
 * @param u_cellSize - Glass piece size (10 to 100, default: 40)
 * @param u_lineWidth - Lead line width (1 to 5, default: 2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_cellSize;
uniform float u_lineWidth;
uniform float u_opacity;
varying vec2 v_texCoord;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 uv = v_texCoord;
    vec2 pixelCoord = uv * u_resolution;

    // Create voronoi-like cells
    vec2 cellCoord = pixelCoord / u_cellSize;
    vec2 cellId = floor(cellCoord);

    float minDist = 10.0;
    vec2 nearestCell = cellId;

    // Find nearest cell center
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
            vec2 neighbor = cellId + vec2(x, y);
            vec2 cellCenter = neighbor + vec2(hash(neighbor), hash(neighbor + 100.0)) * 0.8 + 0.1;
            float dist = length(cellCoord - cellCenter);
            if (dist < minDist) {
                minDist = dist;
                nearestCell = neighbor;
            }
        }
    }

    // Sample color from cell center
    vec2 sampleUV = (nearestCell + 0.5) * u_cellSize / u_resolution;
    sampleUV = clamp(sampleUV, 0.0, 1.0);
    vec4 cellColor = texture2D(u_image, sampleUV);

    // Boost saturation for stained glass look
    float luma = dot(cellColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 saturated = mix(vec3(luma), cellColor.rgb, 1.5);
    saturated = clamp(saturated, 0.0, 1.0);

    // Add slight glow/translucency
    saturated = saturated * 0.9 + 0.1;

    // Lead lines between cells
    float lineThreshold = u_lineWidth / u_cellSize * 0.5;
    vec3 glass = minDist < lineThreshold ? vec3(0.1) : saturated;

    vec4 original = texture2D(u_image, uv);
    vec3 result = mix(original.rgb, glass, u_opacity);

    gl_FragColor = vec4(result, original.a);
}
