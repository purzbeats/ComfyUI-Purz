/**
 * Fisheye Effect
 * Creates fisheye lens distortion
 *
 * @param u_amount - Fisheye strength (0 to 2, default: 0.5)
 * @param u_zoom - Zoom level (0.5 to 2, default: 1)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_zoom;
uniform float u_opacity;
varying vec2 v_texCoord;

#define PI 3.14159265359

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = (uv - 0.5) * 2.0;
    float r = length(centered);
    float theta = atan(centered.y, centered.x);

    // Fisheye distortion
    float distortedR = r;
    if (u_amount > 0.0) {
        // Barrel distortion (true fisheye)
        distortedR = atan(r * u_amount * PI * 0.5) / (u_amount * PI * 0.5);
    }

    // Apply zoom
    distortedR *= u_zoom;

    // Convert back to cartesian
    vec2 fisheyeUV = vec2(
        cos(theta) * distortedR * 0.5 + 0.5,
        sin(theta) * distortedR * 0.5 + 0.5
    );

    // Check bounds for circular mask effect
    if (fisheyeUV.x < 0.0 || fisheyeUV.x > 1.0 || fisheyeUV.y < 0.0 || fisheyeUV.y > 1.0) {
        // Outside bounds - show black or edge
        vec3 result = mix(original.rgb, vec3(0.0), u_opacity);
        gl_FragColor = vec4(result, original.a);
    } else {
        vec4 fisheyed = texture2D(u_image, fisheyeUV);
        vec3 result = mix(original.rgb, fisheyed.rgb, u_opacity);
        gl_FragColor = vec4(result, original.a);
    }
}
