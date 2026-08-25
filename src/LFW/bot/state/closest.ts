import type { Entity } from "../../entity";
import { round, abs } from '../../utils/math/base';


export function closest(me: Entity, ...list: (Entity | undefined)[]): Entity | undefined {
  let ret: Entity | undefined;
  let distance = 0;
  const len = list.length;
  for (let i = 0; i < len; i++) {
    const it = list[i];
    if (!it) continue;
    const d = round(
      abs(me.position.x - it.position.x) +
      abs(me.position.z - it.position.z)
    );
    if (!ret || d < distance) {
      ret = it;
      distance = d;
    }
  }
  return ret;
}
