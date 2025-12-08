/**
 * Texture Enhance Effect
 * Brings out surface textures and fine patterns
 *
 * @param u_strength - Enhancement strength (0 to 2, default: 1)
 * @param u_scale - Texture scale (1 to 20, default: 5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_strength;
uniform float u_scale;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution * u_scale;

    // Emboss-like texture detection
    vec3 tl = texture2D(u_image, v_texCoord + vec2(-1.0, -1.0) * texelSize).rgb;
    vec3 t  = texture2D(u_image, v_texCoord + vec2( 0.0, -1.0) * texelSize).rgb;
    vec3 tr = texture2D(u_image, v_texCoord + vec2( 1.0, -1.0) * texelSize).rgb;
    vec3 l  = texture2D(u_image, v_texCoord + vec2(-1.0,  0.0) * texelSize).rgb;
    vec3 r  = texture2D(u_image, v_texCoord + vec2( 1.0,  0.0) * texelSize).rgb;
    vec3 bl = texture2D(u_image, v_texCoord + vec2(-1.0,  1.0) * texelSize).rgb;
    vec3 b  = texture2D(u_image, v_texCoord + vec2( 0.0,  1.0) * texelSize).rgb;
    vec3 br = texture2D(u_image, v_texCoord + vec2( 1.0,  1.0) * texelSize).rgb;

    // Sobel-like texture extraction
    vec3 gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    vec3 gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    vec3 texture = sqrt(gx*gx + gy*gy);

    // Blend texture back into luminance
    float textureMag = dot(texture, vec3(0.299, 0.587, 0.114));
    vec3 enhanced = color.rgb + (texture - 0.5) * u_strength * 0.5;
    enhanced = clamp(enhanced, 0.0, 1.0);

    vec3 result = mix(color.rgb, enhanced, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
