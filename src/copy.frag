#version 120 

uniform sampler2D toCopy;

void main() {
    // (reprojection)
    gl_FragColor = texture2D(toCopy, gl_TexCoord[0].xy);
}
