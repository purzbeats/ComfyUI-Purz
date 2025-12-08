/**
 * Unsharp Mask Effect
 * Professional sharpening with threshold control
 *
 * @param u_amount - Sharpening amount (0 to 3, default: 1)
 * @param u_threshold - Edge threshold (0 to 0.5, default: 0.1)
 * @param u_resolution - Image resolution (vec2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_threshold;
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
    vec3 diff = color.rgb - blur.rgb;
    float mask = step(u_threshold, length(diff));
    vec3 sharpened = color.rgb + diff * u_amount * mask;
    sharpened = clamp(sharpened, 0.0, 1.0);
    vec3 result = mix(color.rgb, sharpened, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
