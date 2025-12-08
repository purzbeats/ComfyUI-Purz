/**
 * Tone Curve Effect
 * S-curve tone adjustment for film-like contrast
 *
 * @param u_contrast - Curve intensity (-1 to 1, default: 0)
 * @param u_pivot - Curve pivot point (0 to 1, default: 0.5)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_contrast;
uniform float u_pivot;
uniform float u_opacity;
varying vec2 v_texCoord;

float sCurve(float x, float contrast, float pivot) {
    float t = (x - pivot) * 2.0;
    float c = contrast * 0.5;
    float curved = pivot + t * (1.0 + c * (1.0 - abs(t)));
    return clamp(curved, 0.0, 1.0);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);

    vec3 adjusted;
    adjusted.r = sCurve(color.r, u_contrast, u_pivot);
    adjusted.g = sCurve(color.g, u_contrast, u_pivot);
    adjusted.b = sCurve(color.b, u_contrast, u_pivot);

    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
