/**
 * Glitch Effect
 * Digital glitch/distortion effect
 *
 * @param u_amount - Glitch intensity (0 to 1, default: 0.3)
 * @param u_seed - Random seed for variation
 * @param u_resolution - Image resolution (vec2)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_seed;
uniform float u_opacity;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float rnd = random(vec2(floor(v_texCoord.y * 20.0), u_seed));
    float shift = (rnd - 0.5) * u_amount * 0.1;
    if (rnd > 0.9) shift *= 3.0;
    float r = texture2D(u_image, v_texCoord + vec2(shift, 0.0)).r;
    float g = texture2D(u_image, v_texCoord).g;
    float b = texture2D(u_image, v_texCoord - vec2(shift, 0.0)).b;
    vec3 adjusted = vec3(r, g, b);
    vec3 result = mix(color.rgb, adjusted, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
