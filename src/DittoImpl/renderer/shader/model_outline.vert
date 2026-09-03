uniform float uOutline;

void main() {
  vec3 p = position + normal * uOutline;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
