import { Expression } from "../base/Expression";
import type { IBdyInfo } from "../defines";
import { get_val_geter_from_collision } from "./get_val_from_collision";
import type { IBdyInfoContext } from "./IEntityDataContext";
import { preprocess_action } from "./preprocess_action";

export function preprocess_bdy(ctx: IBdyInfoContext): IBdyInfo {
  const { lfw, data, jobs } = ctx;
  let { bdy } = ctx;
  const ref = bdy.ref ?? bdy.prefab_id;
  const prefab = ref ? data.bdy_prefabs?.[ref] : void 0;
  if (prefab) bdy = { ...prefab, ...bdy };
  bdy.__tester = bdy.test ? new Expression(
    bdy.test,
    get_val_geter_from_collision
  ) : void 0;
  bdy.actions?.forEach((n, i, l) => l[i] = preprocess_action(lfw, n, jobs));
  return bdy;
}

preprocess_bdy.TAG = 'preprocess_bdy'