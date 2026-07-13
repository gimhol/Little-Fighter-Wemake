import { LFW } from "../LFW";
import { CondMaker } from "../dat_translator";
import { cook_frame_indicator_info } from "../dat_translator/cook_frame_indicator_info";
import { make_frame_behavior } from "../dat_translator/make_frame_behavior";
import { set_hit_flag } from "../dat_translator/set_hit_flag";
import { Defines, EntityEnum, EntityVal as EV, FacingFlag as FF, FrameBehavior, HitFlag, type IFrameInfo, SE, StateEnum } from "../defines";
import type { IEntityData } from "../defines/IEntityData";
import { is_ball_data, is_weapon_data } from "../entity";
import { read_nums } from "../ui/utils/read_nums";
import { max, min } from "../utils";
import { traversal } from "../utils/container_help/traversal";
import { preprocess_ball_frame } from "./preprocess_ball_frame";
import { preprocess_bdy } from "./preprocess_bdy";
import { preprocess_frame_pic } from "./preprocess_frame_pic";
import { preprocess_itr } from "./preprocess_itr";
import { preprocess_next_frame } from "./preprocess_next_frame";
import { preprocess_opoint } from "./preprocess_opoint";


const breakfall_j_expression = new CondMaker<EV>()
  .add(EV.HP, ">", 0)
  .and(EV.HitByMagicFlute, "!=", 1)
  .and(EV.CAUGHT, "!=", 1)
  .done()

export function preprocess_frame(lfw: LFW, data: IEntityData, frame: IFrameInfo, jobs: Promise<void>[]): IFrameInfo {
  if (data.processed != false) { }
  else if (is_ball_data(data)) preprocess_ball_frame(frame, data);
  else if (is_weapon_data(data)) {
    data.indexes = data.indexes || {}
    const in_the_skys: string[] = data.indexes.in_the_skys || []
    const throwings: string[] = data.indexes.throwings || []
    const on_hands: string[] = data.indexes.on_hands || []
    switch (frame.state) {
      case StateEnum.Weapon_InTheSky:
        in_the_skys.push(frame.id)
        frame.bdy?.forEach((v) => set_hit_flag(v, HitFlag.AllBoth))
        break;
      case StateEnum.Weapon_Rebounding:
      case StateEnum.HeavyWeapon_JustOnGround:
        frame.itr = void 0;
        break;
      case StateEnum.Weapon_Throwing:
        throwings.push(frame.id)
        frame.bdy?.forEach((v) => set_hit_flag(v, HitFlag.AllBoth))
        break;
      case StateEnum.HeavyWeapon_InTheSky:
        in_the_skys.push(frame.id)
        throwings.push(frame.id)
        frame.bdy?.forEach((v) => set_hit_flag(v, HitFlag.AllBoth))
        break;
      case StateEnum.Weapon_OnHand:
      case StateEnum.HeavyWeapon_OnHand:
        on_hands.push(frame.id)
        break;
    }
    if (in_the_skys.length) data.indexes.in_the_skys = in_the_skys
    if (throwings.length) data.indexes.throwings = throwings
    if (on_hands.length) data.indexes.on_hands = on_hands
  }

  frame.width = frame.width ?? frame.pic?.w ?? 0
  frame.height = frame.height ?? frame.pic?.h ?? 0

  cook_frame_indicator_info(frame);
  if (is_weapon_data(data) || is_ball_data(data))
    make_frame_behavior(frame, data.id);

  if (frame.sound && !lfw.sounds.has(frame.sound))
    jobs.push(lfw.sounds.load(frame.sound, frame.sound))

  if (frame.seqs) {
    frame.__seq_map = new Map();
    traversal(frame.seqs, (k, v, o) => {
      if (!v) return;
      const nf = preprocess_next_frame(v)
      frame.__seq_map!.set(k, o[k] = nf)
    });
  }

  /*
    NOTE: 
      这是对按键受身的限制
      突然觉得可能有更好的做法：
        通过Buff与Ctrl来限制响应按键的功能
        但目前就这样吧
        - Gim 2026年6月4日
  */
  if (
    frame.state === SE.Falling &&
    frame.hit?.j &&
    !Array.isArray(frame.hit.j) &&
    !frame.hit.j.expression
  ) {
    frame.hit.j.expression = breakfall_j_expression;
  }

  traversal(frame.hit, (k, v, o) => { if (v) o[k] = preprocess_next_frame(o[k]!) });
  traversal(frame.hold, (k, v, o) => { if (v) o[k] = preprocess_next_frame(v) });
  traversal(frame.key_down, (k, v, o) => { if (v) o[k] = preprocess_next_frame(v) });
  traversal(frame.key_up, (k, v, o) => { if (v) o[k] = preprocess_next_frame(v) });

  if (frame.next) frame.next = preprocess_next_frame(frame.next);
  if (frame.on_dead) frame.on_dead = preprocess_next_frame(frame.on_dead);
  if (frame.on_exhaustion) frame.on_exhaustion = preprocess_next_frame(frame.on_exhaustion);
  if (frame.on_landing) frame.on_landing = preprocess_next_frame(frame.on_landing);


  if (
    !frame.on_x_restrict &&
    data.type == EntityEnum.Ball &&
    (frame.itr?.length || frame.bdy?.length) && (
      frame.state == StateEnum.Ball_Flying ||
      frame.state == StateEnum.Ball_3005 ||
      frame.state == StateEnum.Ball_3006
    )
  ) {
    // 拥有itr或bdy的ball在X轴被阻，破之
    frame.on_x_restrict = { id: '20', sounds: data.base.hit_sounds }
  }

  if (frame.on_restrict) frame.on_restrict = preprocess_next_frame(frame.on_restrict);
  if (frame.on_x_restrict) frame.on_x_restrict = preprocess_next_frame(frame.on_x_restrict);
  if (frame.on_z_restrict) frame.on_z_restrict = preprocess_next_frame(frame.on_z_restrict);

  frame.bdy?.forEach((n, i, l) => {
    const bdy = l[i] = preprocess_bdy(lfw, n, data, jobs)
    if (bdy.on_hit_ground) {
      frame.__hit_ground_bdys = frame.__hit_ground_bdys || []
      frame.__hit_ground_bdys?.push(bdy)
    }
  })
  frame.itr?.forEach((n, i, l) => {
    const itr = l[i] = preprocess_itr(lfw, n, data, jobs)
    if (itr.on_hit_ground) {
      frame.__hit_ground_itrs = frame.__hit_ground_itrs || []
      frame.__hit_ground_itrs?.push(itr)
    }
  })
  frame.opoint?.forEach((n, i, l) => l[i] = preprocess_opoint(n, lfw))

  const unchecked_frame = frame as any;
  if (unchecked_frame) {
    if (unchecked_frame.center) {
      const [x, y] = read_nums(unchecked_frame.center, 2);
      frame.centerx = x;
      frame.centery = y;
    }
  }
  frame.pic = preprocess_frame_pic(lfw, data, frame);

  if (frame.landable === void 0)
    frame.landable = data.type === EntityEnum.Ball ? 0 : 1;

  switch (frame.behavior) {
    // shit.
    case FrameBehavior.Boomerang: {
      if (void 0 === frame.facing && data.type === EntityEnum.Ball)
        frame.facing = FF.VX
    }
  }

  const DZL = Defines.DAFUALT_QUBE_LENGTH;
  frame.bdy?.forEach(({ x = 0, w = 0, z = -DZL / 2, l = DZL }) => {
    if (frame.__aabb_x1 == void 0) frame.__aabb_x1 = x - frame.centerx;
    else frame.__aabb_x1 = min(frame.__aabb_x1, x - frame.centerx);
    if (frame.__aabb_x2 == void 0) frame.__aabb_x2 = x + w - frame.centerx;
    else frame.__aabb_x2 = max(frame.__aabb_x2, x + w - frame.centerx);
    if (frame.__aabb_z1 == void 0) frame.__aabb_z1 = z;
    else frame.__aabb_z1 = min(frame.__aabb_z1, z);
    if (frame.__aabb_z2 == void 0) frame.__aabb_z2 = z + l;
    else frame.__aabb_z2 = max(frame.__aabb_z2, z + l);
  })
  frame.itr?.forEach(({ x = 0, w = 0, z = -DZL / 2, l = DZL }) => {
    if (frame.__aabb_x1 == void 0) frame.__aabb_x1 = x - frame.centerx;
    else frame.__aabb_x1 = min(frame.__aabb_x1, x - frame.centerx);
    if (frame.__aabb_x2 == void 0) frame.__aabb_x2 = (x + w) - frame.centerx;
    else frame.__aabb_x2 = max(frame.__aabb_x2, (x + w) - frame.centerx);
    if (frame.__aabb_z1 == void 0) frame.__aabb_z1 = z;
    else frame.__aabb_z1 = min(frame.__aabb_z1, z);
    if (frame.__aabb_z2 == void 0) frame.__aabb_z2 = z + l;
    else frame.__aabb_z2 = max(frame.__aabb_z2, z + l);
  })
  return frame
}
preprocess_frame.TAG = "preprocess_frame";
