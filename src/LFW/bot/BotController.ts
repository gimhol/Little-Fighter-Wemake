import { FSM } from "../base/FSM";
import { BaseController } from "../controller/BaseController";
import {
  AGK,
  ATTCKING_ITR_KINDS,
  ATTCKING_STATES,
  BotDataSet,
  BSE,
  Defines as D,
  Difficulty,
  GK,
  type IBotAction, type IBotData,
  type IVector2Like,
  type IVector3,
  type LGK,
  OID,
  StateEnum,
  WT
} from "../defines";
import { Ditto } from "../ditto";
import { Entity, is_ball, is_fighter, is_human_ctrl, is_weapon } from "../entity";
import { closer_one } from "../helper";
import { box_gap_xz } from "../helper/manhattan_xz";
import { abs, between, max, round } from '../utils/math/base';
import { clamp } from '../utils/math/clamp';
import { round_float } from '../utils/math/round_float';
import { dummy_updaters, DummyEnum } from "./DummyEnum";
import { NearestTargets } from "./NearestTargets";
import { BotState_Avoiding } from './state/BotState_Avoiding';
import { BotState_Chasing } from './state/BotState_Chasing';
import { BotState_Dead } from "./state/BotState_Dead";
import { BotState_Following } from "./state/BotState_Following";
import { BotState_Idle } from './state/BotState_Idle';
import { BotState_Lying } from './state/BotState_Lying';
import { BotState_Picking } from './state/BotState_Picking';
import { BotState_StageEnd } from "./state/BotState_StageEnd";
import { is_ray_hit } from "./utils/is_ray_hit";
import { BotTerrain, step_probe_new } from "./terrain/BotTerrain";

export enum BotBehavior {
  Stay = 'Stay',
  Move = 'Move',
  Follow = 'Follow',
}
const NEAR_SCAN_RADIUS = 250;
/** 近处探测距离：查墙、查台阶 */
const PROBE_NEAR = 8;
/** 远处探测距离：只查悬崖、大落差（斜坡的坡度会被误判成墙，所以远处不查 blocked） */
const PROBE_FAR = 28;
/** 允许直接走下去的最大落差；再大就当成深渊，不主动往下跳 */
const MAX_STEP_DOWN = 160;
/** 连续卡住多少帧开始绕行 */
const STUCK_TIME = 8;
/** 连续卡住多少帧尝试起跳爬台 */
const STUCK_CLIMB_TIME = 16;
/** 连续卡住多少帧放弃目标 */
const STUCK_GIVEUP_TIME = 45;
/** 起跳需要保持按跳键的帧数（角色时长决定跳跃高度） */
const JUMP_HOLD_FRAMES = 6;
/** 判定为不可达后，多少帧内不再追同一个目标 */
const UNREACHABLE_COOLDOWN = 120;
/** 尝试爬台时向前探测的距离（身体有宽度，别只探脚底那一点） */
const CLIMB_PROBES = [12, 24, 36] as const;
export class BotController extends BaseController {
  readonly fsm = new FSM<BSE>()
    .add(
      new BotState_Idle(this),
      new BotState_Chasing(this),
      new BotState_Picking(this),
      new BotState_Avoiding(this),
      new BotState_Following(this),
      new BotState_StageEnd(this),
      new BotState_Lying(this),
      new BotState_Dead(this)
    )

  readonly __is_bot_ctrl__ = true;

  /** 追击对象 */
  readonly chasings = new NearestTargets(D.AI_MAX_CHASINGS_ENEMIES);

  /** 躲避对象 */
  readonly avoidings = new NearestTargets(D.AI_MAX_AVOIDING_ENEMIES);

  /** 防御对象  */
  readonly defends = new NearestTargets(D.AI_MAX_DEFENDS_ENEMIES);

  protected _dummy: DummyEnum = DummyEnum.None;

  behavior: BotBehavior = BotBehavior.Move;
  goingto: IVector3 | null = null;
  following: Entity | null = null;
  watching: Entity | null = null;
  en_out_of_range: boolean = false;
  idle_min_x: number = Number.MIN_SAFE_INTEGER;
  idle_max_x: number = Number.MAX_SAFE_INTEGER;
  idle_min_z: number = Number.MIN_SAFE_INTEGER;
  idle_max_z: number = Number.MAX_SAFE_INTEGER;
  protected _bot_id: string | undefined;
  protected _bot: IBotData | undefined;
  protected _dataset = new BotDataSet();
  bot_frame: string | undefined;

  /** 地形探针（世界地形变化后自动跟随） */
  protected _terrain?: BotTerrain;
  /** 连续“想走却没走成”的帧数 */
  protected _stuck_time: number = 0;
  /** 卡住时优先绕行的方向 */
  protected _stuck_side: 1 | -1 = 1;
  /** 爬台尝试的冷却帧数 */
  protected _climb_cd: number = 0;
  /** 跳键还需保持按下的帧数 */
  protected _jump_hold: number = 0;
  /** 暂时判定为不可达的目标 */
  protected _unreachable: Entity | null = null;
  /** 不可达判定的解除时间 */
  protected _unreachable_until: number = 0;
  /** 上次采样的位置，用于判断有没有真的走动 */
  protected _last_x: number = 0;
  protected _last_z: number = 0;
  /** 复用的探测结果对象 */
  private readonly _probe_b = step_probe_new();

  get dummy(): DummyEnum {
    return this._dummy;
  }
  set dummy(v) {
    this.key_up(...Object.values(GK));
    this._dummy = v;
  }
  /** 难度：闯关模式下玩家的队友固定困难，其余跟随世界设置 */
  get difficulty(): Difficulty {
    if (this.world.stage.id !== D.VOID_STAGE.id) {
      for (const [, f] of this.world.puppets)
        if (f !== this.entity && f.team === this.team && is_human_ctrl(f.ctrl))
          return Difficulty.Difficult;
    }
    return this.world.dataset.difficulty;
  }
  get facing() { return this.entity.facing }
  get team(): string { return this.entity.team }
  get me(): Entity { return this.entity }
  get en(): Entity | undefined { return this.chasings.get() }
  get av(): Entity | undefined { return this.avoidings.get() }
  get bot_state(): BSE { return this.fsm.state?.key || BSE.Idle }
  get dataset() { return this._dataset }
  /** 地形探针 */
  get terrain(): BotTerrain {
    return (this._terrain ??= new BotTerrain(this.world));
  }
  /** 地形段之间的可达关系（跳跃/方向移动/坠落） */
  get reach() { return this.terrain.reach; }
  /** 一次跳跃大约能升高多少（留 20% 余量） */
  get jump_reach(): number {
    const vy = this.me.dataset('jump_height') * this.me.dataset('jump_h_f');
    const gravity = this.me.dataset('gravity');
    if (!(vy > 0) || !(gravity > 0)) return 0;
    return (vy * vy) / (2 * gravity) * 0.8;
  }

  get atk_f_x() {
    switch (this.entity.state) {
      case StateEnum.Running: return this.r_atk_x;
      case StateEnum.Dash: return this.d_atk_max_x;
      case StateEnum.Jump: return this.j_atk_x;
    }
    return this.w_atk_f_x;
  }
  get atk_b_x() {
    switch (this.entity.state) {
      case StateEnum.Running: return -8;
      case StateEnum.Dash: return this.d_atk_min_x;
      case StateEnum.Jump: return -8;
    }
    return this.w_atk_b_x;
  }

  /** 地面攻击触发范围X */
  get w_atk_f_x() {
    const en = this.chasings.get();
    if (!en) return 0;
    if (is_weapon(en)) return this.dataset.pick_weapon_f_x;

    const wt = this.entity.holding?.base_type
    if (
      wt === WT.Baseball ||
      wt === WT.Drink
    ) return 800;
    if (
      wt === WT.Stick ||
      wt === WT.Knife
    ) return 90;
    if (
      wt === WT.Heavy
    ) return 200;
    return this.dataset.w_atk_x
  }

  get w_atk_b_x() {
    const en = this.chasings.get();
    if (!en) return 0;
    if (is_weapon(en)) return this.dataset.pick_weapon_b_x;
    return -8; // TODO?
  }

  /** 跑攻触发范围X */
  get r_atk_x() {
    const en = this.chasings.get();
    if (!en) return 0;
    const wt = this.entity.holding?.base_type
    if (
      wt === WT.Baseball ||
      wt === WT.Drink
    ) return 800;
    if (
      wt === WT.Heavy
    ) return 200;

    if (
      wt === WT.Stick ||
      wt === WT.Knife
    ) return 100;
    return this.dataset.r_atk_x;
  }

  /** 冲跳攻触发范围X */
  get d_atk_max_x() {
    const chasing = this.chasings.get();
    if (!chasing) return 0;
    const wt = this.entity.holding?.base_type;
    const sp = this.entity.facing * this.entity.velocity.x * 8
    if (
      wt === WT.Baseball ||
      wt === WT.Drink
    ) return sp + 100;
    if (
      wt === WT.Stick ||
      wt === WT.Knife
    ) return 100;
    return sp + this.dataset.d_atk_max_x;
  }
  get d_atk_min_x() {
    const chasing = this.chasings.get();
    if (!chasing) return 0;
    const wt = this.entity.holding?.base_type;
    if (wt) return 0;
    return this.dataset.d_atk_min_x;
  }


  /** 跳攻触发范围X */
  get j_atk_x() {
    const chasing = this.chasings.get();
    if (!chasing) return 0;
    const wt = this.entity.holding?.base_type;
    if (
      wt === WT.Baseball ||
      wt === WT.Drink
    ) return 200;
    if (
      wt === WT.Stick ||
      wt === WT.Knife
    ) return 110;
    return this.dataset.j_atk_x;
  }

  /** 
   * 站立攻击距离死区
   * 
   * 意味着当 敌人X - 我X < w_atk_m_x 时，Bot应拉开距离
   */
  get w_atk_m_x() {
    return this.entity.holding?.data.base.w_atk_m_x ?? this.dataset.w_atk_m_x
  }

  /**
   * 站立攻击最大距离
   */
  get w_atk_r_x() {
    return this.entity.holding?.data.base.w_atk_r_x ?? this.dataset.w_atk_r_x
  }

  get stage() { return this.world.stage }

  get defend_desire() {
    const d = this.difficulty - 1;
    return round(
      this.dataset.defend_desire_base +
      d * this.dataset.defend_desire_step
    )
  }

  constructor(player_id: string, entity: Entity) {
    super(player_id, entity);
    this.fsm.reset(BSE.Idle);
  }

  override reset(player_id: string, entity: Entity): void {
    super.reset(player_id, entity);
    this.chasings.clear();
    this.avoidings.clear();
    this.defends.clear();
    this.goingto = null;
    this.following = null;
    this.watching = null;
    this.behavior = BotBehavior.Move;
    this.en_out_of_range = false;
    this.idle_min_x = Number.MIN_SAFE_INTEGER;
    this.idle_max_x = Number.MAX_SAFE_INTEGER;
    this.idle_min_z = Number.MIN_SAFE_INTEGER;
    this.idle_max_z = Number.MAX_SAFE_INTEGER;
    this.bot_frame = void 0;
    this._dummy = DummyEnum.None;
    this._bot_id = void 0;
    this._bot = void 0;
    this._terrain = void 0;
    this._stuck_time = 0;
    this._stuck_side = 1;
    this._climb_cd = 0;
    this._jump_hold = 0;
    this._unreachable = null;
    this._unreachable_until = 0;
    this._last_x = entity.position.x;
    this._last_z = entity.position.z;
    this.fsm.reset(BSE.Idle);
  }

  w_atk_too_far(o: Entity) {
    const { w_atk_r_x: atk_r_x } = this;
    const abs_dx = abs(this.me.position.x - o.position.x)
    return atk_r_x > 0 && atk_r_x < abs_dx
  }
  w_atk_too_close(o: Entity) {
    const { w_atk_m_x: atk_m_x } = this;
    const abs_dx = abs(this.me.position.x - o.position.x)
    return atk_m_x > 0 && atk_m_x > abs_dx
  }
  can_back_off(o: Entity) {
    const { x } = this.me.position;
    const { x: en_x } = o.position;
    const abs_dx = abs(x - en_x);
    const [l, r] = this.world.get_bound(this.me);
    const reach = en_x > x ? en_x - l : r - en_x;
    if (reach > this.w_atk_r_x) return true;
    if (this.cornered(o)) return true;
    const atk_m_x = this.w_atk_m_x;
    return atk_m_x > 0 && abs_dx < atk_m_x && reach > atk_m_x;
  }
  cornered(o: Entity) {
    const { x } = this.me.position;
    const { x: en_x } = o.position;
    const abs_dx = abs(x - en_x);
    const atk_m_x = this.w_atk_m_x;
    if (!(atk_m_x > 0) || atk_m_x <= abs_dx) return false;
    const [l, r] = this.world.get_bound(this.me);
    const reach = en_x > x ? en_x - l : r - en_x;
    if (reach > atk_m_x) return false;
    return en_x > x ? x < r : x > l;
  }

  should_run(where: string, target: IVector2Like): -1 | 1 | 0 {
    this.desire(where)
    if (!target) return 0;
    let dx = round(abs(this.entity.position.x - target.x) - this.dataset.r_x_min)
    let should_run = false
    const r_x_r = this.dataset.r_x_max - this.dataset.r_x_min
    if (r_x_r === 0) {
      should_run = this.desire(`${where}1`) < this.dataset.r_x_min;
    } else {
      dx = round(clamp(dx, 0, r_x_r) / r_x_r)
      const min = this.dataset.r_desire_min + (this.dataset.r_desire_max - this.dataset.r_desire_min) * dx
      should_run = this.desire(`${where}#${dx}`) < min;
    }
    if (dx < 0) should_run = false;
    if (!should_run) return 0;
    return this.entity.position.x > target.x ? -1 : 1
  }

  /** 是否已进入目标区域 */
  is_enter_goto_range(entity: Entity): boolean {
    const pos = this.following?.position ?? this.goingto;
    if (!pos) return false
    const { x, z } = entity.position;
    const { x: en_x, z: en_z } = pos
    let offset_x: number = 0;
    let offset_z: number = 0;
    if (this.fsm.state?.key === BSE.Following) {
      offset_x = D.AI_FOLLOWING_RANGE_IN_X
      offset_z = D.AI_FOLLOWING_RANGE_IN_Z
    } else {
      offset_x = D.AI_COME_RANGE_IN_X
      offset_z = D.AI_COME_RANGE_IN_Z
    }
    const bound_l = round(en_x - offset_x);
    const bound_r = round(en_x + offset_x);
    const bound_t = round(en_z - offset_z);
    const bound_b = round(en_z + offset_z);
    return (
      between(x, bound_l, bound_r) &&
      between(z, bound_t, bound_b)
    )
  }

  /** 是否已远离目标区域 */
  is_leave_goto_range(entity: Entity): boolean {
    const pos = this.following?.position ?? this.goingto;
    if (!pos) return false
    const { x, z } = entity.position;
    const { x: en_x, z: en_z } = pos

    let offset_x: number = 0;
    let offset_z: number = 0;
    if (this.fsm.state?.key === BSE.Following) {
      offset_x = D.AI_FOLLOWING_RANGE_OUT_X
      offset_z = D.AI_FOLLOWING_RANGE_OUT_Z
    } else {
      offset_x = D.AI_COME_RANGE_OUT_X
      offset_z = D.AI_COME_RANGE_OUT_Z
    }

    const bound_l = round(en_x - offset_x);
    const bound_r = round(en_x + offset_x);
    const bound_t = round(en_z - offset_z);
    const bound_b = round(en_z + offset_z);
    return !(
      between(x, bound_l, bound_r) &&
      between(z, bound_t, bound_b)
    )
  }

  is_leave_chase_range(target: Entity): boolean {
    const pos = this.following?.position ?? this.goingto;
    if (!pos) return false;

    const { x, z } = target.position;
    const { x: en_x, z: en_z } = pos
    let offset_x: number = 0;
    let offset_z: number = 0;
    if (this.fsm.state?.key === BSE.Following) {
      offset_x = D.AI_FOLLOWING_RANGE_OUT_X
      offset_z = D.AI_FOLLOWING_RANGE_OUT_Z
    } else {
      offset_x = D.AI_COME_RANGE_OUT_X
      offset_z = D.AI_COME_RANGE_OUT_Z
    }
    offset_x += D.AI_STAY_CHASING_RANGE;
    offset_z += D.AI_STAY_CHASING_RANGE;
    const bound_l = round(en_x - offset_x);
    const bound_r = round(en_x + offset_x);
    const bound_t = round(en_z - offset_z);
    const bound_b = round(en_z + offset_z);
    return !(
      between(x, bound_l, bound_r) &&
      between(z, bound_t, bound_b)
    )
  }

  /**
   * 判断是否应该追击某个对象
   *
   * @param {Entity} [e]
   * @return {*}  {boolean}
   * @memberof BotController
   */
  should_chase(e: Entity): boolean {
    if (this.entity.catching)
      return this.entity.catching == e;

    /* 刚判定过“够不着”的目标，先晾一会儿，别一直撞墙 */
    if (e === this._unreachable) {
      if (this.time < this._unreachable_until) return false;
      this._unreachable = null;
    }

    // 正在注视的对象已失效(死亡/消失/回到可追击范围)时置空
    if (this.watching === e) {
      if (!e.mounted || e.hp <= 0 || !this.is_leave_chase_range(e))
        this.watching = null;
    }
    const { entity: me } = this;
    if (!me.mounted) return false
    if (!e.mounted) return false
    if (me.hp <= 0) return false;
    if (e.hp <= 0) return false;
    if (e.bot_ignore == 1) return false;
    if (e == me.holding) return false;
    if (e == me.catching) return true;
    if (me.catching && me.catching.hp > 0) return false;


    const { x: en_x, z: en_z } = e.position;
    const { player_l, player_r } = this.world;
    if (en_x < player_l || en_x > player_r) return false

    if (me.holding?.base_type == WT.Drink) return false;
    if (is_fighter(e) && e.team == this.team) return false;

    const e_state = e.state;
    const [l, r] = this.world.get_bound(me)
    /* 对方的位置，我方无法抵达，故不追之 */
    if (!between(en_x, l, r))
      return false;

    const abs_dx = abs(me.position.x - en_x)
    if (is_weapon(e)) {
      if (this.difficulty === Difficulty.Easy) return false; // 简单难度不拾取任何武器
      if (this.difficulty === Difficulty.Normal && e.base_type === WT.Drink) return false; // 普通难度不拾取饮料
      if (me.holding)
        return false;
      if (abs_dx > D.AI_PICK_WEAPON_RANGE_X) return false;
      if (abs(en_z - me.position.z) > D.AI_PICK_WEAPON_RANGE_Z) return false;
      if (this.is_leave_goto_range(e))
        return false
      do {
        // 队友Bot尽量不喝
        if (this.stage.id === D.VOID_STAGE.id)
          break; // 非闯关
        if (e.base_type !== WT.Drink)
          break; // 非饮料
        if (me.team == this.stage.team)
          break; // 敌人角色
        if (!e.data.base.drink?.hp_h_total)
          return false; // 不补血的不喝
        if (me.hp >= round_float(2 * me.hp_max / 3))
          return false; // 血多的不喝
        if (!this.world.alive_players_count_by_team.get(me.team))
          break; // “大将”已死，挣扎之
        if (this.behavior != BotBehavior.Stay)
          return false; // 仅在Stay喝
        if (abs_dx > 100)
          return false; // 不喝太远的
        // eslint-disable-next-line no-constant-condition
      } while (0);

      if (e_state == StateEnum.Weapon_OnGround)
        return true;
      if (e_state == StateEnum.HeavyWeapon_OnGround)
        return true
      return false;
    }
    if (e_state == StateEnum.Lying)
      return false;
    if (e.invisible) return false
    if (e.invulnerable) return false
    if (!me.is_on_ground) return true

    if (this.is_leave_chase_range(e)) {
      this.watching = e;
      return false
    }
    if (this.bot_state === BSE.Avoiding) {
      // 已拉开一定距离，攻击
      return this.w_atk_too_far(e) || !this.can_back_off(e)
    }

    return !this.w_atk_too_close(e) || !this.can_back_off(e)
  }

  /**
   * 判断是否应该躲避某个对象
   *
   * @param {(Entity | null)} [av]
   * @return {*}  {boolean}
   * @memberof BotController
   */
  should_avoid(av: Entity): boolean {
    const { me } = this;
    if (!me.mounted) return false
    if (this.box_gap(av) > NEAR_SCAN_RADIUS) return false
    if (!av.mounted) return false
    if (me.hp <= 0) return false
    if (av.hp <= 0) return false;
    if (av == me.holding) return false;
    if (av == me.catching) return false;
    const { bot_state } = this
    const ret = bot_state === BSE.Avoiding ?
      !this.is_leave_avoid_zone(av) :
      this.is_enter_avoid_zone(av);

    if (av.state === StateEnum.Lying && av.wakeup_invuln)
      return ret;
    if (av.invulnerable) return ret;
    if (me.holding?.base_type === WT.Drink) return ret;

    // 不再地上
    if (me.ground_y != me.position.y) return false;

    if (bot_state === BSE.Avoiding)
      return this.w_atk_r_x > 0 && !this.w_atk_too_far(av) && this.can_back_off(av)
    return this.w_atk_too_close(av) && this.can_back_off(av)
  }

  /**
   * 是否已离开躲避触发范围
   *
   * @param {Entity} target 躲避对象
   * @returns {boolean} 不需要躲避时，返回true，否则返回false
   */
  is_leave_avoid_zone(target: Entity): boolean {
    const { avoid_out_x, avoid_out_z } = this.dataset;
    const { me } = this
    const abs_x = abs(target.position.x - me.position.x);
    const abs_z = abs(target.position.z - me.position.z);
    return abs_x > avoid_out_x || abs_z > avoid_out_z;
  }

  /**
   * 是否已进入躲避触发范围
   *
   * @param {Entity} target 躲避对象
   * @returns {boolean} 需要躲避时，返回true，否则返回false
   */
  is_enter_avoid_zone(target: Entity): boolean {
    const { avoid_in_x, avoid_in_z } = this.dataset;
    const { me } = this
    const abs_x = abs(target.position.x - me.position.x);
    const abs_z = abs(target.position.z - me.position.z);
    return abs_x < avoid_in_x && abs_z < avoid_in_z;
  }

  /**
   * 判断是否应该防御某个对象
   *
   * @param {(Entity | null)} [e]
   * @return {0|1|2} 
   *    无需防御时，返回0; 
   *    需要防御时，返回1；
   *    威胁无法防御时，返回2；
   * @memberof BotController
   */
  should_defend(e: Entity): 0 | 1 | 2 {
    const { entity: me } = this;
    if (!me.mounted) return 0
    if (this.box_gap(e) > NEAR_SCAN_RADIUS) return 0
    if (!e.mounted) return 0
    if (
      e.invisible ||
      this.entity.toughness ||
      this.entity.invulnerable
    ) return 0

    const { itr: itrs } = e
    do {
      if (is_ball(e))
        break;

      const { state } = e.frame
      if (is_weapon(e)) {
        if (StateEnum.HeavyWeapon_InTheSky == state)
          break;
        if (StateEnum.Weapon_Throwing == state)
          break;
        if (StateEnum.Weapon_OnHand == state && e.bearer?.frame.wpoint?.attacking)
          break;
        return 0;
      }

      if (is_fighter(e)) {
        if (ATTCKING_STATES.some(v => v === state))
          break;
      }
      return 0;
      // eslint-disable-next-line no-constant-condition
    } while (0);


    const hit = is_ray_hit(e, this.entity, {
      x: max(abs(e.velocity.x), 1),
      z: e.velocity.z,
      min_x: -20,
      max_x: max(abs(10 * e.velocity.x), 60),
      min_z: -2 * D.DAFUALT_QUBE_LENGTH,
      max_z: max(abs(10 * e.velocity.z), 2 * D.DAFUALT_QUBE_LENGTH)
    })
    if (!hit) return 0;

    if (itrs?.length) {
      let has_atk_itr_kind = false;
      let just_a_rest = true
      for (const itr of itrs) {
        if (!ATTCKING_ITR_KINDS.some(v => itr.kind === v)) continue;
        has_atk_itr_kind = true;
        if (D.DEFAULT_FORCE_BREAK_DEFEND_VALUE === itr.bdefend) {
          return 2;
        }
        if (itr.vrest) just_a_rest = false
      }
      if (!has_atk_itr_kind) return 0;
      if (just_a_rest && e.arest) return 0;
    }
    return 1;
  }

  box_gap(other: Entity): number {
    return box_gap_xz(this.entity, other)
  }

  /**
   * 朝目标移动一帧（带地形保护）
   *
   * @param rx 目标相对X（已乘朝向；正数=正面）
   * @param rz 目标相对Z（正数=下方）
   * @param x_min 背向死区
   * @param x_max 正向死区
   * @param z_min 上方死区
   * @param z_max 下方死区
   */
  move_to(
    rx: number,
    rz: number,
    x_min: number,
    x_max: number,
    z_min: number,
    z_max: number,
  ): void {
    const forward: 1 | -1 = this.facing > 0 ? 1 : -1;
    const dx: -1 | 0 | 1 = rx < x_min ? (forward > 0 ? -1 : 1) : rx > x_max ? forward : 0;
    const dz: -1 | 0 | 1 = rz < z_min ? -1 : rz > z_max ? 1 : 0;
    this._drive(dx, dz);
  }

  /**
   * 靠近一个世界坐标（带地形保护）
   *
   * @param tx 目标X
   * @param tz 目标Z
   * @param deadzonex 死区
   * @param deadzonez 死区
   */
  walk_toward(tx: number, tz: number, deadzonex: number = 10, deadzonez: number = deadzonex): void {
    const { x, z } = this.me.position;
    const dx: -1 | 0 | 1 = tx > x + deadzonex ? 1 : tx < x - deadzonex ? -1 : 0;
    const dz: -1 | 0 | 1 = tz > z + deadzonez ? 1 : tz < z - deadzonez ? -1 : 0;
    this._drive(dx, dz);
  }

  /**
   * 该方向近处能不能走（墙、悬崖、过大的落差都算不能走）
   *
   * 给躲避、奔跑等自己算方向的逻辑用。
   */
  step_safe(dx: -1 | 0 | 1, dz: -1 | 0 | 1): boolean {
    return this._can_move(dx, dz);
  }

  /**
   * 该方向远处是否有悬崖/过大落差
   *
   * 用于奔跑刹车：跑起来速度快，近处再探就来不及了。
   */
  danger_ahead(dx: -1 | 0 | 1, dz: -1 | 0 | 1): boolean {
    if (!dx && !dz) return false;
    const { position, velocity } = this.me;
    const { x, y, z } = position;
    const dist = max(PROBE_FAR, round((abs(velocity.x) + abs(velocity.z)) * 3));
    const probe = this.terrain.probe(x + dx * dist, z + dz * dist, y, this._probe_b);
    return probe.cliff || probe.dy < -MAX_STEP_DOWN;
  }

  /** 该方向能不能迈一步 */
  private _can_move(dx: -1 | 0 | 1, dz: -1 | 0 | 1): boolean {
    if (!dx && !dz) return true;
    const { x, y, z } = this.me.position;
    return this.terrain.can_step(
      x, z, y, dx, dz,
      PROBE_NEAR, PROBE_FAR, MAX_STEP_DOWN
    );
  }

  /**
   * 输出移动按键；走不动时依次尝试绕行、跳上台阶、放弃目标。
   */
  private _drive(dx: -1 | 0 | 1, dz: -1 | 0 | 1): void {
    const { me } = this;
    if (me.hp <= 0) return;
    const state = me.state;
    /* 受伤、倒地、被击飞时不参与地形判定（但按键照旧输出，保持原有手感） */
    const hurt = (
      state === StateEnum.Injured ||
      state === StateEnum.Lying ||
      state === StateEnum.Falling ||
      state === StateEnum.BrokenDefend
    );

    const { x, z } = me.position;
    /* 只看“朝目标方向”的位移：贴着墙侧滑不算进展，否则永远绕不过去 */
    const moved_x = x - this._last_x;
    const moved_z = z - this._last_z;
    this._last_x = x;
    this._last_z = z;
    if (this._climb_cd > 0) --this._climb_cd;

    const want_x = dx;
    const want_z = dz;
    const on_ground = me.is_on_ground;

    /* 空中不做地形过滤：方向键就是空中操控 */
    let blocked_x = false;
    let blocked_z = false;
    if (on_ground && !hurt) {
      if (dx && !this._can_move(dx, 0)) { dx = 0; blocked_x = true; }
      if (dz && !this._can_move(0, dz)) { dz = 0; blocked_z = true; }
    }

    const can_walk = !hurt && on_ground &&
      (state === StateEnum.Standing || state === StateEnum.Walking);
    const wanted = want_x !== 0 || want_z !== 0;
    const progress = want_x * moved_x + want_z * moved_z;

    if (!wanted || !can_walk) {
      this._stuck_time = 0;
    } else if (blocked_x || blocked_z || progress < 0.05) {
      ++this._stuck_time;
      if (this._stuck_time >= STUCK_GIVEUP_TIME) {
        this._give_up();
      } else {
        if (this._stuck_time >= STUCK_CLIMB_TIME && this._climb_cd <= 0) {
          if (this._try_climb(want_x, want_z)) return;
          this._climb_cd = 20;
        }
        /*
          侧移绕行：只在“不需要对齐 Z”时轻轻挪一下，贴墙找缺口。
          不能压过状态自己的 Z 意愿，否则会和重新对齐打架。
        */
        if (this._stuck_time >= STUCK_TIME && want_z === 0 && !blocked_z) {
          const side = this._pick_side();
          if (this._can_move(0, side)) dz = side;
        }
      }
    } else {
      this._stuck_time = 0;
    }

    if (dx > 0) this.key_down(GK.R).key_up(GK.L);
    else if (dx < 0) this.key_down(GK.L).key_up(GK.R);
    else this.key_up(GK.L, GK.R);

    if (dz > 0) this.key_down(GK.D).key_up(GK.U);
    else if (dz < 0) this.key_down(GK.U).key_up(GK.D);
    else this.key_up(GK.U, GK.D);
  }

  /** 卡住时往哪边绕 */
  private _pick_side(): 1 | -1 {
    const up_ok = this._can_move(0, -1);
    const down_ok = this._can_move(0, 1);
    if (up_ok !== down_ok) return up_ok ? -1 : 1;
    const en = this.chasings.get();
    if (en) return en.position.z >= this.me.position.z ? 1 : -1;
    return this._stuck_side;
  }

  /**
   * 尝试跳上面前（或侧面）比自己高的台子
   *
   * @returns 已经按下起跳键时返回 true
   */
  private _try_climb(dx: -1 | 0 | 1, dz: -1 | 0 | 1): boolean {
    if ((!dx && !dz) || !this.me.is_on_ground) return false;
    const reach = this.jump_reach;
    if (reach <= this.terrain.step) return false;
    const { x, y, z } = this.me.position;

    let top: number | null = null;
    for (const dist of CLIMB_PROBES) {
      top = this.terrain.climbable_top(x + dx * dist, z + dz * dist, y, reach);
      if (top !== null) break;
    }
    if (top === null) return false;

    if (dx > 0) this.key_down(GK.R).key_up(GK.L);
    else if (dx < 0) this.key_down(GK.L).key_up(GK.R);
    if (dz > 0) this.key_down(GK.D).key_up(GK.U);
    else if (dz < 0) this.key_down(GK.U).key_up(GK.D);

    this._jump_hold = JUMP_HOLD_FRAMES;
    this.key_down(GK.j);
    if (this.lfw.mt.debugging) this._case('bot_climb', top, round(top - y));
    return true;
  }

  /** 放弃当前追击目标：短时间内不再把它当目标 */
  private _give_up(): void {
    const en = this.chasings.get();
    if (en) {
      this._unreachable = en;
      this._unreachable_until = this.time + UNREACHABLE_COOLDOWN;
      this.chasings.clear();
      if (this.lfw.mt.debugging) this._case('bot_give_up', en.id);
    }
    this._stuck_time = 0;
    this._climb_cd = 0;
  }

  lookup(other: Entity) {
    const { entity: me } = this;
    if (!me.mounted || !other.mounted) {
      this.avoidings.clear();
      this.chasings.clear();
      this.defends.clear();
      if (other == this.watching)
        this.watching = null;
      return
    }
    if (is_fighter(other)) {
      if (this.entity.is_ally(other)) {
        return;
      }
      if (this.should_avoid(other)) {
        this.avoidings.look(this.entity, other)
        return;
      }
      const dd = this.should_defend(other)
      if (dd) {
        this.defends.look(this.entity, other)
        return;
      }
      if (this.should_chase(other)) {
        this.chasings.look(this.entity, other)
        return;
      }
    } else if (is_weapon(other)) {
      if (this.should_chase(other)) {
        this.chasings.look(this.entity, other)
        return;
      }
      if (this.entity.is_ally(other)) {
        return;
      }
      const dd = this.should_defend(other)
      if (dd) {
        this.defends.look(this.entity, other)
        return;
      }
    } else if (is_ball(other)) {
      if (this.entity.is_ally(other)) {
        return;
      }
      const dd = this.should_defend(other)
      if (dd) {
        this.defends.look(this.entity, other)
        return;
      }
    } else if (
      other.data.id === OID.Criminal &&
      me.team != this.stage.team &&
      !this.world.alive_players_count_by_team.get(me.team)
    ) {
      this.chasings.look(this.entity, other);
    } else {
      this.avoidings.del(t => t === other);
      this.chasings.del(t => t === other);
      this.defends.del(t => t === other)
    }
  }

  /**
   * 预判敌人位置(有点粗暴)
   * @deprecated
   */
  guess_entity_pos(entity: Entity) {
    const { x: px, z: pz, y: py } = entity.position;
    const { x: vx, z: vz, y: vy } = entity.velocity;
    let x = 0;
    let z = 0;
    let y = 0;
    switch (entity.state) {
      case StateEnum.Jump:
        x = round_float(px + 2 * vx);
        z = round_float(pz + 1 * vz);
        y = round_float(py + 2 * vy);
        break;
      case StateEnum.Running:
        x = round_float(px + 2 * vx);
        z = round_float(pz + 1 * vz);
        y = round_float(py + 2 * vy);
        break;
      case StateEnum.Dash:
        x = round_float(px + 3 * vx);
        z = round_float(pz + 1 * vz);
        y = round_float(py + 1 * vy)
        break;
      default:
        x = round_float(px + vx);
        z = round_float(pz + vz);
        y = round_float(py + vy)
        break;
    }
    return { x: px, z: pz, next_x: x, next_z: z, next_y: y };
  }

  /** 
   * 获取随机值, 范围: 0~10000
   * 
   * 设计上，此值应该越小越容易触发动作，
   * 但具体还是需要看使用地方的代码是怎么写的
   * 
   * usage:
   * 
   * if this.desire() < this.jump_desire: 
   *    jump!
   */
  desire(mark: string) {
    this.lfw.mt.mark = mark
    return this.lfw.mt.range(0, D.MAX_AI_DESIRE)
  }

  action_desire(mark: string): number {
    let ret = this.desire(mark); // 默认action设置的desire是crazy的好了。
    for (let i = Difficulty.MAX - this.difficulty; i > 0; --i) {
      this.lfw.mt.mark = mark;
      ret += this.lfw.mt.range(0, ret);
    }
    return ret;
  }

  check_bot(): void {
    const { id: oid } = this.entity.data
    const { bot, bot_id = oid } = this.entity.data.base;
    if (bot && bot === this._bot) return
    if (bot && bot !== this._bot) {
      Object.assign(this.dataset, BotDataSet.Default, bot.dataset)
      this._bot = bot;
      this._bot_id = void 0;
      return;
    }
    if (this._bot_id === bot_id) return
    this._bot_id = bot_id;
    Object.assign(this.dataset, BotDataSet.Default)
    if (!bot_id) return this._bot = void 0;
    this._bot = this.lfw.datas.find_bot(bot_id)
    Object.assign(this.dataset, this._bot?.dataset)
  }

  override update() {
    if (this.lfw.mt.debugging)
      this._case(`bot_update_${this.me.id}_${this.me.name}`)
    this.check_bot();
    if (this._jump_hold > 0) {
      /* 倒地时不按键：起跳保持直接作废 */
      if (this.entity.state === StateEnum.Lying) this._jump_hold = 0;
      else if (--this._jump_hold > 0) this.key_down(GK.j);
      else this.key_up(GK.j);
    }
    if (this.watching?.mounted == 0)
      this.watching = null;
    if (this.dummy) {
      dummy_updaters[this.dummy]?.update(this);
    } else {
      if (this.entity.hp > 0) {
        if (!this.following?.mounted || this.following.hp <= 0)
          this.following = null;
        this.chasings.del(entity => !this.should_chase(entity))
        this.chasings.sort(this.entity)
        this.avoidings.del(entity => !this.should_avoid(entity))
        this.avoidings.sort(this.entity)
        this.defends.del(entity => 1 != this.should_defend(entity))
        this.defends.sort(this.entity)
      } else {
        this.following = null;
        this.chasings.clear()
        this.avoidings.clear()
        this.defends.clear()
      }
      this.bot_frame = void 0;
      this.fsm.update(1)
    }
    if (this.lfw.mt.debugging && this.queue.length)
      this._case(`bot_keys`, this.queue.join(';'))
    const ret = super.update();
    this.clear_single_clicks();
    if (this.lfw.mt.debugging) {
      const a = this.avoidings.targets;
      const c = this.chasings.targets;
      const d = this.defends.targets;
      const msg = '' +
        + `${a.length ? `a=[${a.map(v => v.id).join()}] ` : ''}`
        + `${c.length ? `c=[${c.map(v => v.id).join()}] ` : ''}`
        + `${d.length ? `d=[${d.map(v => v.id).join()}] ` : ''}`
      if (msg) this._case(`bot_target`, msg.trim())
      if (this._stuck_time) this._case(`bot_stuck`, this._stuck_time)
      if (ret.result?.frame) this._case(`bot_nf`, ret.result?.frame.id)
      this._case(`bot_update_end_${this.me.id}_${this.me.name}`)
    }
    if (this.bot_frame) {
      const nf = this.me.get_next_frame({ id: this.bot_frame });
      if (nf) ret.fire2(nf, this.time, '', 'bot')
    }
    return ret;
  }

  /**
   * 清掉没凑成双击的落单按键
   *
   * Bot 动作、走位时会连续"按一下"方向键，这些单击如果跨帧累计，
   * 就会被当成玩家那样的双击(奔跑/翻滚)。真正要双击的地方用 db_hit/dbl_click，
   * 同一帧内就完成了判定，不需要跨帧累计。
   */
  private clear_single_clicks(): void {
    for (const k of AGK)
      if (this.dbc[k].time < 0) this.dbc[k].reset();
  }

  lock_when_stand_and_rest() {
    if (
      this.entity.state === StateEnum.Standing &&
      this.entity.resting <= 0
    ) {
      this.entity.set_position(
        this.world.bg.width / 2,
        null,
        (this.world.bg.near + this.world.far) / 2
      )
      return true;
    }
    return false;
  }

  handle_action(where: string, action: IBotAction | undefined): LGK[] | false | string {
    if (!action) return false
    const { desire: _desire, desire_step = 0, desire_base = 0, keys, frame } = action;
    if (!keys?.length && !frame) return false;
    const action_desire = this.action_desire(`act#${where}#${keys?.join() ?? frame}`);
    const desire = _desire != void 0 ? _desire :
      (desire_base + desire_step * (this.difficulty - 1))
    if (!desire || action_desire > desire) return false;

    const { bot_state } = this;
    if (action.status?.some(v => v === bot_state) === false)
      return false;

    const { me } = this;
    const { e_ray } = action;

    if (e_ray) {
      const { en } = this;
      if (!en || !is_fighter(en)) return false;
      let ray_hit = false
      for (const r of e_ray) {
        ray_hit = is_ray_hit(me, en, r);
        if (ray_hit) break;
      }
      if (!ray_hit) return false;
    }
    const { facing } = this;
    const { judger } = action;
    if (judger && !judger.run(this))
      return false;

    if (frame) return frame;

    const ks = action.keys?.map<LGK>(v => {
      if (v === 'F') return facing > 0 ? GK.R : GK.L;
      if (v === 'B') return facing > 0 ? GK.L : GK.R;
      return v
    })
    return ks ?? false
  }
  /* “指令”系列感觉实现得不太对 -Gim */
  follow(e: Entity): void {
    this.following = e;
    this.goingto = null;
    this.behavior = BotBehavior.Move;
  }
  move(): void {
    this.behavior = BotBehavior.Move;
    this.goingto = null;
    this.following = null;
  }
  stay(): void {
    this.behavior = BotBehavior.Stay;
    this.goingto ??= this.entity.position.clone();
    this.following = null;
  }
  come(x: number, y: number, z: number): void {
    this.goingto = Ditto.vec3(x, y, z)
    this.following = null
  }
  _case(mark: string, ...args: any[]): void {
    this.lfw.mt.mark = mark
    this.lfw.mt.case(...args)
  }
  _false(mark: string, ...args: any[]): false {
    this.lfw.mt.mark = mark
    this.lfw.mt.case(`ret=false`, ...args)
    return false;
  }
  _true(mark: string, ...args: any[]): true {
    this.lfw.mt.mark = mark
    this.lfw.mt.case(`ret=true`, ...args)
    return true;
  }
  update_lookup(me: number, entities: Entity[]): void {
    const self = this.entity;
    let i1 = me - 1;
    let i2 = me + 1;
    const len = entities.length;
    const self_min_x = self.aabb_min_x;
    const self_max_x = self.aabb_max_x;
    let limit = max(this.chase_bound(), NEAR_SCAN_RADIUS);
    let kept_prev = this.chasings.targets.length;

    while (i1 >= 0 || i2 < len) {
      let l: Entity | undefined = entities[i1];
      let r: Entity | undefined = entities[i2];
      if (l && self_min_x - l.aabb_max_x > limit) l = void 0;
      if (r && r.aabb_min_x - self_max_x > limit) r = void 0;
      if (!l && !r) break;
      const e = closer_one(self, l, r);
      if (!e) break;
      if (!e.ghosted) {
        this.lookup(e);
        const kept = this.chasings.targets.length;
        if (kept !== kept_prev) {
          kept_prev = kept;
          const live = this.chase_bound();
          if (live < limit) limit = max(live, NEAR_SCAN_RADIUS);
        }
      }
      if (l === e) --i1;
      if (r === e) ++i2;
    }
  }

  private chase_bound(): number {
    const { chasings } = this;
    if (chasings.targets.length < chasings.max) return Infinity;
    let m = -1;
    for (const t of chasings.targets) {
      const d = box_gap_xz(this.entity, t);
      if (d > m) m = d;
    }
    return m;
  }
}
