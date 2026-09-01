import type { ITransform } from "./ITransform";
import { round_float } from "./utils/math/round_float";

export interface ITransformTweenOpts {
  /** 每帧(60fps基准)靠近目标的比例，越小越慢，默认 0.1 */
  rate?: number;
}

/** 将角度归一到 [-PI, PI) */
const wrap_angle = (a: number): number => {
  let r = a % (Math.PI * 2)
  if (r > Math.PI) r -= Math.PI * 2
  else if (r < -Math.PI) r += Math.PI * 2
  return r
}

export class Transform implements ITransform {
  protected _x: number = 0;
  protected _y: number = 0;
  protected _z: number = 0;
  protected _scale_x: number = 1;
  protected _scale_y: number = 1;
  protected _scale_z: number = 1;
  protected _rotation: number = 0;
  protected _d: ITransform = {
    x: 0, y: 0, z: 0,
    rotation: 0,
    scale_x: 1, scale_y: 1, scale_z: 1
  };
  protected _rate: number = 0.1;
  protected _smoothing: boolean = false;
  get d(): ITransform { return this._d }
  get is_smoothing(): boolean { return this._smoothing }
  get x(): number { return this._x }
  get y(): number { return this._y }
  get z(): number { return this._z }
  set x(v: number) { this._d.x = this._x = v }
  set y(v: number) { this._d.y = this._y = v }
  set z(v: number) { this._d.z = this._z = v }
  get rotation(): number { return this._rotation }
  set rotation(v: number) { this._d.rotation = this._rotation = wrap_angle(v) }
  get scale_x(): number { return this._scale_x }
  get scale_y(): number { return this._scale_y }
  get scale_z(): number { return this._scale_z }
  set scale_x(v: number) { this._d.scale_x = this._scale_x = v }
  set scale_y(v: number) { this._d.scale_y = this._scale_y = v }
  set scale_z(v: number) { this._d.scale_z = this._scale_z = v }

  snapshot(): ITransform {
    const { x, y, z, rotation, scale_x, scale_y, scale_z } = this
    return { x, y, z, rotation, scale_x, scale_y, scale_z }
  }
  update(dt: number = 1): this {
    const d = this._d
    if (!this._smoothing) return this
    const c = this
    const k = 1 - Math.pow(1 - this._rate, dt)
    this._x = round_float(c.x + (d.x - c.x) * k, 100)
    this._y = round_float(c.y + (d.y - c.y) * k, 100)
    this._z = round_float(c.z + (d.z - c.z) * k, 100)
    this._rotation = wrap_angle(c.rotation + wrap_angle(d.rotation - c.rotation) * k)
    this._scale_x = round_float(c.scale_x + (d.scale_x - c.scale_x) * k, 10000)
    this._scale_y = round_float(c.scale_y + (d.scale_y - c.scale_y) * k, 10000)
    this._scale_z = round_float(c.scale_z + (d.scale_z - c.scale_z) * k, 10000)
    if (this.is_arrived()) {
      this._x = d.x
      this._y = d.y
      this._z = d.z
      this._rotation = d.rotation
      this._scale_x = d.scale_x
      this._scale_y = d.scale_y
      this._scale_z = d.scale_z
      this._smoothing = false
    }
    return this
  }

  /** 立即设置位置（替代原来的 move_to(..., false)） */
  set_position(x: number = this.x, y: number = this.y, z: number = this.z): this {
    this._d.x = this._x = x
    this._d.y = this._y = y
    this._d.z = this._z = z
    this._smoothing = false
    return this
  }

  /** 立即设置缩放（替代原来的 scale_to(..., false)） */
  set_scale(x: number = this.scale_x, y: number = this.scale_y, z: number = this.scale_z): this {
    this._d.scale_x = this._scale_x = x
    this._d.scale_y = this._scale_y = y
    this._d.scale_z = this._scale_z = z
    this._smoothing = false
    return this
  }

  /** 立即设置旋转（弧度，绕 z 轴） */
  set_rotation(rotation: number = this.rotation): this {
    this._d.rotation = this._rotation = wrap_angle(rotation)
    this._smoothing = false
    return this
  }

  /** 平滑移动到目标 */
  move_to(x: number = this.x, y: number = this.y, z: number = this.z, opts: ITransformTweenOpts = {}): this {
    this._d.x = x
    this._d.y = y
    this._d.z = z
    this._rate = opts.rate ?? 0.1
    this._smoothing = true
    return this
  }

  /** 平滑缩放到目标 */
  scale_to(
    x: number = this.scale_x,
    y: number = this.scale_y,
    z: number = this.scale_z,
    opts: ITransformTweenOpts = {}
  ): this {
    this._d.scale_x = x
    this._d.scale_y = y
    this._d.scale_z = z
    this._rate = opts.rate ?? 0.1
    this._smoothing = true
    return this
  }

  /** 平滑旋转到目标（弧度，绕 z 轴，自动走短弧） */
  rotate_to(rotation: number = this.rotation, opts: ITransformTweenOpts = {}): this {
    this._d.rotation = wrap_angle(rotation)
    this._rate = opts.rate ?? 0.1
    this._smoothing = true
    return this
  }

  is_arrived(eps: number = 0.01): boolean {
    const d = this._d
    return Math.abs(this._x - d.x) < eps
      && Math.abs(this._y - d.y) < eps
      && Math.abs(this._z - d.z) < eps
      && Math.abs(wrap_angle(this._rotation - d.rotation)) < eps
      && Math.abs(this._scale_x - d.scale_x) < eps
      && Math.abs(this._scale_y - d.scale_y) < eps
      && Math.abs(this._scale_z - d.scale_z) < eps
  }
}
