/**
 * Anamorphic Effect
 * Simulates anamorphic lens characteristics
 *
 * @param u_squeeze - Horizontal squeeze (0.5 to 2, default: 1.33)
 * @param u_flareStrength - Horizontal lens flare (0 to 1, default: 0.3)
 * @param u_aberration - Chromatic aberration (0 to 0.01, default: 0.003)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_squeeze;
uniform float u_flareStrength;
uniform float u_aberration;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec4 original = texture2D(u_image, uv);

    // Anamorphic squeeze (stretch horizontally)
    vec2 squeezeUV = vec2(
        (uv.x - 0.5) / u_squeeze + 0.5,
        uv.y
    );
    squeezeUV = clamp(squeezeUV, 0.0, 1.0);

    // Chromatic aberration (horizontal)
    float r = texture2D(u_image, squeezeUV + vec2(u_aberration, 0.0)).r;
    float g = texture2D(u_image, squeezeUV).g;
    float b = texture2D(u_image, squeezeUV - vec2(u_aberration, 0.0)).b;
    vec3 squeezed = vec3(r, g, b);

    // Horizontal lens flare for bright areas
    float luma = dot(squeezed, vec3(0.299, 0.587, 0.114));
    vec3 flare = vec3(0.0);

    if (luma > 0.7) {
        // Sample horizontally for anamorphic streak
        float flareSum = 0.0;
        for (float x = -5.0; x <= 5.0; x += 1.0) {
            vec2 flareUV = squeezeUV + vec2(x * 0.02, 0.0);
            flareUV = clamp(flareUV, 0.0, 1.0);
            float sample = dot(texture2D(u_image, flareUV).rgb, vec3(0.299, 0.587, 0.114));
            if (sample > 0.7) {
                flareSum += (sample - 0.7) / abs(x + 0.1);
            }
        }
        flare = vec3(0.4, 0.6, 1.0) * flareSum * u_flareStrength * 0.1;
    }

    vec3 anamorphic = squeezed + flare;
    anamorphic = clamp(anamorphic, 0.0, 1.0);

    vec3 result = mix(original.rgb, anamorphic, u_opacity);
    gl_FragColor = vec4(result, original.a);
}
