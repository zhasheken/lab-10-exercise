#version 120 

// (way more precision than a float can actually store...)
#define LOG_2 0.6931471805599453094172321214581765680755001

// start using these antialiasing values once you start (c)
#define AA 2
const int TOTAL_SAMPLES = AA * AA;

#define TRUE_MAX_ITERS 16384.0

uniform vec2 c;
uniform int MAX_ITERS;
uniform vec2 windowSizePixels;
uniform vec2 camCenterWorld;
uniform float camWorldUnitsPerPixel;

// reprojection (1d) may require extra uniforms here...
uniform vec2 oldCamCenterWorld;
uniform float oldCamWorldUnitsPerPixel;
uniform sampler2D oldFrame;
uniform bool cChanged;



// Use this to get a color from your smoothed Julia set escape times.
vec4 colorTime(float t) {
    return vec4(0.5 + 0.5 * cos(  0.1 * (t) + vec3(0.f, 0.35, 0.7)), 1.f);
}

struct EscapeTime {
    float iters;
    bool isInf;
};

// Escape time of iterating z^2 + c
EscapeTime escapeTimeSmooth(vec2 z) {
    for (int n = 1; n <= MAX_ITERS; ++n) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (length(z) > 4.0) {
            return EscapeTime(float(n) + 1.0 - log(log(length(z))) / LOG_2, false);
        }
    }
    return EscapeTime(0.0, true);
}


vec2 windowToWorld(vec2 windowCoords) {
    return camCenterWorld + (windowCoords - windowSizePixels * 0.5) * camWorldUnitsPerPixel;
}

// For reprojection
vec2 worldToOldWindow(vec2 worldCoords) {
    return (worldCoords - oldCamCenterWorld) / oldCamWorldUnitsPerPixel + windowSizePixels * 0.5;
}

// For SSAA
// Given (dx, dy) in [0, AA)^2, suppose the unit square [0, 1)^2 was cut up into AA equal
// partitions along each dimension. delta((dx, dy)) returns the center of the sub-square
// which is in the dy'th row and dx'th column (both 0-indexed).
vec2 delta(vec2 dxy) {
    return (dxy + 0.5) / float(AA);
}


void main() {
    // gl_FragColor = ... some vec4 rgba colour
    // subtract 0.5 from gl_FragCoord.xy to get the pixel's bottom left corner
    vec2 pixelCorner = gl_FragCoord.xy - 0.5;

    vec4 color = vec4(0.0);
    for (int dx = 0; dx < AA; ++dx) {
        for (int dy = 0; dy < AA; ++dy) {
            vec2 offset = delta(vec2(dx, dy));
            vec2 worldPixel = windowToWorld(pixelCorner + offset);
            float iters;

            EscapeTime escapeTime = escapeTimeSmooth(worldPixel);
            vec4 newColor;
            if (escapeTime.isInf) {
                newColor = vec4(0.0, 0.0, 0.0, 1.0); // black for points in the Julia set
                iters = float(MAX_ITERS);
            } else {
                newColor = colorTime(escapeTime.iters);
                iters = max(0.0, escapeTime.iters);
            }

            // assisted by Claude
            // Prompt: "[pasted in problem 4], please walk me through how to implement this step. Walk me through step by step and explain what each step is doing"

            vec2 oldUV = worldToOldWindow(worldPixel) / windowSizePixels;
            bool xInside = oldUV.x >= 0.0 && oldUV.x <= 1.0;
            bool yInside = oldUV.y >= 0.0 && oldUV.y <= 1.0;
            bool inOldView = xInside && yInside;

            if (inOldView) {
                float alpha = 1.0;
                if (!cChanged) {
                    alpha = sqrt(iters / TRUE_MAX_ITERS); // scale alpha based on escape time
                }
                vec4 oldColor = texture2D(oldFrame, oldUV);
                color += mix(oldColor, newColor, alpha);
            }
            else {
                color += newColor;
            }


        }
    }
    gl_FragColor = color / float(TOTAL_SAMPLES); // avg color over all samples
}
