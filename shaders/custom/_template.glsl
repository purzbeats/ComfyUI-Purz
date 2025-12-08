/**
 * Custom Effect Template
 *
 * Copy this file and rename it to create your own effect.
 * The filename (without .glsl) becomes the effect ID.
 *
 * Required uniforms (automatically provided):
 *   uniform sampler2D u_image;    - Input texture
 *   uniform float u_opacity;      - Layer opacity (0-1)
 *   varying vec2 v_texCoord;      - Texture coordinates (0-1)
 *
 * Optional uniforms (define in manifest):
 *   uniform vec2 u_resolution;    - Image dimensions (needs: resolution)
 *   uniform float u_seed;         - Random seed for animation (needs: seed)
 *   uniform float u_<paramName>;  - Custom parameters
 *
 * @param u_amount - Description of parameter (min to max, default: value)
 */
precision mediump float;
uniform sampler2D u_image;
uniform float u_amount;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    // Sample the input image
    vec4 color = texture2D(u_image, v_texCoord);

    // Apply your effect here
    vec3 adjusted = color.rgb;

    // Example: simple brightness adjustment
    adjusted = clamp(color.rgb + vec3(u_amount), 0.0, 1.0);

    // Mix with original based on opacity
    vec3 result = mix(color.rgb, adjusted, u_opacity);

    // Output final color (preserve alpha)
    gl_FragColor = vec4(result, color.a);
}
