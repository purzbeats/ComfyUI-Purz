/**
 * Pinch Effect
 * Pinches or expands from center
 *
 * @param u_amount - Pinch amount (-1 to 1, default: 0.5)
 * @param u_radius - Effect radius (0.1 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_radius;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = uv - 0.5;
    float r = length(centered);

    if (r < u_radius && r > 0.001) {
        float normalized = r / u_radius;

        // Pinch/expand based on distance
        float pinchFactor;
        if (u_amount > 0.0) {
            // Pinch toward center
            pinchFactor = pow(normalized, 1.0 + u_amount * 2.0);
        } else {
            // Expand from center
            pinchFactor = pow(normalized, 1.0 / (1.0 - u_amount * 2.0));
        }

        vec2 pinchUV = centered / r * pinchFactor * u_radius + 0.5;
        pinchUV = clamp(pinchUV, 0.0, 1.0);

        vec4 pinched = texture2D(u_image, pinchUV);
        vec3 result = mix(original.rgb, pinched.rgb, u_opacity);
        gl_FragColor = vec4(result, original.a);
    } else {
        gl_FragColor = original;
    }
}
