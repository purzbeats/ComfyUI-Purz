/**
 * Mosaic Effect
 * Creates tile mosaic with grout lines
 *
 * @param u_tileSize - Tile size in pixels (5 to 50, default: 15)
 * @param u_groutWidth - Grout line width (0 to 3, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_tileSize;
uniform float u_groutWidth;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 pixelCoord = uv * u_resolution;

    // Calculate tile position
    vec2 tileCoord = floor(pixelCoord / u_tileSize);
    vec2 tileUV = (tileCoord + 0.5) * u_tileSize / u_resolution;

    // Sample tile color from center
    vec4 tileColor = texture2D(u_image, tileUV);

    // Grout lines
    vec2 withinTile = mod(pixelCoord, u_tileSize);
    float grout = 0.0;
    if (withinTile.x < u_groutWidth || withinTile.y < u_groutWidth) {
        grout = 1.0;
    }

    // Slight color variation per tile for realistic look
    float variation = fract(sin(dot(tileCoord, vec2(12.9898, 78.233))) * 43758.5453);
    tileColor.rgb = tileColor.rgb * (0.95 + variation * 0.1);

    // Add slight bevel effect
    float bevel = 1.0;
    if (withinTile.x < u_groutWidth + 1.0 || withinTile.y < u_groutWidth + 1.0) {
        bevel = 0.9;
    }
    if (withinTile.x > u_tileSize - 2.0 || withinTile.y > u_tileSize - 2.0) {
        bevel = 1.1;
    }

    vec3 mosaic = grout > 0.5 ? vec3(0.3) : tileColor.rgb * bevel;
    mosaic = clamp(mosaic, 0.0, 1.0);

    vec4 original = texture2D(u_image, uv);
    vec3 result = mix(original.rgb, mosaic, u_opacity);

    gl_FragColor = vec4(result, original.a);
}
