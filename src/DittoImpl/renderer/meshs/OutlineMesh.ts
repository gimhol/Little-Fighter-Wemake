import { Mesh, BufferGeometry } from "three";
import { OutlineMaterial } from "../materials";
import { MaterialFactory, MaterialKind } from "../factory/MaterialFactory";
import { get_static_plane_geometry } from "../GeometryKeeper";

export class OutlineMesh extends Mesh<BufferGeometry, OutlineMaterial> {
  static GEOMETRY = get_static_plane_geometry(1, 1, 0.5, -0.5);
  constructor() {
    super(OutlineMesh.GEOMETRY, MaterialFactory.get(MaterialKind.Outline, OutlineMaterial));
  }
  reset() {
    this.geometry = OutlineMesh.GEOMETRY;
    this.material.reset();
  }
}
