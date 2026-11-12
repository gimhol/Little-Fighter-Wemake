import type { Entity } from "../../entity/Entity";

export interface IWorldRenderer {
  add_entity(entity: Entity): void;
  del_entity(entity: Entity): void;
  render(dt: number): void;
  dispose(): void;
  set_render_resolution?(w: number, h: number): void;
}
