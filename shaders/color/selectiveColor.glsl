/**
 * Selective Color Effect
 * Adjusts specific color ranges independently
 *
 * @param u_reds - Red adjustment (-1 to 1, default: 0)
 * @param u_yellows - Yellow adjustment (-1 to 1, default: 0)
 * @param u_greens - Green adjustment (-1 to 1, default: 0)
 * @param u_cyans - Cyan adjustment (-1 to 1, default: 0)
 * @param u_blues - Blue adjustment (-1 to 1, default: 0)
 * @param u_magentas - Magenta adjustment (-1 to 1, default: 0)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_reds;
uniform float u_yellows;
uniform float u_greens;
uniform float u_cyans;
uniform float u_blues;
uniform float u_magentas;
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

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec3 hsl = rgb2hsl(color.rgb);
    float h = hsl.x;
    float s = hsl.y;

    // Calculate color weights based on hue
    float redWeight = max(0.0, 1.0 - abs(h - 0.0) * 6.0) + max(0.0, 1.0 - abs(h - 1.0) * 6.0);
    float yellowWeight = max(0.0, 1.0 - abs(h - 0.167) * 6.0);
    float greenWeight = max(0.0, 1.0 - abs(h - 0.333) * 6.0);
    float cyanWeight = max(0.0, 1.0 - abs(h - 0.5) * 6.0);
    float blueWeight = max(0.0, 1.0 - abs(h - 0.667) * 6.0);
    float magentaWeight = max(0.0, 1.0 - abs(h - 0.833) * 6.0);

    // Apply saturation-based weighting
    redWeight *= s;
    yellowWeight *= s;
    greenWeight *= s;
    cyanWeight *= s;
    blueWeight *= s;
    magentaWeight *= s;

    // Calculate total adjustment
    float lumAdj = u_reds * redWeight + u_yellows * yellowWeight +
                   u_greens * greenWeight + u_cyans * cyanWeight +
                   u_blues * blueWeight + u_magentas * magentaWeight;

    vec3 adjusted = color.rgb + vec3(lumAdj * 0.2);
    adjusted = clamp(adjusted, 0.0, 1.0);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
