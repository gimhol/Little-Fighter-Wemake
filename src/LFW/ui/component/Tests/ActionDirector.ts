import { min } from "../../../utils";

export interface IWork {
  (): unknown;
}
export interface IAction {
  time: number;
  work: IWork;
  seq: number;
}
export class ActionDirector {

  private _action_idx = 0;
  private _actions: IAction[] = [];
  private _lifetime: number = 0;
  private _times: number = 1;
  private _curr: number = 0;
  private _seq: number = 0;
  get lifetime() { return this._lifetime; }
  get end_time() {
    return this._actions.at(this._actions.length - 1)?.time ?? 0
  }
  reset(): this {
    this._lifetime = 0;
    this._curr = 0;
    this._action_idx = 0;
    return this;
  }
  repeat(times: number, delay: number, ...works: IWork[]): this {
    let time = this.end_time
    do {
      for (const work of works) {
        this.insert(time += delay, work)
      }
      --times;
    } while (times > 0)
    return this;
  }
  offset(delay: number, ...works: IWork[]): this {
    return this.repeat(0, delay, ...works);
  }
  insert(time: number, work: IWork): this {
    this._actions.push({ time, work, seq: this._seq++ });
    return this;
  }
  wait(duration: number) {
    return this.insert(this.end_time + duration, () => { });
  }
  sort(): this {
    this._actions.sort((a, b) => a.time - b.time || a.seq - b.seq);
    return this;
  }
  update(dt: number) {
    const { end_time = 0 } = this;

    if (this._action_idx === this._actions.length && this._curr < this._times) {
      this._action_idx = 0;
      ++this._curr;
    }

    const time = this._lifetime + dt;
    if (this._curr < this._times && this._times > 0) {
      const actions: IAction[] = [];
      const t = end_time ? min(end_time, time) : time
      for (; this._action_idx < this._actions.length; ++this._action_idx) {
        const action = this._actions[this._action_idx];
        if (action.time > t) break;
        actions.push(action);
      }
      actions.forEach(v => v.work());
    }

    this._lifetime = end_time ? time % end_time : time;
  }
  times(times: number) {
    this._times = times
    return this;
  }
}
