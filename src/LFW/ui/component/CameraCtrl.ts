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
  candidates?: () => Entity[];
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
      this.lfw.push_cmd(CMD.DIST_CAM)
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
      this._staring.outline_width = round((cos(this.world.lifetime * this.world.dataset.atom_time) + 1) * 2);

    }
    if (this.staring && (this.staring.hp <= 0 || !this.staring.mounted))
      this.focus_lr(1)

    if (this.auto && this.staring) {
      const { screen_w, screen_h } = this.world.dataset
      const { zoom_x, zoom_y } = this.world.bg
      // 可见尺寸 = screen / zoom（见 Camera.update 的 max_cam_x / cam_max_y）
      const zx = zoom_x || 1
      const zy = zoom_y || 1
      const cam_x = this.staring.position.x - screen_w / (2 * zx)
      const cam_y = -0.5 * round(this.staring.position.z) - screen_h / (2 * zy)
      this.lfw.push_cmd(CMD.DIST_CAM, `${cam_x},${cam_y}`)
    }
  }
  override on_stop(): void {
    this.lfw.push_cmd(CMD.DIST_CAM)
    if (this._staring) {
      this._staring.outline_width = 1;
      this._staring.outline_color = '';
    }
  }

  focus_lr(direction: number) {
    const fighters = (this.candidates?.() ?? this.lfw.fighters.all).filter(v => v.hp > 0)
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
