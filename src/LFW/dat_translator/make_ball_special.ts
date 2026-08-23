import { EntityGroup, FrameBehavior as FB, OID, OpointKind, SpeedMode } from "../defines";
import { ActionType } from "../defines/actions/ActionType";
import { HitFlag } from "../defines/HitFlag";
import type { IEntityData } from "../defines/IEntityData";
import { ensure, find, floor } from "../utils";
import { foreach } from "../utils/container_help/foreach";
import { traversal } from "../utils/container_help/traversal";
import { set_hit_flag } from "./set_hit_flag";
export function make_ball_special(data: IEntityData) {
  switch (data.id as OID) {
    case OID.FirenFlame:
      traversal(data.frames, (_, frame) => {
        if (frame.itr) for (const itr of frame.itr)
          set_hit_flag(itr, HitFlag.AllEnemy)
      });
      break;
    case OID.FirzenBall:
      traversal(data.frames, (_, frame) => {
        frame.no_shadow = 1;
        frame.dvz = 0;
        frame.vzm = SpeedMode.Fixed;
      });
      break;
    case OID.BatBall:
      traversal(data.frames, (_, frame) => {
        frame.no_shadow = 1;
        frame.dvz = 0;
        frame.vzm = SpeedMode.Fixed;
      });
      break;
    case OID.JanChase:
      data.base.drop_sounds = data.base.hit_sounds;
      data.frames['50'].invisible = data.frames['50'].wait;
      data.frames['51'].invisible = data.frames['51'].wait;
      data.frames['52'].invisible = data.frames['52'].wait;
      traversal(data.frames, (_, f) => {
        if (f.behavior === FB.ChasingSameEnemy) {
          f.opoint = ensure(f.opoint, {
            oid: OID.JanChase,
            action: { id: "40" },
            x: f.centerx,
            y: f.centery,
            kind: OpointKind.Normal,
            ghost: true,
            speedz: 0,
            dvx: 0,
            dvy: 0,
            dvz: 0,
            interval: 1,
            interval_id: '1',
            interval_mode: 1,
            unimportant: 1,
          })
        }
        const tail = find(f.opoint, o => o.oid === OID.JanChase && (o.action as any).id === '40')
        if (tail) {
          tail.unimportant = 1
          tail.speedz = tail.dvx = tail.dvy = tail.dvz = 0;
          tail.ghost = true
        }
      })
      break;
    case OID.JanChaseh:
      data.frames['50'].invisible = data.frames['50'].wait;
      data.frames['51'].invisible = data.frames['51'].wait;
      data.frames['52'].invisible = data.frames['52'].wait;
      traversal(data.frames, (_, f) => {
        const tail = find(f.opoint, o => o.oid === OID.JanChaseh && (o.action as any).id === '40')
        if (tail) {
          tail.unimportant = 1
          tail.speedz = tail.dvx = tail.dvy = tail.dvz = 0;
          tail.ghost = true
        }
      })
      break;
    case OID.FirzenChasef:
      data.base.drop_sounds = data.base.hit_sounds;
      data.frames['59'].invisible = data.frames['59'].wait;
      data.frames['80'].invisible = data.frames['80'].wait;
      data.frames['81'].invisible = data.frames['81'].wait;
      traversal(data.frames, (_, f) => {
        if (f.behavior === FB.ChasingSameEnemy) {
          f.opoint = ensure(f.opoint, {
            oid: OID.FirzenChasef,
            action: { id: "40" },
            x: floor(f.pic!.w / 2),
            y: floor(f.pic!.h / 2),
            kind: OpointKind.Normal,
            ghost: true,
            speedz: 0,
            dvx: 0,
            dvy: 0,
            dvz: 0,
            interval: 1,
            interval_id: '1',
            interval_mode: 1,
            unimportant: 1,
          })
        }
      })
      break;
    case OID.FirzenChasei:
      data.base.drop_sounds = data.base.hit_sounds;
      traversal(data.frames, (_, f) => {
        if (f.behavior === FB.ChasingSameEnemy) {
          f.opoint = ensure(f.opoint, {
            oid: OID.FirzenChasei,
            action: { id: "40" },
            x: floor(f.pic!.w / 2),
            y: floor(f.pic!.h / 2),
            kind: OpointKind.Normal,
            ghost: true,
            speedz: 0,
            dvx: 0,
            dvy: 0,
            dvz: 0,
            interval: 1,
            interval_id: '1',
            interval_mode: 1,
            unimportant: 1,
          })
        }
      })
      break;
    case OID.DeepBall:
    case OID.DennisBall:
    case OID.WoodyBall:
    case OID.DavisBall:
    case OID.DennisChase:
    case OID.JackBall:
    case OID.JohnBall: {
      data.base.group = ensure(data.base.group, EntityGroup.FreezableBall)
      break;
    }

    case OID.JohnBiscuit: break;
    case OID.FreezeBall:
      data.base.group = ensure(data.base.group, EntityGroup.Freezer);
      break;
    case OID.BatChase:
      foreach(data.frames, (frame) => {
        if (FB.Bat !== frame.behavior) return;
        foreach(frame.itr, (itr) => {
          itr.actions = ensure(itr.actions, {
            type: ActionType.VALUE_STEAL,
            data: {
              target: 1,
              itr_hp_ratio: 0.2,
              itr_hp_r_ratio: 0.2,
            }
          })
        })
      })
      break;
    case OID.Weapon0:
    case OID.Weapon2:
    case OID.Weapon4:
    case OID.Weapon5:
    case OID.Weapon6:
    case OID.Weapon1:
    case OID.Weapon3:
    case OID.Weapon8:
    case OID.Weapon9:
    case OID.Weapon10:
    case OID.Weapon11:
    case OID.Criminal:
    case OID.HenryArrow1:
    case OID.RudolfWeapon:
    case OID.HenryWind:
    case OID.HenryArrow2:
    case OID.FirenBall:
    case OID.FreezeColumn:
    case OID.Weapon7:
    case OID.JustinBall:
    case OID.JulianBall:
    case OID.JulianBall2:
    case OID.Etc:
    case OID.BrokenWeapon:
  }
}
