/**
 * Mirror Effect
 * Creates mirror reflections horizontally or vertically
 *
 * @param u_axis - Mirror axis: 0=horizontal, 1=vertical (0-1, default: 0)
 * @param u_position - Mirror position (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_axis;
uniform float u_position;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 mirroredUV = uv;

    if (u_axis < 0.5) {
        // Horizontal mirror (left-right)
        if (uv.x > u_position) {
            mirroredUV.x = u_position - (uv.x - u_position);
        }
    } else {
        // Vertical mirror (top-bottom)
        if (uv.y > u_position) {
            mirroredUV.y = u_position - (uv.y - u_position);
        }
    }

    mirroredUV = clamp(mirroredUV, 0.0, 1.0);
    vec4 mirrored = texture2D(u_image, mirroredUV);

    vec3 result = mix(original.rgb, mirrored.rgb, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
