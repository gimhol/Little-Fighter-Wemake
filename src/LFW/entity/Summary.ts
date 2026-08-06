import { Callbacks } from "../base/Callbacks";
export interface ISummaryCallbacks {
  on_damage_sum_changed?(value: number, prev: number, target: Summary): void
  on_kill_sum_changed?(value: number, prev: number, target: Summary): void
  on_picking_sum_changed?(value: number, prev: number, target: Summary): void
  on_mp_usage_changed?(value: number, prev: number, target: Summary): void
  on_hp_lost_changed?(value: number, prev: number, target: Summary): void
}

export class Summary {
  readonly callbacks = new Callbacks<ISummaryCallbacks>()
  /**
   * 伤害总数
   *
   * @protected
   * @type {number}
   */
  protected _damage_sum: number = 0;

  /**
   * 拾取物件总数
   *
   * @protected
   * @type {number}
   */
  protected _picking_sum: number = 0;

  /**
   * 击杀总数
   *
   * @protected
   * @type {number}
   */
  protected _kill_sum: number = 0;

  protected _id: string = '';

  protected _hp_lost: number = 0;
  protected _mp_usage: number = 0;

  get id() { return this._id; }

  /**
   * 拾取物件总数
   *
   * @protected
   * @type {number}
   */
  get picking_sum() {
    return this._picking_sum;
  }
  set picking_sum(v: number) {
    const o = this._picking_sum;
    if (o == v) return;
    this._picking_sum = v;
    this.callbacks.call("on_picking_sum_changed", v, o, this);
    return;
  }

  /**
   * 伤害总数
   *
   * @protected
   * @type {number}
   */
  get damage_sum() {
    return this._damage_sum;
  }

  set damage_sum(v: number) {
    const o = this._damage_sum;
    if (o == v) return;
    this._damage_sum = v;
    this.callbacks.call("on_damage_sum_changed", v, o, this);
    return;
  }

  /**
   * 击杀总数
   *
   * @readonly
   * @type {number}
   */
  get kill_sum() {
    return this._kill_sum;
  }
  set kill_sum(v: number) {
    const o = this._kill_sum;
    if (o == v) return;
    this._kill_sum = v;
    this.callbacks.call("on_kill_sum_changed", v, o, this);
    return;
  }

  get hp_lost() {
    return this._hp_lost;
  }
  set hp_lost(v: number) {
    const o = this._hp_lost;
    if (o == v) return;
    this._hp_lost = v;
    this.callbacks.call("on_hp_lost_changed", v, o, this);
    return;
  }

  get mp_usage() {
    return this._mp_usage;
  }
  set mp_usage(v: number) {
    const o = this._mp_usage;
    if (o == v) return;
    this._mp_usage = v;
    this.callbacks.call("on_mp_usage_changed", v, o, this);
    return;
  }

  public constructor(id: string) {
    this.reset(id);
  }
  public reset(id: string): void {
    this._id = id;
    this._damage_sum = 0;
    this._kill_sum = 0;
    this._picking_sum = 0;
    this._hp_lost = 0;
    this._mp_usage = 0;
  }
  public release(): void {
    this.callbacks.clear();
    this.reset('');
  }
}
