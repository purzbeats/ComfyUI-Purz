/**
 * Color Harmony Effect
 * Shifts colors toward harmonious relationships
 *
 * @param u_mode - Harmony mode: 0=complementary, 0.33=triadic, 0.67=analogous, 1=split
 * @param u_strength - Effect strength (0 to 1, default: 0.5)
 * @param u_hueShift - Base hue rotation (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_mode;
uniform float u_strength;
uniform float u_hueShift;
uniform float u_opacity;
varying vec2 v_texCoord;

vec3 rgb2hsl(vec3 rgb) {
    float maxC = max(rgb.r, max(rgb.g, rgb.b));
    float minC = min(rgb.r, min(rgb.g, rgb.b));
    float l = (maxC + minC) / 2.0;
    float s = 0.0;
    float h = 0.0;
    if (maxC != minC) {
        float d = maxC - minC;
        s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
        if (maxC == rgb.r) h = (rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6.0 : 0.0);
        else if (maxC == rgb.g) h = (rgb.b - rgb.r) / d + 2.0;
        else h = (rgb.r - rgb.g) / d + 4.0;
        h /= 6.0;
    }
    return vec3(h, s, l);
}

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    vec3 rgb;
    if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
    else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
    else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
    else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
    else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + m;
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 hsl = rgb2hsl(color.rgb);

    float h = hsl.x + u_hueShift;

    // Calculate harmony target hue based on mode
    float targetHue;
    if (u_mode < 0.25) {
        // Complementary (opposite)
        targetHue = fract(h + 0.5);
    } else if (u_mode < 0.5) {
        // Triadic
        float dist = h - floor(h * 3.0) / 3.0;
        targetHue = dist < 0.167 ? floor(h * 3.0) / 3.0 : fract(floor(h * 3.0) / 3.0 + 0.333);
    } else if (u_mode < 0.75) {
        // Analogous (nearby)
        targetHue = floor(h * 12.0) / 12.0;
    } else {
        // Split complementary
        float comp = fract(h + 0.5);
        targetHue = fract(comp + (h > 0.5 ? -0.083 : 0.083));
    }

    // Blend toward harmony
    float newHue = mix(h, targetHue, u_strength * 0.5);
    hsl.x = fract(newHue);

    vec3 adjusted = hsl2rgb(hsl);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
