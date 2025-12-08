/**
 * Smart Sharpen Effect
 * Sharpens edges while avoiding noise and halos
 *
 * @param u_amount - Sharpening amount (0 to 3, default: 1)
 * @param u_radius - Effect radius (0.5 to 5, default: 1)
 * @param u_threshold - Edge threshold (0 to 0.2, default: 0.05)
 */
precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_amount;
uniform float u_radius;
uniform float u_threshold;
uniform float u_opacity;
varying vec2 v_texCoord;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    vec2 texelSize = 1.0 / u_resolution * u_radius;

    // Sample neighbors
    vec3 n = texture2D(u_image, v_texCoord + vec2(0.0, -1.0) * texelSize).rgb;
    vec3 s = texture2D(u_image, v_texCoord + vec2(0.0, 1.0) * texelSize).rgb;
    vec3 e = texture2D(u_image, v_texCoord + vec2(1.0, 0.0) * texelSize).rgb;
    vec3 w = texture2D(u_image, v_texCoord + vec2(-1.0, 0.0) * texelSize).rgb;

    // Calculate edge strength
    vec3 laplacian = 4.0 * color.rgb - n - s - e - w;
    float edgeStrength = length(laplacian);

    // Apply threshold - don't sharpen noise
    float factor = smoothstep(u_threshold, u_threshold * 3.0, edgeStrength);

    // Smart sharpen with reduced halos
    vec3 sharpened = color.rgb + laplacian * u_amount * factor * 0.25;
    sharpened = clamp(sharpened, 0.0, 1.0);

    vec3 result = mix(color.rgb, sharpened, u_opacity);
    gl_FragColor = vec4(result, color.a);
}
