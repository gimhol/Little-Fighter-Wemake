import type { ITransform } from "./ITransform";
import { round_float } from "./utils/math/round_float";

export class Transform implements ITransform {
  protected _x: number = 0;
  protected _y: number = 0;
  protected _z: number = 0;
  protected _scale_x: number = 1;
  protected _scale_y: number = 1;
  protected _scale_z: number = 1;
  protected _d: ITransform = {
    x: 0, y: 0, z: 0,
    scale_x: 1, scale_y: 1, scale_z: 1
  };
  get d(): ITransform { return this._d }
  get x(): number { return this._x }
  get y(): number { return this._y }
  get z(): number { return this._z }
  set x(v: number) { this._d.x = this._x = v }
  set y(v: number) { this._d.y = this._y = v }
  set z(v: number) { this._d.z = this._z = v }
  get scale_x(): number { return this._scale_x }
  get scale_y(): number { return this._scale_y }
  get scale_z(): number { return this._scale_z }
  set scale_x(v: number) { this._d.scale_x = this._scale_x = v }
  set scale_y(v: number) { this._d.scale_y = this._scale_y = v }
  set scale_z(v: number) { this._d.scale_z = this._scale_z = v }

  snapshot(): ITransform {
    const { x, y, z, scale_x, scale_y, scale_z } = this
    return { x, y, z, scale_x, scale_y, scale_z }
  }
  update(): void {
    const d = this._d
    if (d) {
      const c = this
      if (d.x !== c.x) this._x = round_float(c.x + (d.x - c.x) * 0.1, 100)
      if (d.y !== c.y) this._y = round_float(c.y + (d.y - c.y) * 0.1, 100)
      if (d.z !== c.z) this._z = round_float(c.z + (d.z - c.z) * 0.1, 100)
      if (d.scale_x !== c.scale_x) this._scale_x = round_float(c.scale_x + (d.scale_x - c.scale_x) * 0.1, 10000)
      if (d.scale_y !== c.scale_y) this._scale_y = round_float(c.scale_y + (d.scale_y - c.scale_y) * 0.1, 10000)
      if (d.scale_z !== c.scale_z) this._scale_z = round_float(c.scale_z + (d.scale_z - c.scale_z) * 0.1, 10000)
    }
  }
  move_to(x: number = this.x, y: number = this.y, z: number = this.z, smooth: boolean = false): void {
    this._d.x = x
    this._d.y = y
    this._d.z = z
    if (!smooth) {
      this._x = x;
      this._y = y;
      this._z = z;
    }
  }
  scale_to(
    x: number = this.scale_x,
    y: number = this.scale_y,
    z: number = this.scale_z,
    smooth: boolean = false
  ): void {
    this._d.scale_x = x
    this._d.scale_y = y
    this._d.scale_z = z
    if (!smooth) {
      this._scale_x = x;
      this._scale_y = y;
      this._scale_z = z;
    }
  }
}
