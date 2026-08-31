import { FSM } from "../base/FSM";
import { BaseController } from "../controller/BaseController";
import {
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
import { Entity, is_ball, is_fighter, is_weapon } from "../entity";
import { closer_one } from "../helper";
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
import { BotState_StageEnd } from "./state/BotState_StageEnd";
import { is_ray_hit } from "./utils/is_ray_hit";

export enum BotBehavior {
  Stay = 'Stay',
  Move = 'Move',
  Follow = 'Follow',
}
export class BotController extends BaseController {
  readonly fsm = new FSM<BSE>()
    .add(
      new BotState_Idle(this),
      new BotState_Chasing(this),
      new BotState_Avoiding(this),
      new BotState_Following(this),
      new BotState_StageEnd(this),
      new BotState_Dead(this)
    )
    .use(BSE.Idle)

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
  protected _bot_id: string | undefined;
  protected _bot: IBotData | undefined;
  protected _dataset = new BotDataSet();

  get dummy(): DummyEnum {
    return this._dummy;
  }
  set dummy(v) {
    this.key_up(...Object.values(GK));
    this._dummy = v;
  }
  get difficulty(): Difficulty { return this.world.dataset.difficulty }
  get facing() { return this.entity.facing }
  get team(): string { return this.entity.team }
  get me(): Entity { return this.entity }
  get en(): Entity | undefined { return this.chasings.get()?.entity }
  get av(): Entity | undefined { return this.avoidings.get()?.entity }
  get bot_state(): BSE { return this.fsm.state?.key || BSE.Idle }
  get dataset() { return this._dataset }

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
    const en = this.chasings.get()?.entity;
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
    const en = this.chasings.get()?.entity;
    if (!en) return 0;
    if (is_weapon(en)) return this.dataset.pick_weapon_b_x;
    return -8; // TODO?
  }

  /** 跑攻触发范围X */
  get r_atk_x() {
    const en = this.chasings.get()?.entity;
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
    const chasing = this.chasings.get()?.entity;
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
    const chasing = this.chasings.get()?.entity;
    if (!chasing) return 0;
    const wt = this.entity.holding?.base_type;
    if (wt) return 0;
    return this.dataset.d_atk_min_x;
  }


  /** 跳攻触发范围X */
  get j_atk_x() {
    const chasing = this.chasings.get()?.entity;
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
  /** 最近站立攻击距离 */
  get w_atk_m_x() {
    const wt = this.entity.holding?.base_type
    if (
      wt === WT.Baseball ||
      wt === WT.Drink
    ) return 100;
    return this.dataset.w_atk_m_x
  }
  get w_atk_r_x() {
    const wt = this.entity.holding?.base_type
    if (
      wt === WT.Baseball ||
      wt === WT.Drink
    ) return 200;
    return this.dataset.w_atk_r_x
  }
  get stage() { return this.world.stage }

  get defend_desire() {
    const d = this.world.dataset.difficulty - 1
    return round(
      this.dataset.defend_desire_base +
      d * this.dataset.defend_desire_step
    )
  }

  constructor(player_id: string, entity: Entity) {
    super(player_id, entity);
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
    if (e == me.holding) return false;
    if (e == me.catching) return true;
    if (me.catching && me.catching.hp > 0) return false;


    const { x: en_x } = e.position;
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
      if (me.holding)
        return false;
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
        if (!this.world.has_players_alive)
          break; // “大将”已死，挣扎之
        if (this.behavior != BotBehavior.Stay)
          return false; // 仅在Stay喝
        if (abs_dx > 100)
          return false; // 不喝太远的
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
    if (e.blinking) return false
    if (e.invulnerable) return false
    if (!me.is_on_ground) return true

    if (this.is_leave_chase_range(e)) {
      this.watching = e;
      return false
    }
    if (this.bot_state === BSE.Avoiding) {
      // 已拉开一定距离，攻击
      return this.w_atk_too_far(e)
    }

    return !this.w_atk_too_close(e)
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
    if (av.blinking) return ret;
    if (av.invulnerable) return ret;
    if (me.holding?.base_type === WT.Drink) return ret;

    // 不再地上
    if (me.ground_y != me.position.y) return false;

    if (bot_state === BSE.Avoiding)
      return this.w_atk_r_x > 0 && !this.w_atk_too_far(av)
    return this.w_atk_too_close(av)
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
    if (!e.mounted) return 0
    if (
      e.invisible ||
      this.entity.toughness ||
      this.entity.invisible ||
      this.entity.blinking ||
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
        this.defends.look(this.entity, other, dd)
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
        this.defends.look(this.entity, other, dd)
        return;
      }
    } else if (is_ball(other)) {
      if (this.entity.is_ally(other)) {
        return;
      }
      const dd = this.should_defend(other)
      if (dd) {
        this.defends.look(this.entity, other, dd)
        return;
      }
    } else if (
      other.data.id === OID.Criminal &&
      me.team != this.stage.team &&
      !this.world.has_players_alive
    ) {
      this.chasings.look(this.entity, other);
    } else {
      this.avoidings.del(t => t.entity === other);
      this.chasings.del(t => t.entity === other);
      this.defends.del(t => t.entity === other)
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
    if (this.watching?.mounted == 0)
      this.watching = null;
    if (this.dummy) {
      dummy_updaters[this.dummy]?.update(this);
    } else {
      if (this.entity.hp > 0) {
        if (!this.following?.mounted || this.following.hp <= 0)
          this.following = null;
        this.chasings.del(({ entity }) => !this.should_chase(entity))
        this.chasings.sort(this.entity)
        this.avoidings.del(({ entity }) => !this.should_avoid(entity))
        this.avoidings.sort(this.entity)
        this.defends.del(({ entity }) => 1 != this.should_defend(entity))
        this.defends.sort(this.entity)
      } else {
        this.following = null;
        this.chasings.clear()
        this.avoidings.clear()
        this.defends.clear()
      }
      this.fsm.update(1)
    }
    if (this.lfw.mt.debugging)
      if (this.queue.length)
        this._case(`bot_keys`, this.queue.join(';'))
    const ret = super.update();
    if (this.lfw.mt.debugging) {
      const a = this.avoidings.targets;
      const c = this.chasings.targets;
      const d = this.defends.targets;
      const msg = '' +
        + `${a.length ? `a=[${a.map(v => v.entity.id).join()}] ` : ''}`
        + `${c.length ? `c=[${c.map(v => v.entity.id).join()}] ` : ''}`
        + `${d.length ? `d=[${d.map(v => v.entity.id).join()}] ` : ''}`
      if (msg) this._case(`bot_target`, msg.trim())
      if (ret.result?.frame) this._case(`bot_nf`, ret.result?.frame.id)
      this._case(`bot_update_end_${this.me.id}_${this.me.name}`)
    }
    return ret;
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

  handle_action(where: string, action: IBotAction | undefined): LGK[] | false {
    if (!action) return false
    const { desire: _desire, desire_step = 0, desire_base = 0 } = action;
    const action_desire = this.action_desire(`act#${where}#${action.keys.join()}`);
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

    const ks = action.keys.map<LGK>(v => {
      if (v === 'F') return facing > 0 ? GK.R : GK.L;
      if (v === 'B') return facing > 0 ? GK.R : GK.L;
      return v
    })
    return ks;
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
    const x0 = self.position.x;
    let i1 = me - 1;
    let i2 = me + 1;
    const len = entities.length;
    const bound = this.target_dist_bound();
    const prune = bound !== Infinity;

    while (i1 >= 0 || i2 < len) {
      let l: Entity | undefined = entities[i1];
      let r: Entity | undefined = entities[i2];
      if (prune) {
        if (l && x0 - l.position.x > bound) l = void 0;
        if (r && r.position.x - x0 > bound) r = void 0;
      }
      const e = closer_one(self, l, r);
      if (!e) break;
      if (!e.ghosted) this.lookup(e);
      if (l === e) --i1;
      if (r === e) ++i2;
    }
  }

  private target_dist_bound(): number {
    const { chasings, avoidings, defends } = this;
    if (
      chasings.targets.length < chasings.max ||
      avoidings.targets.length < avoidings.max ||
      defends.targets.length < defends.max
    ) return Infinity;
    let m = -1;
    for (const t of chasings.targets) if (t.distance > m) m = t.distance;
    for (const t of avoidings.targets) if (t.distance > m) m = t.distance;
    for (const t of defends.targets) if (t.distance > m) m = t.distance;
    return m;
  }
}
