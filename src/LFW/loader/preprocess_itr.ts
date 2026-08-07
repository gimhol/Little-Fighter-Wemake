import { Expression } from "../base/Expression";
import { CondMaker } from "../dat_translator/CondMaker";
import { get_next_frame_by_raw_id } from "../dat_translator/get_the_next";
import { set_hit_flag } from "../dat_translator/set_hit_flag";
import { ActionType, BdyKind, OID, CollisionVal as C_Val, EntityEnum, type IEntityData, type IItrInfo, ItrEffect, ItrKind, StateEnum, WeaponEnum } from "../defines";
import { HitFlag } from "../defines/HitFlag";
import type { LFW } from "../LFW";
import { ensure } from "../utils/container_help/ensure";
import { get_val_geter_from_collision } from "./get_val_from_collision";
import type { IItrInfoContext } from "./IEntityDataContext";
import { preprocess_action } from "./preprocess_action";
import { preprocess_next_frame } from "./preprocess_next_frame";

/**
 * Description placeholder
 *
 * @export
 * @param {IItrInfo} itr 处理前的itr
 * @param {IEntityData} data 
 * @returns {IItrInfo} 处理后的itr
 */
export function preprocess_itr(ctx: IItrInfoContext): IItrInfo {
  const { lfw, data, jobs } = ctx;
  let { itr } = ctx;
  const ref = itr.ref ?? itr.prefab_id;
  const prefab = ref !== void 0 ? data.itr_prefabs?.[ref] : void 0;
  if (prefab) itr = { ...prefab, ...itr };
  if (itr.catchingact) preprocess_next_frame(itr.catchingact);
  if (itr.caughtact) preprocess_next_frame(itr.caughtact);
  switch (itr.kind) {
    case ItrKind.Normal: {
      switch (itr.effect as ItrEffect) {
        case ItrEffect.Fire:
          itr.test = itr.test ?? new CondMaker<C_Val>()
            .add(C_Val.VictimState, "!=", StateEnum.Burning)
            .or(C_Val.AttackerState, "!=", StateEnum.BurnRun)
            .done();
          break;
        case ItrEffect.MFire1:
          itr.test = itr.test ?? new CondMaker<C_Val>()
            .and(C_Val.VictimType, "==", EntityEnum.Fighter)
            .and(C_Val.VictimState, "!=", StateEnum.BurnRun)
            .and(C_Val.VictimState, "!=", StateEnum.Burning)
            .done();
          break;
        case ItrEffect.MFire2:
          itr.test = itr.test ?? new CondMaker<C_Val>()
            .add(C_Val.VictimState, "!=", StateEnum.BurnRun)
            .and(C_Val.VictimState, "!=", StateEnum.Burning)
            .done();
          break;
        case ItrEffect.Through:
          itr.test = itr.test ?? new CondMaker<C_Val>()
            .add(C_Val.VictimType, "!=", EntityEnum.Fighter)
            .done();
          break;
        case ItrEffect.Ice2:
          itr.test = itr.test ?? new CondMaker<C_Val>()
            .add(C_Val.VictimState, "!=", StateEnum.Frozen)
            .and(C_Val.VictimFrameId, "!=", C_Val.VictimFrameIndex_ICE)
            .done();
          break;
      }
      break;
    }
    case ItrKind.Pick: {
      set_hit_flag(itr, itr.hit_flag ?? HitFlag.AllBoth)
      itr.motionless = itr.motionless ?? 0;
      itr.shaking = itr.shaking ?? 0;
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .add(C_Val.AttackerHasHolder, "==", 0)
        .and(C_Val.VictimHasHolder, "==", 0)
        .and()
        .one_of(
          C_Val.VictimState,
          StateEnum.Weapon_OnGround,
          StateEnum.HeavyWeapon_OnGround,
        )
        .done();
      const test_1 = new CondMaker<C_Val>()
        .and(C_Val.VictimBaseType, "!=", WeaponEnum.Heavy)
        .done()
      const test_2 = new CondMaker<C_Val>()
        .and(C_Val.VictimBaseType, "==", WeaponEnum.Heavy)
        .done()
      itr.actions = ensure(itr.actions, {
        type: ActionType.A_NEXT_FRAME,
        desc: "picking_light 捡起轻型武器",
        pretest: true,
        test: test_1,
        data: { id: "115" },
      }, {
        type: ActionType.A_NEXT_FRAME,
        pretest: true,
        test: test_2,
        desc: "picking_heavy 捡起重型武器",
        data: { id: "117" },
      })
      break;
    }
    case ItrKind.PickSecretly: {
      set_hit_flag(itr, itr.hit_flag ?? HitFlag.AllBoth)
      itr.motionless = itr.motionless ?? 0;
      itr.shaking = itr.shaking ?? 0;
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .add(C_Val.AttackerHasHolder, "==", 0)
        .and(C_Val.VictimHasHolder, "==", 0)
        .and(C_Val.VictimState, "==", StateEnum.Weapon_OnGround)
        .done();
      break;
    }
    case ItrKind.SuperPunchMe: {
      itr.motionless = itr.motionless ?? 0;
      itr.shaking = itr.shaking ?? 0;
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .add(C_Val.VictimType, "==", EntityEnum.Fighter)
        .done();
      break;
    }
    case ItrKind.MagicFlute:
    case ItrKind.MagicFlute2: {
      itr.motionless = itr.motionless ?? 0;
      itr.shaking = itr.shaking ?? 0;
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .add(C_Val.VictimType, "==", EntityEnum.Fighter)
        .or(c => c
          .add(C_Val.VictimType, "==", EntityEnum.Weapon)
          .and(C_Val.VictimOID, "!=", OID.HenryArrow1)
          .and(C_Val.VictimOID, "!=", OID.RudolfWeapon),
        )
        .done();
      break;
    }
    case ItrKind.ForceCatch: {
      itr.motionless = itr.motionless ?? 0;
      itr.shaking = itr.shaking ?? 0;
      if (itr.vrest) {
        itr.arest = itr.vrest;
        delete itr.vrest;
      }
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .and(C_Val.VictimType, "==", EntityEnum.Fighter)
        .and(C_Val.VictimState, "!=", StateEnum.Falling)
        .done();
      break;
    }
    case ItrKind.Catch: {
      itr.motionless = itr.motionless ?? 0;
      itr.shaking = itr.shaking ?? 0;
      if (itr.vrest) {
        itr.arest = itr.vrest;
        delete itr.vrest;
      }
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .and(C_Val.VictimType, "==", EntityEnum.Fighter)
        .and(C_Val.VictimState, "==", StateEnum.Tired)
        .done();
      break;
    }
    case ItrKind.Block:
      set_hit_flag(itr, itr.hit_flag ?? HitFlag.AllBoth)
      itr.motionless = itr.motionless ?? 0;
      itr.shaking = itr.shaking ?? 0;
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .add(C_Val.BdyKind, "==", BdyKind.Normal)
        .done();
      break;
    case ItrKind.JohnShield:
      set_hit_flag(itr, itr.hit_flag ?? HitFlag.AllBoth)
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .and(C_Val.VictimType, "!=", EntityEnum.Fighter)
        .or(C_Val.SameTeam, "!=", 1)
        .done();
      break;
    case ItrKind.Heal: {
      set_hit_flag(itr, itr.hit_flag ?? HitFlag.AllBoth)
      if (itr.dvx) {
        itr.actions = ensure(itr.actions, {
          type: ActionType.A_NEXT_FRAME,
          data: get_next_frame_by_raw_id(itr.dvx, 'frame'),
        })
      }
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .and(C_Val.VictimType, "==", EntityEnum.Fighter)
        .done();
      break;
    }
    case ItrKind.Freeze: {
      set_hit_flag(itr, itr.hit_flag ?? HitFlag.AllBoth)
      itr.shaking = itr.shaking ?? 0;
      itr.motionless = itr.motionless ?? 0;
      itr.dvx = itr.dvx ?? 0;
      itr.dvy = itr.dvy ?? 0;
      itr.dvz = itr.dvz ?? 0;
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .add(C_Val.VictimType, "==", EntityEnum.Fighter)
        .and(c => c
          .add(C_Val.SameTeam, "==", 0)
          .or(C_Val.VictimState, "==", StateEnum.Frozen),
        )
        .done();
      break;
    }
    case ItrKind.Whirlwind: {
      set_hit_flag(itr, itr.hit_flag ?? HitFlag.AllBoth)
      itr.shaking = itr.shaking ?? 0;
      itr.motionless = itr.motionless ?? 0;
      itr.vrest = itr.vrest ?? 1;
      itr.injury = itr.injury ?? void 0;
      itr.dvx = itr.dvx ?? 0;
      itr.dvy = itr.dvy ?? 0;
      itr.dvz = itr.dvz ?? 0;
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .wrap(c => c
          .add(C_Val.VictimType, "==", EntityEnum.Weapon)
          .and(C_Val.VictimOID, "!=", OID.HenryArrow1)
          .and(C_Val.VictimOID, "!=", OID.Rudolf),
        )
        .or(c => c
          .add(C_Val.VictimType, "==", EntityEnum.Fighter)
          .and(c => c
            .add(C_Val.SameTeam, "==", 0)
            .or(C_Val.VictimState, "==", StateEnum.Frozen),
          ),
        )
        .done();
      break;
    }
    case ItrKind.CharacterThrew: {
      set_hit_flag(itr, itr.hit_flag ?? HitFlag.AllBoth)
      itr.test = itr.test ?? new CondMaker<C_Val>()
        .add(C_Val.AttackerThrew, "==", 1)
        .and(C_Val.AttackerType, "==", EntityEnum.Fighter)
        .done();
      break;
    }
  }
  itr.actions?.forEach((n, i, l) => l[i] = preprocess_action(lfw, n, jobs));
  if (itr.test)
    itr.__tester = new Expression(itr.test, get_val_geter_from_collision);
  return itr;
}

preprocess_itr.TAG = "cook_frame";

