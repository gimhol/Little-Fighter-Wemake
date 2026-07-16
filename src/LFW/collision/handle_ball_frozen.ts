import { OID, FrameId, Defines, EntityGroup, GONE_FRAME_INFO, type IItrInfo, type IOpointInfo, ItrKind, StateEnum } from "../defines";
import { Entity, is_ball, is_fighter, turn_face } from "../entity";
import { round } from "../utils";

const freeze_ball_opoint: IOpointInfo = {
  oid: OID.FreezeBall,
  kind: 0,
  x: 0,
  y: 0,
  action: Defines.NEXT_FRAME_AUTO
}
export function handle_ball_frozen(a: Entity, v: Entity, itr: IItrInfo): boolean {
  if (!a.group?.length) return false;
  if (!v.group?.length) return false;
  const ok = [ItrKind.Normal, ItrKind.CharacterThrew, ItrKind.WeaponSwing].some(v => v == itr.kind)
  if (!ok) return false;
  if (
    v.group.some(v => v == EntityGroup.Freezer) &&
    a.group.some(v => v == EntityGroup.FreezableBall)
  ) {
    const temp = a;
    a = v;
    v = temp;
  } else if (
    a.group.some(v => v != EntityGroup.Freezer) ||
    v.group.some(v => v != EntityGroup.FreezableBall)
  ) {
    return false;
  }
  do {
    if (v.state != StateEnum.Ball_Flying)
      return false
    if (is_ball(v)) break;
    if (is_fighter(a)) break;
    if (a.state == StateEnum.Weapon_OnHand) break;
    return false;
  } while (0)

  // stupid?

  const { x: x1, y: y1, z: z1 } = a.position;
  const { x: x2, y: y2, z: z2 } = v.position;
  const cy1 = y1 + a.frame.centery;
  const cx1 = a.facing > 0 ?
    x1 - a.frame.centerx :
    x1 + a.frame.centerx - a.frame.centerx;

  const cy2 = (y2 + v.frame.centery) - v.frame.height / 2;
  const cx2 = v.facing > 0 ?
    (x2 - v.frame.centerx) + v.frame.width / 2 :
    (x2 + v.frame.centerx - v.frame.width) + v.frame.width / 2;
  freeze_ball_opoint.x = a.facing * round(cx2 - cx1)
  freeze_ball_opoint.y = round(cy1 - cy2)
  freeze_ball_opoint.z = round(z2 - z1)
  const freeze_ball = a.spawn_entity(
    freeze_ball_opoint, void 0, turn_face(v.facing)
  )
  if (!freeze_ball) return false;
  v.enter_frame(GONE_FRAME_INFO)
  return true
}
