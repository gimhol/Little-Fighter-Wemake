import type { INextFrameResult, TNextFrame } from "../defines";
import type { BaseController } from "./BaseController";

export class ControllerResult {
  readonly owner: BaseController
  /** 下帧 */
  result?: INextFrameResult;
  /** 触发类型 */
  kind: '' | 'dbl' | 'hld' | 'ku' | 'kd' | 'hit' | 'seq' = '';
  /** 触发按键 */
  keys: string = '';
  /** 触发时间 */
  time: number = 0;

  constructor(owner: BaseController) {
    this.owner = owner;
  }

  clear(): this {
    this.result = void 0;
    this.time = 0;
    this.keys = '';
    this.kind = '';
    return this;
  }

  fire(nf: TNextFrame, time: number, keys: string, kind: typeof this.kind): boolean {
    const result = this.owner.entity.get_next_frame(nf);
    if (!result) return false;
    this.result = result;
    this.time = time;
    this.keys = keys;
    this.kind = kind;
    return true;
  }
}
