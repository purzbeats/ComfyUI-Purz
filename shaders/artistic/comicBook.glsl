/**
 * Comic Book Effect
 * Bold outlines and flat colors like comic art
 *
 * @param u_edgeThickness - Outline thickness (1 to 5, default: 2)
 * @param u_colorLevels - Color quantization (2 to 8, default: 5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_edgeThickness;
uniform float u_colorLevels;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 texelSize = 1.0 / u_resolution * u_edgeThickness;

    vec4 color = texture2D(u_image, uv);

    // Quantize colors
    float levels = floor(u_colorLevels);
    vec3 quantized = floor(color.rgb * levels + 0.5) / levels;

    // Boost saturation
    float luma = dot(quantized, vec3(0.299, 0.587, 0.114));
    quantized = mix(vec3(luma), quantized, 1.3);
    quantized = clamp(quantized, 0.0, 1.0);

    // Edge detection (Sobel)
    float tl = dot(texture2D(u_image, uv + vec2(-1.0, -1.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float t  = dot(texture2D(u_image, uv + vec2( 0.0, -1.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(texture2D(u_image, uv + vec2( 1.0, -1.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float l  = dot(texture2D(u_image, uv + vec2(-1.0,  0.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float r  = dot(texture2D(u_image, uv + vec2( 1.0,  0.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(texture2D(u_image, uv + vec2(-1.0,  1.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float b  = dot(texture2D(u_image, uv + vec2( 0.0,  1.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(texture2D(u_image, uv + vec2( 1.0,  1.0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));

    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    float edge = sqrt(gx*gx + gy*gy);

    // Apply black outline
    vec3 comic = edge > 0.2 ? vec3(0.0) : quantized;

    vec3 result = mix(color.rgb, comic, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
