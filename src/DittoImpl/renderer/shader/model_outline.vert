uniform float uOutline;
uniform vec3 uCenter;

void main() {
  vec3 dir = position - uCenter;
  float len = length(dir);
  vec3 offset = len > 1e-6 ? dir / len * uOutline : vec3(0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + offset, 1.0);
}
