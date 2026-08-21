import { Callbacks } from "./Callbacks";
import { NoEmitCallbacks } from "./NoEmitCallbacks";
import type { IFSMSnapshot } from "./IFSMSnapshot";

export interface IState<K extends string | number = string | number> {
  name?: string;
  get key(): K;
  update?(dt: number): K | undefined | void;
  enter?(): void;
  leave?(): void;
}
export interface IFSMCallback<
  K extends string | number = string | number,
  S extends IState<K> = IState<K>,
> {
  on_state_changed?(fsm: IReadonlyFSM<K, S>): void;
}
export interface IReadonlyFSM<
  K extends string | number = string | number,
  S extends IState<K> = IState<K>,
> {
  get callbacks(): NoEmitCallbacks<IFSMCallback<K, S>>;
  get state(): S | undefined;
  get prev_state(): S | undefined;
}
export class FSM<
  K extends string | number = string | number,
  S extends IState<K> = IState<K>,
> implements IReadonlyFSM<K, S> {
  static log?(msg: string): void
  protected _name: string = '';
  protected _callbacks = new Callbacks<IFSMCallback<K, S>>();
  protected _state_map = new Map<K, S>();
  protected _prev_state?: S;
  protected _state?: S;
  protected _time: number = 0;
  protected _state_time: number = 0;

  log?(msg: string): void
  set name(v: string) { this._name = v }
  get name(): string { return this._name }
  get states(): ReadonlyMap<K, S> { return this._state_map }
  get callbacks(): NoEmitCallbacks<IFSMCallback<K, S>> {
    return this._callbacks;
  }
  get state(): S | undefined {
    return this._state;
  }
  get time(): number { return this._time }
  set time(v: number) { this._time = v }
  get state_time(): number { return this._state_time }
  get prev_state(): S | undefined {
    return this._prev_state;
  }
  constructor(name: string = '') {
    this.name = name;
    this.log = FSM.log
  }
  logger(log: (msg: string) => void): this {
    this.log = log
    return this;
  }
  get(key: K): S | undefined {
    return this._state_map.get(key);
  }
  add(...states: S[]): this {
    for (const state of states) this._state_map.set(state.key, state);
    return this;
  }
  use(key: K): this {
    this.set_state(this._state_map.get(key));
    return this;
  }
  set_state(next_state: S | undefined) {
    this._prev_state = this._state;
    this._state?.leave?.();
    this._state_time = 0;
    this._state = next_state;
    next_state?.enter?.();
    if (this.log) {
      const prev_key = this._prev_state?.key
      const prev_name = this._prev_state?.name ?? prev_key
      const prev_label = prev_key == prev_name ? prev_name : `${prev_name}(${prev_key})`
      const next_key = next_state?.key
      const next_name = next_state?.name ?? next_key
      const next_label = next_key == next_name ? next_name : `${next_name}(${next_key})`
      this.log(`[${this.name}::state] ${prev_label} ==> ${next_label}`)
    }
    this._callbacks.call("on_state_changed", this);
  }
  update(dt: number) {
    this._time += dt;
    this._state_time += dt;
    const curr_state = this._state;
    if (!curr_state) return;

    const next_state_key = curr_state.update?.(dt);
    if (next_state_key === void 0 || next_state_key === null) return;

    const next_state = this._state_map.get(next_state_key);
    if (!next_state) return;

    this.set_state(next_state);
  }
  to_snapshot(): IFSMSnapshot<K> {
    return {
      name: this._name,
      state_key: this._state?.key,
      prev_state_key: this._prev_state?.key,
      time: this._time,
      state_time: this._state_time,
    };
  }
  from_snapshot(s: IFSMSnapshot<K>): this {
    this._name = s.name;
    this._time = s.time;
    this._state_time = s.state_time;
    this._prev_state = s.prev_state_key === void 0 ? void 0 : this._state_map.get(s.prev_state_key);
    this._state = s.state_key === void 0 ? void 0 : this._state_map.get(s.state_key);
    return this;
  }
}