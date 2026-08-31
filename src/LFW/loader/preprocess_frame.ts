import { CondMaker } from "../dat_translator";
import { cook_frame_indicator_info } from "../dat_translator/cook_frame_indicator_info";
import { make_frame_behavior } from "../dat_translator/make_frame_behavior";
import { set_hit_flag } from "../dat_translator/set_hit_flag";
import { Defines, EntityEnum, EntityVal as EV, FacingFlag as FF, FrameBehavior, HitFlag, type IBdyInfo, type IFrameInfo, type IItrInfo, SE, StateEnum } from "../defines";
import { is_ball_data, is_fighter_data, is_weapon_data } from "../entity";
import { read_nums } from "../ui/utils/read_nums";
import { max, min } from "../utils";
import { traversal } from "../utils/container_help/traversal";
import type { IFrameInfoContext } from "./IEntityDataContext";
import { preprocess_ball_frame } from "./preprocess_ball_frame";
import { preprocess_bdy } from "./preprocess_bdy";
import { preprocess_frame_pic } from "./preprocess_frame_pic";
import { preprocess_itr } from "./preprocess_itr";
import { preprocess_next_frame } from "./preprocess_next_frame";
import { preprocess_opoint } from "./preprocess_opoint";
import { preprocess_pic } from "./preprocess_pic";


const breakfall_j_expression = new CondMaker<EV>()
  .add(EV.HP, ">", 0)
  .and(EV.HitByMagicFlute, "!=", 1)
  .and(EV.CAUGHT, "!=", 1)
  .done()

function merge_frame(ctx: IFrameInfoContext): IFrameInfo {
  const { data } = ctx;
  const { frame } = ctx;
  const chain: string[] = [];
  const stack: IFrameInfo[] = [frame];
  let cur: IFrameInfo = frame;
  // 允许 prefab 的 ref 继续指向另一个 prefab（链式继承）
  while (cur.ref !== void 0) {
    const ref = cur.ref;
    if (chain.includes(ref)) {
      throw new Error(
        `[preprocess_frame::merge_frame] 帧 "${data.id}:${frame.id}" 的 prefab 引用成环: ${[...chain, ref].join(' -> ')}`
      );
    }
    const prefab = data.frame_prefabs?.[ref];
    if (!prefab) {
      throw new Error(
        `[preprocess_frame::merge_frame] 帧 "${data.id}:${frame.id}" 引用了不存在的 prefab: "${ref}"`
      );
    }
    chain.push(ref);
    stack.push(prefab);
    cur = prefab;
  }
  if (stack.length === 1) return frame;
  // 从最底层的 prefab 开始逐层合并，后声明者覆盖先声明者
  let merged = stack[stack.length - 1];
  for (let i = stack.length - 2; i >= 0; i--)
    merged = { ...merged, ...stack[i] };
  return merged;
}

export function preprocess_frame(ctx: IFrameInfoContext): IFrameInfo {
  const { lfw, data, jobs } = ctx;
  const frame = merge_frame(ctx);
  if (data.processed != false) { }
  else if (is_ball_data(data)) { preprocess_ball_frame(ctx); }
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
  if (is_fighter_data(data)) {
    switch (frame.state) {
      case StateEnum.Falling:
      case StateEnum.Caught:
      case StateEnum.Injured:
      case StateEnum.Frozen:
      case StateEnum.Burning:
        break;
      default:
        frame.stat_recover ??= 1;
    }
    switch (frame.state) {
      case StateEnum.Standing:
      case StateEnum.Walking:
      case StateEnum.Running:
      case StateEnum.Jump:
      case StateEnum.Dash:
      case StateEnum.Lying:
      case StateEnum.Rowing:
        frame.toughness_recover ??= 1;
        break;
    }
  }

  frame.width ??= frame.pic?.w ?? 0
  frame.height ??= frame.pic?.h ?? 0

  cook_frame_indicator_info(frame);
  if (is_weapon_data(data) || is_ball_data(data))
    make_frame_behavior(frame, data.id);

  if (Array.isArray(frame.sound)) {
    frame.sound.forEach(sound => {
      jobs.push(lfw.sounds.load(sound, sound))
    })
  } else if (frame.sound) {
    jobs.push(lfw.sounds.load(frame.sound, frame.sound))
  }

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
  if (frame.state === SE.Falling && frame.hit?.j) {
    const j = Array.isArray(frame.hit.j) ? frame.hit.j : [frame.hit.j];
    for (const v of j) {
      if (('' + v.id) == '100' || ('' + v.id) == '108')
        v.expression = breakfall_j_expression
    }
  }

  traversal(frame.hit, (k, v, o) => { if (v) o[k] = preprocess_next_frame(v) });
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
    // 拥有itr或bdy的ball在X轴或Y轴被阻，破之
    frame.on_x_restrict = { id: '20', sound: data.base.hit_sounds }
    frame.on_y_restrict = { id: '20', sound: data.base.hit_sounds }
  }

  if (frame.on_restrict) frame.on_restrict = preprocess_next_frame(frame.on_restrict);
  if (frame.on_x_restrict) frame.on_x_restrict = preprocess_next_frame(frame.on_x_restrict);
  if (frame.on_y_restrict) frame.on_y_restrict = preprocess_next_frame(frame.on_y_restrict);
  if (frame.on_z_restrict) frame.on_z_restrict = preprocess_next_frame(frame.on_z_restrict);

  frame.bdy?.forEach((n, i, l) => {
    const bdy = l[i] = preprocess_bdy({ ...ctx, bdy: n, index: i });
    if (bdy.on_hit_ground) {
      frame.__hit_ground_bdys = frame.__hit_ground_bdys || []
      frame.__hit_ground_bdys?.push(bdy)
    }
  })
  frame.itr?.forEach((n, i, l) => {
    const itr = l[i] = preprocess_itr({ ...ctx, itr: n, index: i })
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
  frame.pics?.forEach((pic, i, arr) => arr[i] = preprocess_pic(lfw, data, pic));


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
  const fold_aabb = (frame: IFrameInfo) => (any: IBdyInfo | IItrInfo) => {
    const { x = 0, w = 0, z = -DZL / 2, l = DZL } = any
    const x1 = x - frame.centerx;
    const x2 = x1 + w;
    frame.__aabb_x1 = min(frame.__aabb_x1 ?? x1, x1);
    frame.__aabb_x2 = max(frame.__aabb_x2 ?? x2, x2);
    frame.__aabb_z1 = min(frame.__aabb_z1 ?? z, z);
    frame.__aabb_z2 = max(frame.__aabb_z2 ?? z + l, z + l);
  };
  frame.bdy?.forEach(fold_aabb(frame))
  frame.itr?.forEach(fold_aabb(frame))
  return frame
}
preprocess_frame.TAG = "preprocess_frame";
