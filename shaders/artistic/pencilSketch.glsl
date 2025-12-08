/**
 * Pencil Sketch Effect
 * Simulates pencil drawing with cross-hatching
 *
 * @param u_intensity - Sketch intensity (0 to 2, default: 1)
 * @param u_paperTone - Paper background tone (0 to 1, default: 0.95)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform float u_paperTone;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 texelSize = 1.0 / u_resolution;

    vec4 color = texture2D(u_image, uv);
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Edge detection with Sobel
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

    // Cross-hatching based on luminance
    vec2 pixelCoord = uv * u_resolution;
    float hatch1 = mod(pixelCoord.x + pixelCoord.y, 4.0) < 2.0 ? 1.0 : 0.0;
    float hatch2 = mod(pixelCoord.x - pixelCoord.y, 4.0) < 2.0 ? 1.0 : 0.0;

    float darkness = 1.0 - luma;
    float hatching = 0.0;
    if (darkness > 0.3) hatching += hatch1 * 0.3;
    if (darkness > 0.5) hatching += hatch2 * 0.3;
    if (darkness > 0.7) hatching += 0.2;

    // Combine edge and hatching
    float sketch = u_paperTone - edge * u_intensity - hatching * darkness * 0.5;
    sketch = clamp(sketch, 0.0, 1.0);

    vec3 result = mix(color.rgb, vec3(sketch), u_opacity);
    gl_FragColor = vec4(result, color.a);
}
