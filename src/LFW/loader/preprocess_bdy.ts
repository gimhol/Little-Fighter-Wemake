import { Expression } from "../base/Expression";
import { CondMaker, set_bdy_kind, set_hit_flag } from "../dat_translator";
import { ActionType, B_K, C_Val, E_E, HitFlag, I_K, O_ID, OLD_BDY_KIND_GOTO_MAX, OLD_BDY_KIND_GOTO_MIN, SE, StateEnum, type IBdyInfo } from "../defines";
import { between, ensure } from "../utils";
import { get_val_geter_from_collision } from "./get_val_from_collision";
import type { IBdyInfoContext } from "./IEntityDataContext";
import { preprocess_action } from "./preprocess_action";
import { prefab_error, resolve_prefab } from "./resolve_prefab";

export function preprocess_bdy(ctx: IBdyInfoContext): IBdyInfo {
  const { lfw, data, jobs, frame } = ctx;
  let { bdy } = ctx;
  const merged = resolve_prefab(bdy, data.bdy_prefabs);
  if (!merged.ok)
    throw prefab_error('preprocess_bdy', data.id, 'bdy', merged);
  bdy = merged.value;
  const { kind } = bdy;

  if (kind === B_K.Normal && frame.state === StateEnum.Caught && bdy.hit_flag == void 0)
    set_hit_flag(bdy, HitFlag.AllBoth)

  if (between(kind, OLD_BDY_KIND_GOTO_MIN, OLD_BDY_KIND_GOTO_MAX)) {
    set_bdy_kind(bdy, B_K.Criminal)
    bdy.test = new CondMaker<C_Val>()
      .add(c => c
        .add(C_Val.SameTeam, "==", 0)
        .and(C_Val.AttackerType, "==", E_E.Fighter)
        .and(C_Val.ItrKind, "==", I_K.Normal),
      ).or(c => c
        .add(C_Val.SameTeam, "==", 0)
        .and(C_Val.AttackerType, "==", E_E.Weapon)
        .and(C_Val.ItrKind, "==", I_K.Normal)
        .and(c => c
          .or(C_Val.AttackerState, "==", SE.Weapon_OnHand)
          .or(C_Val.AttackerOID, "==", O_ID.HenryArrow1)
          .or(C_Val.AttackerOID, "==", O_ID.RudolfWeapon),
        ),
      ).done();

    bdy.actions = ensure(bdy.actions, {
      type: ActionType.V_NEXT_FRAME,
      data: { id: `${kind - 1000}` },
    }, {
      type: ActionType.V_TURN_TEAM,
      data: { team: "" }
    })
  }

  bdy.__tester = bdy.test ? new Expression(
    bdy.test,
    get_val_geter_from_collision
  ) : void 0;
  bdy.actions?.forEach((n, i, l) => l[i] = preprocess_action(lfw, n, jobs));
  return bdy;
}

preprocess_bdy.TAG = 'preprocess_bdy'