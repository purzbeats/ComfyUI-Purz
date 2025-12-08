/**
 * HSL Adjust Effect
 * Fine-grained control over Hue, Saturation, and Lightness
 *
 * @param u_hue - Hue rotation (-1 to 1, default: 0)
 * @param u_saturation - Saturation adjustment (-1 to 1, default: 0)
 * @param u_lightness - Lightness adjustment (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_hue;
uniform float u_saturation;
uniform float u_lightness;
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

    // Adjust HSL
    hsl.x = fract(hsl.x + u_hue);
    hsl.y = clamp(hsl.y + u_saturation, 0.0, 1.0);
    hsl.z = clamp(hsl.z + u_lightness, 0.0, 1.0);

    vec3 adjusted = hsl2rgb(hsl);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
