import type { ITimesSnapshot } from "./ITimesSnapshot";
import { round_float } from './math/round_float';
import { floor, max, min } from "./math/base";

/**
 * 次数
 */
export class Times {
  static MIN: number = 0
  static MAX: number = Number.MAX_SAFE_INTEGER
  static LIFES: number = Number.MAX_SAFE_INTEGER
  private _value: number = Times.MIN;
  private _min: number = Times.MIN;
  private _max: number = Times.MAX;
  private _lifes: number = Times.LIFES;
  private _remains: number = Times.LIFES;
  /**
   * 当前值
   * 通过add被修改，始终有min <= value <= max 
   *
   * @type {number}
   */
  get value(): number { return this._value }
  get min(): number { return this._min }
  get max(): number { return this._max }
  set min(v: number) { this._min = floor(Number(v)) }
  set max(v: number) { this._max = floor(Number(v)) }
  set value(v: number) { this._value = floor(Number(v)) }
  get lifes(): number { return this.lifes }
  get remains(): number { return this._remains }
  get is_max(): boolean { return this._value >= this._max; }
  get is_min(): boolean { return this._value <= this._min; }
  constructor(_min: number = Times.MIN, _max: number = Times.MAX) {
    this.set_range(_min, _max)
  }
  reborn(): this {
    this._max = Times.MAX;
    this._value = this._min = Times.MIN;
    this._lifes = this._remains = Times.LIFES;
    return this
  }
  set_range(_min: number, _max: number): this {
    const a = floor(Number(_min));
    const b = floor(Number(_max))
    this._min = min(a, b);
    this._max = max(a, b);
    this._value = a;
    return this;
  }
  set_lifes(value: number = -1): this {
    this._lifes = floor(value);
    this._remains = this._lifes;
    return this;
  }
  reset(): this {
    this._value = this._min;
    this._remains = this._lifes;
    return this;
  }
  add(d: number = 1): boolean {
    if (this._remains == 0) return false;
    const v = this._value = round_float(this._value + d);
    const ret = v >= this._max;
    if (ret && this._remains > 0) --this._remains;
    if (v > this._max) this._value = this._min;
    if (v < this._min) this._value = this._max;
    return ret;
  }
  write_nums(nums: number[], i: number): void {
    nums[i] = this._value;
    nums[i + 1] = this._min;
    nums[i + 2] = this._max;
    nums[i + 3] = this._lifes;
    nums[i + 4] = this._remains;
  }
  read_nums(nums: number[], i: number): void {
    this._value = nums[i];
    this._min = nums[i + 1];
    this._max = nums[i + 2];
    this._lifes = nums[i + 3];
    this._remains = nums[i + 4];
  }
  to_snapshot(): ITimesSnapshot {
    return {
      nums: [
        this._value,
        this._min,
        this._max,
        this._lifes,
        this._remains,
      ]
    }
  }
  read_snapshot(s: ITimesSnapshot): this {
    this._value   /**/ = s.nums[0]
    this._min     /**/ = s.nums[1]
    this._max     /**/ = s.nums[2]
    this._lifes   /**/ = s.nums[3]
    this._remains /**/ = s.nums[4]
    return this;
  }
}

