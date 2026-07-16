import { BdyKind, FrameId, OID, Defines, EntityEnum, EntityGroup, type IOpointInfo, StateEnum } from "../defines";
import { ActionType } from "../defines/actions/ActionType";
import { CollisionVal as C_Val } from "../defines/CollisionVal";
import type { IEntityData } from "../defines/IEntityData";
import { OpointKind } from "../defines/OpointKind";
import { ensure, make_arr } from "../utils";
import { foreach } from "../utils/container_help/foreach";
import { armour, baseball, beer1, beer2, boomerang, box0, box1, box2, box3, hoe, icesword1, icesword2, k_hoe, milk1, milk2, milk3, s_hoe, sstick, sstone, stick, stone } from "./broken_piece_frames";
import { CondMaker } from "./CondMaker";
Defines.WEAPON_WEIGHT_HEAVY
const broken_pieces_opoints = (...frame_ids: (string | string[])[]): IOpointInfo[] => {
  const aa = [
    { dvy: 5, dvx: -1 },
    { dvy: 5, dvx: 1 },
    { dvy: 3 },
    { dvy: 2, dvx: 2 },
    { dvy: 2, dvx: -2 },
    { dvy: 4, dvx: -1.5 },
    { dvy: 4, dvx: 1.5 },
    { dvy: 2 },
    { dvy: 1, dvx: 1 },
    { dvy: 1, dvx: -1 },
  ];
  return frame_ids.map<IOpointInfo>((frame_id, idx) => {
    return {
      kind: OpointKind.Normal,
      x: 0,
      y: 0,
      origin_type: 1,
      action: { id: frame_id },
      oid: "999",
      unimportant: 1,
      inherit_speed_x: 0.5,
      inherit_speed_y: 0.5,
      inherit_speed_z: 0.5,
      ...aa[idx % aa.length],
    };
  });
};
const handled = new Set<any>();
export function make_weapon_special(data: IEntityData) {
  const num_data_id = Number(data.id);
  if (num_data_id >= 100 && num_data_id <= 199) {
    data.base.group = ensure(data.base.group,
      EntityGroup.VsWeapon,
      EntityGroup.StageWeapon,
    );
  }
  switch (data.id) {
    case OID.HenryArrow1:
      data.base.weight = Defines.WEAPON_WEIGHT_ARROW;
      delete data.base.group
      foreach(data.frames, frame => {
        if (frame.state === StateEnum.Weapon_Rebounding) {
          delete frame.itr
          return;
        }
        foreach(frame.itr, (itr, idx) => {
          if (handled.has(itr)) throw new Error('already handle!')
          handled.add(itr)
          itr.actions = ensure(itr.actions, {
            type: ActionType.A_NEXT_FRAME,
            data: Defines.NEXT_FRAME_GONE,
            pretest: true,
            test: new CondMaker<C_Val>()
              .add(C_Val.VictimType, '==', EntityEnum.Fighter)
              .and(C_Val.BdyKind, '==', BdyKind.Normal)
              .and(C_Val.VictimState, '!=', StateEnum.Defend)
              .and(c => c
                .add(C_Val.ArmorWork, '==', 0)
                .or(C_Val.VToughness, '<=', 0)
              )
              .done()
          })
        })
      })
      break;
    case OID.RudolfWeapon:
      data.base.weight = Defines.WEAPON_WEIGHT_ARROW
      delete data.base.group
      foreach(data.frames, frame => {
        if (frame.state === StateEnum.Weapon_Rebounding) {
          delete frame.itr
          return;
        }
      })
      break;
    case OID.Weapon_Stick:
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_NOMRAL;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(
        stick, stick,
        sstick, sstick, sstick
      );
      break;
    case OID.Weapon_Hoe:
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_HOE;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(k_hoe, k_hoe, hoe, hoe, s_hoe, s_hoe);
      break;
    case OID.Weapon_Knife:
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_LIGHT;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(k_hoe, k_hoe, s_hoe, s_hoe);
      break;
    case OID.Weapon_baseball:
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_BASEBALL;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(
        ...make_arr(5, () => baseball)
      );
      break;
    case OID.Weapon_milk:
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_LIGHT;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(
        milk1,
        ...make_arr(4, () => milk3),
        ...make_arr(5, () => milk2)
      );
      data.base.group = [EntityGroup.VsWeapon];
      data.base.drink = {
        hp_h_total: 160,
        hp_h_value: 4,
        hp_h_ticks: 5,
        hp_r_total: 80,
        hp_r_value: 2,
        hp_r_ticks: 5,
        mp_h_total: 166,
        mp_h_value: 5,
        mp_h_ticks: 6,
      }
      break;
    case OID.Weapon_Stone:
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_HEAVY;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(stone, stone, sstone, sstone, sstone);
      break;
    case OID.Weapon_WoodenBox:
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_HEAVY;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(box0, box1, box2, box3, box3);
      break;
    case OID.Weapon_Beer:
      data.base.group = [EntityGroup.VsWeapon];
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_LIGHT;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(
        beer1, beer2, beer2, beer2, beer2, milk2, milk2, milk2, milk2, milk2
      );
      data.base.group = ensure(data.base.group, EntityGroup.VsWeapon);
      data.base.drink = {
        mp_h_total: 750,
        mp_h_value: 12,
        mp_h_ticks: 1,
      }
      break;
    case OID.Weapon_Boomerang:
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_LIGHT;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(boomerang, boomerang, boomerang);
      break;
    case OID.Weapon_LouisArmourA:
      delete data.base.group
      data.base.weight = Defines.WEAPON_WEIGHT_HEAVY;
      data.base.brokens = broken_pieces_opoints(armour, armour, armour, armour, armour);
      break;
    case OID.Weapon_LouisArmourB:
      delete data.base.group
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_HEAVY;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(armour, armour, armour, armour, armour);
      break;
    case OID.Weapon_IceSword:
      delete data.base.group
      data.base.group = ensure(data.base.group, EntityGroup.Freezer);
      data.base.weight = data.base.weight ?? Defines.WEAPON_WEIGHT_NOMRAL;
      data.base.brokens = data.base.brokens ?? broken_pieces_opoints(icesword1, icesword1, icesword1, icesword2, icesword2, icesword2, icesword2);
      break;
  }
}
