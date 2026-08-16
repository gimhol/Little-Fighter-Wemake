import { FacingFlag as FF, type IFrameInfo, type IHitKeyMap, type INextFrame } from "../defines";
import { is_num, is_str } from "../utils";
import { cook_next_frame_cost } from "./cook_next_frame_cost";
import { add_next_frame } from "./edit_next_frame";
import { get_next_frame_by_raw_id } from "./get_the_next";


export class FrameEditing {
  frame: IFrameInfo;
  costs: Map<string, { mp: number, hp: number }>;
  constructor(frame: IFrameInfo, costs: Map<string, {
    mp: number;
    hp: number;
  }>) {
    this.frame = frame;
    this.costs = costs;
  }
  init(frame: IFrameInfo) {
    this.frame = frame;
    return this;
  }
  keydown(key: keyof IHitKeyMap | (keyof IHitKeyMap)[], ...nexts: (string | number | INextFrame)[]) {
    this.frame.key_down = this.frame.key_down || {};
    const cooks = nexts.map(v => {
      if (is_str(v) || is_num(v)) return get_next_frame_by_raw_id('' + v, 'frame', 'hit', this.costs);
      const r: INextFrame = { ...v };
      cook_next_frame_cost(r, 'hit', this.costs)
      return r
    })

    if (typeof key === 'string') key = [key];
    for (const k of key)
      this.frame.key_down[k] = add_next_frame(this.frame.key_down[k], ...cooks);
    return this;
  }
  hit(key: keyof IHitKeyMap | (keyof IHitKeyMap)[], ...nexts: (string | number | INextFrame)[]) {
    this.frame.hit = this.frame.hit || {};
    const cooks = nexts.map(v => {
      if (is_str(v) || is_num(v)) return get_next_frame_by_raw_id('' + v, 'frame', 'hit', this.costs);
      const r: INextFrame = { ...v };
      cook_next_frame_cost(r, 'hit', this.costs)
      return r
    })
    if (typeof key === 'string') key = [key];
    for (const k of key)
      this.frame.hit[k] = add_next_frame(this.frame.hit[k], ...cooks);
    return this;
  }
  seq(key: string, ...nexts: (string | number | INextFrame)[]) {
    this.frame.seqs = this.frame.seqs || {};
    const cookeds: INextFrame[] = [];
    for (const any of nexts) {
      if (!any) continue;
      if (is_str(any) || is_num(any)) {
        const cooked = get_next_frame_by_raw_id('' + any, 'frame', 'hit', this.costs)
        cookeds.push(cooked)
        continue;
      }
      if (typeof any == 'object') {
        const t = { ...any }
        cookeds.push(
          cook_next_frame_cost(t, 'hit', this.costs)
        )
      }
    }
    if (key[0] === 'F') {
      const k1 = 'L' + key.substring(1)
      const k2 = 'R' + key.substring(1)
      this.frame.seqs[k1] = add_next_frame(this.frame.seqs[k1], ...cookeds.map(nf => {
        return { ...nf, facing: nf.facing == FF.B ? FF.R : FF.L };
      }));
      this.frame.seqs[k2] = add_next_frame(this.frame.seqs[k2], ...cookeds.map(nf => {
        return { ...nf, facing: nf.facing == FF.B ? FF.L : FF.R };
      }));
    } else {
      this.frame.seqs[key] = add_next_frame(this.frame.seqs[key], ...cookeds);
    }
    return this;
  }
}
