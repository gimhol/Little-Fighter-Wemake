import { mt_cases } from "../../cases_instances";
import { floor } from "./base";
import { floor_float } from "./floor_float";

const _n: number = 624;
const _m: number = 397;
export interface IMersenneTwisterInfo {
  matrix: number,
  seed: number,
  times: number,
  index: number,
  mt: number[],
  upper_mask: number,
  lower_mask: number,
  mark: string;
}
export class MersenneTwister {
  mark: string = '';
  debugging: boolean = false;
  private _matrix: number = 0x9908B0DF;
  private _upper_mask: number = 0x80000000;
  private _lower_mask: number = 0x7FFFFFFF;
  private _mt: number[] = new Array(_n);
  private _index: number = _n + 1;
  private _seed: number = 0;
  private _times: number = 0;

  get matrix(): number { return this._matrix; }
  get upper_mask(): number { return this._upper_mask; }
  get lower_mask(): number { return this._lower_mask; }
  get mt(): number[] { return this._mt; }
  get index(): number { return this._index; }
  get seed(): number { return this._seed; }
  get times(): number { return this._times; }

  pure(): IMersenneTwisterInfo {
    return {
      matrix: this.matrix,
      upper_mask: this.upper_mask,
      lower_mask: this.lower_mask,
      mt: [...this.mt],
      index: this.index,
      seed: this.seed,
      times: this.times,
      mark: this.mark,
    }
  }

  load(info: IMersenneTwisterInfo): this {
    this._matrix = info.matrix
    this._upper_mask = info.upper_mask
    this._lower_mask = info.lower_mask
    this._mt = info.mt
    this._index = info.index
    this._seed = info.seed
    this._times = info.times
    this.mark = info.mark
    return this;
  }

  constructor(seed: number = Date.now()) {
    this.reset(seed)
  }

  reset(seed: number, debuging: boolean = false): this {
    this.debugging = debuging;
    this.mark = ''
    this._seed = seed;
    this._times = 0;
    this._matrix = 0x9908B0DF;
    this._upper_mask = 0x80000000;
    this._lower_mask = 0x7FFFFFFF;
    this._mt = new Array(_n);
    this._index = _n + 1;
    this._mt[0] = seed >>> 0;
    for (let i = 1; i < _n; i++) {
      const s = this._mt[i - 1]! ^ (this._mt[i - 1]! >>> 30);
      this._mt[i] = (((((s & 0xFFFF0000) >>> 16) * 1812433253) << 16) + (s & 0x0000FFFF) * 1812433253) + i;
      this._mt[i]! >>>= 0; // 转换为32位无符号整数
    }
    return this;
  }

  // 生成下一组624个值
  private twist(): void {
    for (let i = 0; i < _n; i++) {
      let x = (this._mt[i]! & this._upper_mask) | (this._mt[(i + 1) % _n]! & this._lower_mask);
      let xA = x >>> 1;
      if (x % 2 !== 0) {
        xA ^= this._matrix;
      }
      this._mt[i]! = this._mt[(i + _m) % _n]! ^ xA;
    }
    this._index = 0;
  }

  // 提取伪随机数
  public int(): number {
    if (this._index >= _n) this.twist();
    let y = this._mt[this._index++]!;
    // 额外的位操作以改善分布
    y ^= (y >>> 11);
    y ^= (y << 7) & 0x9D2C5680;
    y ^= (y << 15) & 0xEFC60000;
    y ^= (y >>> 18);
    const ret = y >>> 0; // 确保返回32位无符号整数
    if (this.debugging) mt_cases.push(this.mark, 'int', ret)
    ++this._times;
    return ret
  }
  public case(...any: any[]) {
    if (!this.debugging) return;
    mt_cases.push(this.mark, ...any)
  }
  /** 生成[0,1)范围内的浮点数 */
  public float(): number {
    const ret = floor_float(this.int() / (0xFFFFFFFF + 1));
    if (this.debugging) mt_cases.push(this.mark, 'float', ret)
    return ret;
  }

  /** 生成[min, max)范围内的整数 */
  public range(min: number, max: number, debugging = this.debugging): number {
    const ret = floor(this.float() * (max - min)) + min
    if (this.debugging) mt_cases.push(this.mark, 'range', min, max, ret)
    return ret;
  }

  /**  */
  public pick<T>(a: T | T[] | undefined, debugging = this.debugging): T | undefined {
    if (!a) return void 0;
    if (!Array.isArray(a)) return a
    const index = this.range(0, a.length, false)
    if (this.debugging) mt_cases.push(this.mark, 'pick', a.length, index)
    return a[index]
  }

  /**  */
  public take<T>(a: T | T[] | undefined, debugging = this.debugging): T | undefined {
    if (!a) return void 0;
    if (!Array.isArray(a)) return a
    const index = this.range(0, a.length, false)
    if (this.debugging) mt_cases.push(this.mark, 'take', a.length, index)
    return a.splice(index, 1)[0];
  }
}