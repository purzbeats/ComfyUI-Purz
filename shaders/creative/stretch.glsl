/**
 * Stretch Effect
 * Stretches image horizontally or vertically
 *
 * @param u_stretchX - Horizontal stretch (-1 to 1, default: 0)
 * @param u_stretchY - Vertical stretch (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_stretchX;
uniform float u_stretchY;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    vec2 centered = uv - 0.5;

    // Apply non-linear stretch
    float stretchFactorX = 1.0;
    float stretchFactorY = 1.0;

    if (u_stretchX != 0.0) {
        float absX = abs(centered.x) * 2.0;
        if (u_stretchX > 0.0) {
            stretchFactorX = 1.0 - absX * absX * u_stretchX * 0.5;
        } else {
            stretchFactorX = 1.0 + absX * absX * (-u_stretchX) * 0.5;
        }
    }

    if (u_stretchY != 0.0) {
        float absY = abs(centered.y) * 2.0;
        if (u_stretchY > 0.0) {
            stretchFactorY = 1.0 - absY * absY * u_stretchY * 0.5;
        } else {
            stretchFactorY = 1.0 + absY * absY * (-u_stretchY) * 0.5;
        }
    }

    vec2 stretchUV = vec2(
        centered.x * stretchFactorX + 0.5,
        centered.y * stretchFactorY + 0.5
    );

    stretchUV = clamp(stretchUV, 0.0, 1.0);
    vec4 stretched = texture2D(u_image, stretchUV);

    vec3 result = mix(original.rgb, stretched.rgb, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
