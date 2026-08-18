import { cos, round } from '../../utils/math/base';
import { CMD } from "../../defines/CMD";
import { Entity } from "../../entity";
import { UIComponent } from "./UIComponent";
/**
 * 按键的相机控制
 *
 * @export
 * @class CameraCtrl
 * @extends {UIComponent}
 */
export class CameraCtrl extends UIComponent {
  static override readonly TAGS: string[] = ["CameraCtrl"];
  auto: boolean = true;
  private _staring?: Entity;
  get staring() {
    return this._staring;
  }
  set staring(v) {
    if (v == this._staring) return;
    if (this._staring) {
      this._staring.outline_width = 1;
      this._staring.outline_color = '';
    }
    this._staring = v;
    if (this._staring) {
      this._staring.outline_color = this._staring.outline_color ?? 'rgb(255, 0, 0)';
    }
  }
  override update(dt: number): void {
    const { LR, UD } = this;
    if (!this.keys.j.is_end()) {
      this.auto = true
      if (this.keys.L.is_start()) { this.focus_lr(-1); }
      if (this.keys.R.is_start()) { this.focus_lr(+1); }
      if (this.keys.U.is_start()) { this.focus_ud(-1); }
      if (this.keys.D.is_start()) { this.focus_ud(+1); }
    } else if (!this.keys.d.is_end()) {
      this.lfw.push_cmd(CMD.DIST_CAM, ``)
      this.staring = void 0;
      this.auto = true
    } else if (LR || UD) {
      this.auto = false
      let { camera: { position: { x, y } } } = this.world;
      x += 5 * dt * LR;
      y += 5 * dt * UD;
      this.lfw.push_cmd(CMD.DIST_CAM, `${x},${y}`)
    }
    if (this._staring) {
      this._staring.outline_width = round((cos(this.world.lifetime) + 1) * 2.5);

    }
    if (this.staring && (this.staring.hp <= 0 || !this.staring.mounted))
      this.focus_lr(1)

    if (this.auto && this.staring) {
      const cam_x = this.staring.position.x - this.world.dataset.screen_w / 2
      this.lfw.push_cmd(CMD.DIST_CAM, `${cam_x}`)
    }
  }
  override on_stop(): void {
    this.lfw.push_cmd(CMD.DIST_CAM, ``)
    if (this._staring) {
      this._staring.outline_width = 1;
      this._staring.outline_color = '';
    }
  }

  focus_lr(direction: number) {
    const fighters = this.lfw.fighters.all.filter(v => v.hp > 0)
    fighters.sort((a, b) => a.position.x - b.position.x);
    if (!this.staring) {
      this.staring = fighters.at(direction < 0 ? fighters.length - 1 : 0)
    } else {
      const idx = fighters.indexOf(this.staring!)
      const len = fighters.length
      this.staring = fighters.at((idx + len + direction) % len)
    }
    this.auto = !!this.staring;
  }
  focus_ud(direction: number) {
    const fighters = this.lfw.fighters.all.filter(v => v.hp > 0)
    fighters.sort((a, b) => a.position.z - b.position.z);
    if (!this.staring) {
      this.staring = fighters.at(direction < 0 ? fighters.length - 1 : 0)
    } else {
      const idx = fighters.indexOf(this.staring!)
      const len = fighters.length
      this.staring = fighters.at((idx + len + direction) % len)
    }
    this.auto = !!this.staring;
  }
}
