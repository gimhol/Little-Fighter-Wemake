import { clamp, type Entity, GameKey, GKLabels, is_bot_ctrl, type IVector3Like, round } from "@/LFW";
import { Object3D } from "three";
import * as T from "../_t";
import { BAR_BG_W } from "./EntityStatRender";
import { ENTITY_INDICATINGS } from "./INDICATINGS";
import { SmallTextMesh } from "./meshs";
import { WorldRenderer } from "./WorldRenderer";
import type { EntityRenderer } from "./EntityRenderer";

export class EntityCtrlRender {
  readonly owner: EntityRenderer;
  entity: Entity;
  world_renderer: WorldRenderer;
  protected _ctrl_node: Object3D | null = null;
  protected _ctrls: Map<GameKey | 'bot' | 'keys', SmallTextMesh> | null = null;
  constructor(owner: EntityRenderer) {
    this.owner = owner;
    this.entity = owner.entity;
    this.world_renderer = owner.owner;
  }
  get ctrl_node(): Object3D {
    if (this._ctrl_node) return this._ctrl_node;
    this._ctrl_node = new Object3D();
    this.world_renderer.world_node.add(this._ctrl_node);
    return this._ctrl_node;
  }
  get ctrls(): Map<GameKey | 'bot' | 'keys', SmallTextMesh> {
    if (this._ctrls) return this._ctrls;
    const f = 7;
    const ox = -25;
    const map = new Map<GameKey | 'bot' | 'keys', IVector3Like>([
      ['bot', new T.Vector3(ox, f * 4, 0)],
      ['keys', new T.Vector3(ox, f * 2, 0)],
      [GameKey.U, new T.Vector3(ox + f * -1.5, f * 1, 0)],
      [GameKey.D, new T.Vector3(ox + f * -1.5, f * -1, 0)],
      [GameKey.L, new T.Vector3(ox + f * -2.5, f * 0, 0)],
      [GameKey.R, new T.Vector3(ox + f * -0.5, f * 0, 0)],
      [GameKey.a, new T.Vector3(ox + f * 0.5, f * -1, 0)],
      [GameKey.j, new T.Vector3(ox + f * 1.5, f * 0, 0)],
      [GameKey.d, new T.Vector3(ox + f * 2.5, f * 1, 0)],
    ]);
    this._ctrls = new Map();

    const { lfw: lf2 } = this.entity;
    for (const [k, pos] of map) {
      const mesh = SmallTextMesh.get();
      mesh.name = `key ${k}`;
      mesh.position.set(BAR_BG_W / 2 + pos.x, 10 + pos.y, pos.z);
      if (k == 'bot') {
        mesh.set_text(lf2, ' ').catch(e => console.warn(e));
      } else if (k == 'keys') {
        mesh.set_text(lf2, ' ').catch(e => console.warn(e));
      } else {
        mesh.set_text(lf2, GKLabels[k]).catch(e => console.warn(e));
      }
      mesh.strokeStyle = 'black';
      this.ctrl_node.add(mesh);
      this._ctrls.set(k, mesh);
    }
    return this._ctrls;
  }
  on_mount() { }
  on_unmount() {
    this.clear();
  }
  clear(): void {
    this._ctrl_node?.removeFromParent();
    this._ctrl_node = null;
    this._ctrls = null;
  }
  render() {

    const { x, z, y } = this.owner.position;
    const {
      lfw: lf2, world, ctrl_visible, frame: { centery }
    } = this.entity;

    const _ctrl_visible = ctrl_visible || world.dataset.entity_flags & ENTITY_INDICATINGS.ctrl;
    if (!_ctrl_visible) {
      this.clear();
      return;
    }
    for (const [key, node] of this.ctrls) {
      node.visible = !this.entity.ctrl.is_end(key);
    }

    const hw = 40;
    const min_x = this.world_renderer.camera.position.x + hw;
    const max_x = min_x + (world.dataset.screen_w / world.transform.scale_x) - 2 * hw;
    const _x = clamp(x, min_x, max_x);
    let _y = round(25 + y - z / 2 + centery);
    const _z = round(z);

    this.ctrl_node.position.set(_x, _y, _z);


    const ctrl = this.entity.ctrl;
    const bot = this.ctrls.get('bot');
    const keys = this.ctrls.get('keys');

    if (!is_bot_ctrl(ctrl)) {
      if (keys) keys.visible = false
      if (bot) bot.visible = false
      return;
    }
    if (keys) {
      keys.visible = true
      keys.set_text(lf2, this.entity.ctrl.key_list)
    }
    if (bot) {
      bot.visible = true;
      const text = ctrl.fsm.state?.key ?? 'ERROR';
      bot.set_text(lf2, text);
    }
  }
}
