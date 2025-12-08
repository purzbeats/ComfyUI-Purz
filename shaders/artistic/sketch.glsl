/**
 * Sketch Effect
 * Pencil sketch look using inverted edge detection
 *
 * @param u_amount - Sketch intensity (1 to 10, default: 4)
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
    vec2 pixel = 1.0 / u_resolution;
    // Sobel edge detection
    float tl = dot(texture2D(u_image, v_texCoord + vec2(-pixel.x, -pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float t  = dot(texture2D(u_image, v_texCoord + vec2(0.0, -pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(texture2D(u_image, v_texCoord + vec2(pixel.x, -pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float l  = dot(texture2D(u_image, v_texCoord + vec2(-pixel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float r  = dot(texture2D(u_image, v_texCoord + vec2(pixel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(texture2D(u_image, v_texCoord + vec2(-pixel.x, pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float b  = dot(texture2D(u_image, v_texCoord + vec2(0.0, pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(texture2D(u_image, v_texCoord + vec2(pixel.x, pixel.y)).rgb, vec3(0.299, 0.587, 0.114));
    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    float edge = 1.0 - sqrt(gx*gx + gy*gy) * u_amount;
    edge = clamp(edge, 0.0, 1.0);
    vec3 result = mix(color.rgb, vec3(edge), u_opacity);
    gl_FragColor = vec4(result, color.a);
}
