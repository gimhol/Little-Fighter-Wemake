varying vec2 vUv;
varying vec3 vWorldPosition;
uniform float flipX;
uniform float flipY;
uniform float scaleX;
uniform float scaleY;
uniform float scaleZ;
void main() {
  vUv.x = 0.5 + flipX * (uv.x - 0.5);
  vUv.y = 0.5 + flipY * (uv.y - 0.5);

  float x = position.x * scaleX;
  float y = position.y * scaleY;
  float z = position.z * scaleZ;
  vec4 world_pos = modelMatrix * vec4(x, y, z, 1.0);
  vWorldPosition = world_pos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, z, 1.0);
}