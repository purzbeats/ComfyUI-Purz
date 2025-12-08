/**
 * Pop Art Effect
 * Bold colors and halftone dots in pop art style
 *
 * @param u_colors - Color reduction (2 to 8, default: 4)
 * @param u_dotSize - Halftone dot size (2 to 20, default: 8)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_colors;
uniform float u_dotSize;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;

    vec4 color = texture2D(u_image, uv);

    // Posterize colors
    float levels = floor(u_colors);
    vec3 posterized = floor(color.rgb * levels + 0.5) / levels;

    // Boost saturation for pop art look
    float luma = dot(posterized, vec3(0.299, 0.587, 0.114));
    posterized = mix(vec3(luma), posterized, 1.5);
    posterized = clamp(posterized, 0.0, 1.0);

    // Halftone dots
    vec2 pixelCoord = uv * u_resolution;
    vec2 cellCoord = mod(pixelCoord, u_dotSize) - u_dotSize * 0.5;
    float dist = length(cellCoord);

    // Dot size based on luminance
    float dotRadius = (1.0 - luma) * u_dotSize * 0.5;
    float dot = dist < dotRadius ? 0.0 : 1.0;

    // Blend halftone with color
    vec3 popArt = posterized * (0.7 + dot * 0.3);

    // Add bold outline
    vec2 texelSize = 1.0 / u_resolution;
    float edge = 0.0;
    float c = luma;
    float n = dot(texture2D(u_image, uv + vec2(0.0, -1.0) * texelSize * 2.0).rgb, vec3(0.299, 0.587, 0.114));
    float s = dot(texture2D(u_image, uv + vec2(0.0,  1.0) * texelSize * 2.0).rgb, vec3(0.299, 0.587, 0.114));
    float e = dot(texture2D(u_image, uv + vec2( 1.0, 0.0) * texelSize * 2.0).rgb, vec3(0.299, 0.587, 0.114));
    float w = dot(texture2D(u_image, uv + vec2(-1.0, 0.0) * texelSize * 2.0).rgb, vec3(0.299, 0.587, 0.114));
    edge = abs(c - n) + abs(c - s) + abs(c - e) + abs(c - w);

    if (edge > 0.3) {
        popArt = vec3(0.0);
    }

    vec3 result = mix(color.rgb, popArt, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
