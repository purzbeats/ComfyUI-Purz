/**
 * Clarity Effect
 * Enhances midtone contrast for local detail
 *
 * @param u_amount - Clarity amount (-1 to 2, default: 0)
 * @param u_resolution - Image resolution (vec2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 pixel = 2.0 / u_resolution;
    vec4 blur = vec4(0.0);
    blur += texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y)) * 0.0625;
    blur += texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)) * 0.125;
    blur += texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y)) * 0.0625;
    blur += texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)) * 0.125;
    blur += texture2D(u_image, v_texCoord) * 0.25;
    blur += texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)) * 0.125;
    blur += texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y)) * 0.0625;
    blur += texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)) * 0.125;
    blur += texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y)) * 0.0625;
    // High-pass filter for midtone contrast
    vec3 highPass = color.rgb - blur.rgb;
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float midMask = 1.0 - abs(lum - 0.5) * 2.0;
    vec3 adjusted = color.rgb + highPass * u_amount * midMask;
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
