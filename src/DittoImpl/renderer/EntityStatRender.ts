import { get_team_outline_color } from "@/LFW/base/get_team_shadow_color";
import { get_team_text_color } from "@/LFW/base/get_team_text_color";
import { is_fighter, type Entity } from "@/LFW/entity";
import { StatBarType } from "@/LFW/entity/StatBarType";
import { round } from "@/LFW/utils";
import * as T from "../_t";
import { Bar } from "./Bar";
import type { EntityRenderer } from "./EntityRenderer";
import { WorldRenderer } from "./WorldRenderer";
import { TextMesh } from "./meshs/TextMesh";

const BAR_W = 40;
const BAR_H = 3;
export const BAR_BG_W = BAR_W + 2;
const BAR_BG_H = 1 + (BAR_H + 1) * 2 + 4;
export class EntityStatRender {
  readonly owner: EntityRenderer;
  protected _reserve_mesh: TextMesh | null = null;
  protected bars_node = new T.Object3D();
  protected bars_bg: Bar;

  protected self_healing_hp_bar: Bar;
  protected hp_bar: Bar;

  protected self_healing_mp_bar: Bar;
  protected mp_bar: Bar;

  protected fall_value_bar: Bar;
  protected defend_value_bar: Bar;
  protected toughness_value_bar: Bar;

  protected _heading: boolean = false;
  protected _last_sync_lifetime = -1;

  entity: Entity;
  world_renderer: WorldRenderer;


  private get reserve_mesh(): TextMesh {
    if (this._reserve_mesh) return this._reserve_mesh;
    const ret = this._reserve_mesh = TextMesh.get()
    ret.name = `reserve_mesh_${this.entity.name}_${this.entity.id}`;
    this.world_renderer.world_node.add(ret)
    return ret
  }
  constructor(owner: EntityRenderer) {
    this.owner = owner;
    const entity = this.entity = owner.entity;
    this.world_renderer = owner.owner;
    const { lfw: lf2 } = owner.entity.world;
    this.bars_bg = new Bar(lf2, "rgb(0,0,0)", BAR_BG_W, BAR_BG_H, 0.5, 0);
    this.self_healing_hp_bar = new Bar(
      lf2,
      "rgb(111,8,31)",
      BAR_W,
      BAR_H,
      0.5,
      1,
    );
    this.hp_bar = new Bar(lf2, "rgb(255,0,0)", BAR_W, BAR_H, 0.5, 1);

    this.self_healing_mp_bar = new Bar(
      lf2,
      "rgb(31,8,111)",
      BAR_W,
      BAR_H,
      0.5,
      1,
    );
    this.mp_bar = new Bar(lf2, "rgb(0,0,255)", BAR_W, BAR_H, 0.5, 1);

    this.fall_value_bar = new Bar(lf2, "rgb(216, 115, 0)", BAR_W, 1, 0.5, 1);
    this.defend_value_bar = new Bar(lf2, "rgb(0, 122, 71)", BAR_W, 1, 0.5, 1);
    this.toughness_value_bar = new Bar(lf2, "rgba(0, 204, 255, 1)", BAR_W, 1, 0.5, 1);

    let y = -1;
    this.bars_bg.mesh.position.x = -1;
    this.bars_bg.mesh.position.y = -2;
    this.bars_node.add(this.bars_bg.mesh);

    this.self_healing_hp_bar.mesh.position.set(0, y, 0);
    this.self_healing_hp_bar.set(entity.hp, entity.hp_max);
    this.bars_node.add(this.self_healing_hp_bar.mesh);

    this.hp_bar.mesh.position.set(0, y, 0);
    this.hp_bar.set(entity.hp, entity.hp_max);
    this.bars_node.add(this.hp_bar.mesh);
    y = y - 1 - BAR_H;

    this.self_healing_mp_bar.mesh.position.set(0, y, 0);
    this.self_healing_mp_bar.set(entity.mp, entity.mp_max);
    this.bars_node.add(this.self_healing_mp_bar.mesh);

    this.mp_bar.mesh.position.set(0, y, 0);
    this.mp_bar.set(entity.mp, entity.mp_max);
    this.bars_node.add(this.mp_bar.mesh);

    y = y - 1;
    this.fall_value_bar.mesh.position.set(0, y, 0);
    this.fall_value_bar.set(entity.fall_value, entity.fall_value_max);
    this.bars_node.add(this.fall_value_bar.mesh);

    y = y - 2;
    this.defend_value_bar.mesh.position.set(0, y, 0);
    this.defend_value_bar.set(entity.defend_value, entity.defend_value_max);
    this.bars_node.add(this.defend_value_bar.mesh);

    this.toughness_value_bar.mesh.position.set(0, y, 0);
    this.toughness_value_bar.set(entity.toughness, entity.toughness_max);
    this.bars_node.add(this.toughness_value_bar.mesh);
  }

  on_mount() {
    const { entity: e } = this;
    this.world_renderer.world_node.add(
      this.bars_node
    );
    this.bars_node.visible = e.key_role
  }

  on_unmount() {
    this.bars_node.removeFromParent();
    this._reserve_mesh?.removeFromParent();
    this._reserve_mesh = null
  }
  private sync_bars(e: Entity) {
    this.self_healing_hp_bar.max = e.hp_max;
    this.hp_bar.max = e.hp_max;
    this.self_healing_hp_bar.val = e.hp_r;
    this.hp_bar.val = e.hp;
    this.self_healing_mp_bar.max = e.mp_max;
    this.mp_bar.max = e.mp_max;
    this.mp_bar.val = e.mp;
    this.fall_value_bar.val = e.fall_value;
    this.fall_value_bar.max = e.fall_value_max;
    this.defend_value_bar.val = e.defend_value;
    this.defend_value_bar.max = e.defend_value_max;
    this.toughness_value_bar.val = e.toughness;
    this.toughness_value_bar.max = e.toughness_max;
  }

  private update_reverse_text(e: Entity) {
    const { reserve } = e;
    if (!reserve) {
      this._reserve_mesh?.removeFromParent()
      this._reserve_mesh = null;
      return;
    }
    const { invisible } = e;
    if (invisible) {
      if (this._reserve_mesh) {
        this._reserve_mesh.visible = false;
      }
      return;
    }
    const { lfw: lf2, team } = e;
    const mesh = this.reserve_mesh;
    mesh.set_text(lf2, `x${reserve}`)
    mesh.visible = true;
    if (mesh.userData.team != team) {
      mesh.userData.team = team;
      mesh.fillStyle = get_team_text_color(team);
      mesh.strokeStyle = get_team_outline_color(team);
    }
  }

  private update_reverse_text_position(e: Entity) {
    const mesh = this._reserve_mesh;
    if (!mesh) return;
    const { x, y, z } = this.owner.position;
    const { frame: { centery } } = e
    mesh.position.set(x, round(y + centery + mesh.scale.y / 2), z)
  }

  render() {
    const { invisible, hp, key_role, stat_bar_type } = this.entity;
    const _is_fighter = is_fighter(this.entity)
    this.bars_node.visible = !!(stat_bar_type & StatBarType.Float) && _is_fighter && key_role && !invisible && hp > 0;
    const { lifetime } = this.entity;
    if (lifetime !== this._last_sync_lifetime) {
      this._last_sync_lifetime = lifetime;
      this.sync_bars(this.entity);
      this.update_reverse_text(this.entity);
      if (this.entity.healing) {
        const heading = (this.entity.lifetime % 8) < 4;
        if (this._heading != heading) {
          this.hp_bar.color = heading ? "rgb(255, 130, 130)" : "rgb(255,0,0)"
          this._heading = heading
        }
      } else if (this._heading) {
        this.hp_bar.color = "rgb(255,0,0)";
        this._heading = false;
      }
    }
    this.update_reverse_text_position(this.entity)
    this.update_bars_position();
  }

  update_bars_position() {
    const { frame: { centery } } = this.entity;
    const { x, y, z } = this.owner.position;
    const bar_y = round(y + BAR_BG_H + 5 + centery);
    const bar_x = round(x - BAR_BG_W / 2);
    const bar_z = round(z);
    this.bars_node.position.set(bar_x, bar_y, bar_z);
  }
}
