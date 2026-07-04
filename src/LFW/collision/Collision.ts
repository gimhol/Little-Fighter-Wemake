import type { LFW } from "../LFW";
import type { World } from "../World";
import { ENTITY_PRIORITY_MAP, HitFlag, ItrKind, type IBdyInfo, type IBounding, type IFrameInfo, type IItrInfo, } from "../defines";
import type { Entity } from "../entity";
import { abs, max } from "../utils/math/base";
import { collisions_keeper } from "./CollisionKeeper";
import type { ICollisionSnapshot } from "./ICollisionSnapshot";

export interface ICollisionInits {
  /**
   * 攻击方
   *
   * @type {Entity}
   * @memberof Collision
   */
  attacker: Entity;

  /**
   * 被攻击方
   *
   * @type {Entity}
   * @memberof Collision
   */
  victim: Entity;

  /**
   * 攻击方的itr
   *
   * @type {IItrInfo}
   * @memberof Collision
   */
  itr: Readonly<IItrInfo>;

  /**
   * 被攻击方的bdy
   *
   * @type {IBdyInfo}
   * @memberof Collision
   */
  bdy: Readonly<IBdyInfo>;

  /**
   * 攻击方的frame
   *
   * @type {IFrameInfo}
   * @memberof Collision
   */
  aframe: Readonly<IFrameInfo>;

  /**
   * 被攻击方的frame
   *
   * @type {IFrameInfo}
   * @memberof Collision
   */
  bframe: Readonly<IFrameInfo>;
  itr_index: number;
  bdy_index: number;
}

export interface ICollisionFunc {
  (collision: Collision): void
}
export interface Collision extends ICollisionInits, ICollisionSnapshot {
  id: string;
  lfw: LFW;
  world: World;
  aid: string;
  vid: string;
  attacker: Entity;
  victim: Entity;
  itr: Readonly<IItrInfo>;
  bdy: Readonly<IBdyInfo>;
  aframe: Readonly<IFrameInfo>;
  bframe: Readonly<IFrameInfo>;

  /**
   * 攻击方判定框
   *
   * @type {IBounding}
   * @memberof Collision
   */
  a_cube: Readonly<IBounding>;

  /**
   * 被攻击方的判定框
   *
   * @type {IBounding}
   * @memberof Collision
   */
  b_cube: Readonly<IBounding>;
  ax: number;
  ay: number;
  az: number;
  vx: number;
  vy: number;
  vz: number;
  dx: number;
  dy: number;
  dz: number;
  m_distance: number;
  adata_id: string;
  vdata_id: string;
  aframe_id: string;
  bframe_id: string;
  itr_index: number;
  bdy_index: number;
  priority: number;

  handlers: ICollisionFunc[];
  injury: number | null;
  injury_r: number | null;
  real_injury: number | null;
  real_injury_r: number | null;
  rest: number;
}

export function collision_new(o: Readonly<ICollisionInits>): Collision {
  let { attacker: a, victim: v, aframe, bframe, itr, bdy, itr_index, bdy_index } = o;
  const world = a.world;
  const ax = a.position.x;
  const ay = a.position.y;
  const az = a.position.z;
  const vx = v.position.x;
  const vy = v.position.y;
  const vz = v.position.z;
  const dx = vx - ax;
  const dy = vy - ay;
  const dz = vz - az;
  const a_cube = world.get_bounding(a, aframe, itr);
  const b_cube = world.get_bounding(v, bframe, bdy);

  do {
    if (o.itr.kind !== ItrKind.WeaponSwing) break;
    const prefab_id = a.bearer?.frame.wpoint?.attacking;
    if (!prefab_id) { itr_index = -1; break; }
    const itr_prefab = a.data.itr_prefabs?.[prefab_id];
    if (!itr_prefab) { itr_index = -1; break; }
    itr = { ...o.itr, ...itr_prefab };
  } while (0);

  let rest = 0;
  if (!itr.arest && itr.vrest) {
    rest = max(a.world.dataset.min_vrest, itr.vrest + a.world.dataset.vrest_offset)
  }
  const c: Partial<Collision> = a.lfw.acquire_collision() || {}
  c.id = rest ? a.lfw.new_id : a.id;
  c.lfw = a.lfw;
  c.world = a.world;
  c.aid = a.id;
  c.vid = v.id;
  c.attacker = a;
  c.victim = v;
  c.itr = itr;
  c.bdy = bdy;
  c.aframe = aframe;
  c.bframe = bframe;
  c.ax = ax;
  c.ay = ay;
  c.az = az;
  c.vx = vx;
  c.vy = vy;
  c.vz = vz;
  c.dx = dx;
  c.dy = dy;
  c.dz = dz;
  c.adata_id = a.data.id;
  c.vdata_id = v.data.id;
  c.aframe_id = aframe.id;
  c.bframe_id = bframe.id;
  c.itr_index = itr_index;
  c.bdy_index = bdy_index;
  c.m_distance = abs(dx) + abs(dy) + abs(dz);
  c.a_cube = a_cube
  c.b_cube = b_cube
  c.rest = rest;
  if (c.handlers) c.handlers.length = 0;
  else c.handlers = [];
  c.priority = ENTITY_PRIORITY_MAP[a.data.type];
  c.injury = null;
  c.injury_r = null;
  c.real_injury = null;
  c.real_injury_r = null;
  return c as Collision; // 虽然有个as.... 但是...
}

const inits: ICollisionInits = {} as ICollisionInits
export function collision_get(attacker: Entity, victim: Entity): Collision | null {
  const aframe = attacker.frame;
  const bframe = victim.frame;
  const { itr } = aframe;
  const { bdy } = bframe;
  if (!itr?.length || !bdy?.length) return null;
  for (let i = 0; i < itr.length; ++i) {
    for (let j = 0; j < bdy.length; ++j) {
      inits.victim = victim;
      inits.attacker = attacker;
      inits.itr = itr[i]
      inits.bdy = bdy[j]
      inits.aframe = aframe;
      inits.bframe = bframe;
      inits.itr_index = i;
      inits.bdy_index = j;
      const collision = collision_new(inits);
      if (!collision_test(collision)) continue;
      return collision
    }
  }
  return null
}

export function collision_to_snapshot(c: Collision): ICollisionSnapshot {
  return {
    aid: c.aid,
    vid: c.vid,
    adata_id: c.adata_id,
    vdata_id: c.vdata_id,
    aframe_id: c.aframe_id,
    bframe_id: c.bframe_id,
    itr_index: c.itr_index,
    bdy_index: c.bdy_index,
    ax: c.ax,
    ay: c.ay,
    az: c.az,
    vx: c.vx,
    vy: c.vy,
    vz: c.vz,
    dx: c.dx,
    dy: c.dy,
    dz: c.dz,
    m_distance: c.m_distance,
    rest: c.rest
  }
}

export function collision_from_snapshot(lfw: LFW, snapshot: ICollisionSnapshot): Collision | null {
  const attacker = lfw.world.find_entity(snapshot.aid)
  if (!attacker) return null;
  const victim = lfw.world.find_entity(snapshot.vid)
  if (!victim) return null;

  const adata = lfw.datas.find_entity(snapshot.adata_id)
  if (!adata) return null;
  const vdata = lfw.datas.find_entity(snapshot.vdata_id)
  if (!vdata) return null;

  const aframe = adata.frames[snapshot.aframe_id]
  if (!aframe) return null;
  const bframe = vdata.frames[snapshot.bframe_id]
  if (!bframe) return null;

  const itr = aframe.itr?.[snapshot.itr_index];
  if (!itr) return null;
  const bdy = aframe.bdy?.[snapshot.bdy_index];
  if (!bdy) return null;

  inits.attacker = attacker;
  inits.victim = victim;
  inits.aframe = aframe;
  inits.bframe = bframe;
  inits.itr = itr;
  inits.bdy = bdy;
  inits.itr_index = snapshot.itr_index;
  inits.bdy_index = snapshot.bdy_index;
  const ret = collision_new(inits)
  Object.assign(ret, snapshot)
  return ret;
}

export function collision_clone(src: Collision): Collision {
  return { ...src, id: src.lfw.new_id }
}

export function collision_test(c: Collision): boolean {
  if (c.bdy_index < 0) return false; // should not happen
  if (c.itr_index < 0) return false; // should not happen
  const { itr, attacker, victim, a_cube, b_cube, bdy } = c
  if (!itr.vrest && attacker.arest) return false;
  if (itr.vrest && victim.get_v_rest(c.aid)) return false;

  if (itr.kind !== ItrKind.Heal) {
    const b_catcher = victim.catcher;
    if (victim.blinking || victim.invisible || victim.invulnerable) return false;
    if (b_catcher && b_catcher.frame.cpoint?.hurtable !== 1) return false
  }

  if (
    a_cube.left > b_cube.right ||
    a_cube.right < b_cube.left ||
    a_cube.bottom > b_cube.top ||
    a_cube.top < b_cube.bottom ||
    a_cube.far > b_cube.near ||
    a_cube.near < b_cube.far
  ) return false;

  const ally_flag = attacker.is_ally(victim) ? HitFlag.Ally : HitFlag.Enemy;
  const bdy_flag = bdy.hit_flag ?? HitFlag.AllEnemy;
  const itr_flag = itr.hit_flag ?? HitFlag.AllEnemy;
  if (
    !(itr_flag & victim.data.type) ||
    !(bdy_flag & attacker.data.type) ||
    (
      !(itr_flag & ally_flag) &&
      !(bdy_flag & ally_flag)
    )
  ) return false;
  if (
    victim.team === attacker.team && victim.pre_emitter &&
    victim.pre_emitter === attacker.pre_emitter &&
    victim.spawn_time === attacker.spawn_time
  ) return false;

  if (bdy.__tester?.run(c) === false) return false;
  if (itr.tester?.run(c) === false) return false;
  return collisions_keeper.load_handlers(c);
}