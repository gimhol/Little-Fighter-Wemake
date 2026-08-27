import { MersenneTwister } from "../utils/math/MersenneTwister";
type NotEmptyArray<T> = [T, ...T[]]
export class Randoming<T> {
  static mt = new MersenneTwister(Date.now())
  static create<T>(name: string, src: NotEmptyArray<T>, mt?: MersenneTwister, duplicate?: boolean): Randoming<T>;
  static create<T>(name: string, src: T[], mt?: MersenneTwister, duplicate?: boolean): Randoming<T | undefined>;
  static create<T>(name: string, src: T[], mt: MersenneTwister = Randoming.mt, duplicate: boolean = false): Randoming<T | undefined> {
    return new Randoming<T | undefined>(name, src, mt, duplicate)
  }

  readonly name: string;
  readonly mt: MersenneTwister;
  protected _src: Readonly<T[]>;
  protected cur: T[]
  protected taken: T | null = null;
  protected duplicate: boolean;
  get src() { return this._src }


  constructor(name: string, src: T[], mt: MersenneTwister = Randoming.mt, duplicate: boolean = false) {
    this.name = name;
    this.mt = mt
    this._src = src;
    this.cur = [...src];
    this.duplicate = duplicate;
  }
  set_src(src: Readonly<T[]>) {
    this._src = src;
    return this;
  }
  get(): T {
    if (this.duplicate) {
      this.taken = this.random_get()!
    } else {
      this.taken = this.random_take()!
    }
    return this.taken;
  }
  protected random_get(): T | undefined {
    const idx = this.random_in(0, this.src.length)
    return this.src[idx];
  }
  protected random_take(): T | undefined {
    if (!this.cur.length) {
      this.cur = this._src.length > 1 ? this._src.filter(v => v != this.taken) : [...this._src];
    }
    const idx = this.random_in(0, this.cur.length);
    return this.cur.splice(idx, 1)[0];
  }
  protected random_in(l: number, r: number) {
    this.mt.mark = this.name;
    return this.mt.range(l, r);
  }
}
