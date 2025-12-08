/**
 * Lens Distortion Effect
 * Barrel/pincushion lens distortion
 *
 * @param u_amount - Distortion amount (-1 to 1, negative=pincushion, positive=barrel)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 center = v_texCoord - 0.5;
    float dist = length(center);
    float distortion = 1.0 + dist * dist * u_amount;
    vec2 distorted = center * distortion + 0.5;
    vec4 adjusted = texture2D(u_image, distorted);
    if (distorted.x < 0.0 || distorted.x > 1.0 || distorted.y < 0.0 || distorted.y > 1.0) {
        adjusted = color;
    }
    vec3 result = mix(color.rgb, adjusted.rgb, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
