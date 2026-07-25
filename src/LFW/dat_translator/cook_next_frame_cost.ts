import type { INextFrame } from "../defines";

type CostMap = Map<string, { mp: number, hp: number }>


export function cook_next_frame_cost(ret: INextFrame, type?: "next" | "hit", costs?: CostMap): INextFrame;
export function cook_next_frame_cost(ret: INextFrame | undefined, type?: "next" | "hit", costs?: CostMap): INextFrame | undefined;
export function cook_next_frame_cost(ret: INextFrame | undefined | null, type?: "next" | "hit", costs?: CostMap): INextFrame | undefined | null;
export function cook_next_frame_cost(ret: INextFrame | undefined | null, type?: "next" | "hit", costs?: CostMap): INextFrame | undefined | null {
  if (!costs) return ret;
  if (!ret) return ret;
  const id = typeof ret.id === 'string' ? ret.id : ret.id ? ret.id[0] : void 0;
  if (!id) return ret;
  const { mp = 0, hp = 0 } = costs.get(id) || {};
  if (type === "hit") {
    ret.mp = mp;
    ret.hp = hp;
  } else if (type === "next") {
    if (mp < 0) ret.mp = -mp;
    if (hp < 0) ret.hp = -hp;
  }
  if (!ret.mp) delete ret.mp;
  if (!ret.hp) delete ret.hp
  return ret;
}
