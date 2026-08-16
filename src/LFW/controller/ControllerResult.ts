import type { TNextFrame, LGK } from "../defines";

export class ControllerResult {
  


  /** 下帧 */
  next_frame?: TNextFrame;
  /** 触发类型 */
  kind: '' | 'dbl' | 'hld' | 'ku' | 'kd' | 'hit' | 'seq' = '';
  /** 触发按键 */
  keys: string = '';
  /** 触发时间 */
  time: number = 0;

  clear(): this {
    this.next_frame = void 0;
    this.time = 0;
    this.keys = '';
    this.kind = '';
    return this;
  }

  fire(nf: TNextFrame, time: number, keys: string, kind: typeof this.kind) {
    this.next_frame = nf;
    this.time = time;
    this.keys = keys;
    this.kind = kind;
  }

}
