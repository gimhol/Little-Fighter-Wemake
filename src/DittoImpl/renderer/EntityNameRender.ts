import { clamp, Entity, get_team_outline_color, get_team_text_color, round } from "@/LFW";
import { WorldRenderer } from "./WorldRenderer";
import { TextMesh } from "./meshs/TextMesh";
import type { EntityRenderer } from "./EntityRenderer";

export class EntityNameRender {
  readonly owner: EntityRenderer;
  protected _mesh: TextMesh | null = null;
  protected readonly world_renderer: WorldRenderer;
  protected entity: Entity;
  protected get mesh() {
    if (this._mesh) return this._mesh;
    const ret = this._mesh = TextMesh.get()
    ret.name = `EntityNameRender_${this.entity.name}_${this.entity.id}`;
    this.world_renderer.world_node.add(ret)
    return ret
  }
  constructor(owner: EntityRenderer) {
    this.owner = owner;
    this.entity = owner.entity;
    this.world_renderer = owner.owner;
  }
  on_mount() { }
  on_unmount() {
    this._mesh?.removeFromParent();
    this._mesh = null
  }
  render() {
    const { entity: e, world_renderer: { camera, world: { dataset: { screen_h } } } } = this;
    const { name } = e;
    if (!name) { // 无名，移除之
      this._mesh?.removeFromParent()
      this._mesh = null;
      return;
    }
    const { name_visible, invisible } = e;
    if (!name_visible || invisible) { // 不可见
      if (this._mesh) this._mesh.visible = false;
      return;
    }
    const { lfw, team, ground_y, world } = e;
    const { position } = this.owner;
    const { mesh } = this;
    mesh.set_text(lfw, name)
    mesh.visible = true;
    if (mesh.userData.team != team) {
      mesh.userData.team = team;
      mesh.fillStyle = get_team_text_color(team);
      mesh.strokeStyle = get_team_outline_color(team);
    }
    const { x: cam_x, y: cam_y } = camera.position;


    const hw = (mesh.scale.x + 10) / 2;
    const min_x = cam_x + hw;
    const max_x = min_x + (world.dataset.screen_w / world.transform.scale_x) - 2 * hw;
    const x = clamp(position.x, min_x, max_x);
    const z = position.z + 0.2;
    const y = clamp(
      ground_y - z / 2 - mesh.scale.y,
      cam_y + 10,
      cam_y + screen_h - 10
    );
    mesh.position.set(round(x), round(y), round(z));
  }

}
