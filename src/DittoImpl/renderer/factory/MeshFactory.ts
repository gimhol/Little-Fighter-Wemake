import { BufferGeometry, Mesh, MeshBasicMaterial } from "../../_t";
import { get_static_plane_geometry } from "../GeometryKeeper";
import { BLACK } from "../materials/OutlineMaterial";
import { InstFactory, type Kind } from "../../../LFW/base/InstFactory";
import { MaterialFactory, MaterialKind } from "./MaterialFactory";
import { OutlineMesh } from "../meshs/OutlineMesh";
export enum MeshKind {
  Invalid = 0,
  Blood = 'Blood',
  Entity = 'Entity',
}
export const MeshFactory = new class _MeshFactory extends InstFactory<Mesh> {
  readonly TAG = 'MeshFactory';
  override get_kind(inst: Mesh): Kind {
    return inst.userData.mesh_factory_kind as Kind;
  }
  override set_kind(inst: Mesh, kind: Kind): void {
    inst.userData.mesh_factory_kind = kind;
  }
}

const BLOOD_GEOMETRY = get_static_plane_geometry(1, 3, 0, -1.25);
MeshFactory.register({
  kind: MeshKind.Blood,
  cls: Mesh<BufferGeometry, MeshBasicMaterial>,
  create: () => {
    const m = MaterialFactory.get(MaterialKind.Red, MeshBasicMaterial);
    const ret = new Mesh(BLOOD_GEOMETRY, m);
    ret.position.z = 1;
    ret.visible = false;
    return ret;
  },
  reset: (c: Mesh) => { },
})


MeshFactory.register({
  kind: MeshKind.Entity,
  cls: OutlineMesh,
  create: () => {
    const ret = new OutlineMesh();
    ret.visible = false;
    return ret;
  },
  reset: (c) => {
    c.reset()
    c.visible = false;
  },
})