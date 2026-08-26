import { Factory } from "../Factory";
import { Ground } from "../Ground";
import type { LFW } from "../LFW";
import { World } from "../World";
import { Callbacks } from "../base";
import { Buff } from "../buff/Buff";
import { sus_cases } from "../cases_instances";
import type { Collision } from "../collision/Collision";
import { collision_clone } from "../collision/Collision";
import { BaseController } from "../controller/BaseController";
import { InvalidController } from "../controller/InvalidController";
import {
  Defines,
  EMPTY_FRAME_INFO,
  EntityEnum, EntityGroup, FacingFlag,
  FrameBehavior,
  FrameId,
  GK,
  GONE_FRAME_INFO,
  HitFlag,
  type IArmorInfo,
  type IBdyInfo, type IBounding, type ICpointInfo, type IDeadJoin, type IEntityData,
  type IFrameInfo, type IItrInfo, type INextFrame, type INextFrameResult, type IOpointInfo,
  is_independent, ItrKind, type IVector3,
  type IVector3Like,
  type IVelocityInfo, type IWpointInfo,
  OpointKind, OpointMultiEnum, OpointSpreading,
  SpeedCtrl, SpeedMode,
  StateEnum, type TEntityEnum, type TFace, type TNextFrame,
  WpointKind
} from "../defines";
import type { ITerrainInfo } from "../defines/ITerrainInfo";
import type { IWorldDataset } from "../defines/IWorldDataset";
import { Ditto } from "../ditto";
import { States } from "../state";
import { ENTITY_STATES } from "../state/ENTITY_STATES";
import { State_Base } from "../state/State_Base";
import { abs, clamp, clamp_add, eqlt, find, floor, is_num, max, min, pow, round, round_float } from "../utils";
import { Times } from "../utils/Times";
import { cross_bounding } from "../utils/cross_bounding";
import { is_f_num, is_positive, is_str } from "../utils/type_check";
import { DrinkInfo } from "./DrinkInfo";
import { EnterFrameResult } from "./EnterFrameResult";
import { NSlot, SSlot, from_tri, num_or_null, to_tri } from "./EntitySnapshot";
import type { IEntityCallbacks } from "./IEntityCallbacks";
import { StatBarType } from "./StatBarType";
import { summary_mgr } from "./SummaryMgr";
import { calc_v } from "./calc_v";
import { turn_face } from "./face_helper";
import { is_ball_ctrl, is_fighter, is_human_ctrl } from "./type_check";

export class Entity {
  static readonly TAG: string = 'Entity';
  lfw: LFW;
  world: World;
  id: string = '';
  wait: number = 0;
  variant: number = 0;
  transforms: [IEntityData, IEntityData] | null = null;
  transform_index: number = 0
  protected _lifetime: number = 0;
  protected _spawn_time: number = 0;

  protected _render_effect_time: number = 0;
  protected _outline_color: string = '';
  protected _outline_alpha: number = 0.8;
  protected _outline_width: number = 1;
  protected _outline_enabled: number | null = null;
  protected _mix_color: string = '';
  protected _mix_strength: number = 0;
  protected _greyscale: number = 0;

  readonly prev_position: IVector3 = Ditto.vec3(0, 0, 0);
  readonly position: IVector3 = Ditto.vec3(0, 0, 0);
  readonly prev_velocity: IVector3 = Ditto.vec3(0, 0, 0);
  readonly velocity: IVector3 = Ditto.vec3(0, 0, 0);
  protected readonly _temp_v: IVector3 = Ditto.vec3(0, 0, 0);

  /**
   * 影分身
   */
  protected readonly copies = new Set<string>();
  protected readonly vrests = new Map<string, Collision>();
  readonly blockers = new Map<string, Collision>();
  readonly superpunchs = new Map<string, Collision>();
  readonly callbacks = new Callbacks<IEntityCallbacks>()
  protected readonly _emitters: string[] = [];

  protected _data: IEntityData;
  protected _reserve: number = 0;
  protected _mounted: number = 0;
  protected _ghosted: number = 0;
  protected _landing_frame!: IFrameInfo | null;
  protected readonly _hp_r_tick: Times = new Times();
  protected readonly _mp_r_tick: Times = new Times();
  public drink: DrinkInfo | null = null;
  public fuse_bys: Entity[] | null = null;
  public dismiss_time: number | null = null;
  public dismiss_data: IEntityData | null = null;

  protected _stat_bar_type!: StatBarType | null;
  protected _resting: number = 0;
  protected _resting_max: number | null = null
  protected readonly _resting_tick: Times = new Times();
  protected _toughness: number = 0;
  protected _toughness_max: number = 0;
  protected readonly _toughness_r_tick: Times = new Times();
  protected _toughness_r_value: number = 0;
  protected _toughness_resting: number = 0;
  protected _toughness_resting_max: number = 0;
  protected _fall_value: number = 0;
  protected _fall_value_max: number | null = null
  protected readonly _fall_r_tick: Times = new Times();
  protected _fall_r_value: number = 0;
  protected _defend_value: number = 0;
  protected _defend_value_max: number | null = null
  protected readonly _defend_r_tick: Times = new Times();
  protected _defend_r_value: number = 0;
  protected _healing: number = 0;
  protected _defend_ratio: number | null = null
  public fallinjury: number = 0;
  public throwinjury: number = 0;
  public facing: TFace = 1;
  public frame: Readonly<IFrameInfo> = EMPTY_FRAME_INFO;
  protected _prev_frame: Readonly<IFrameInfo> = EMPTY_FRAME_INFO;
  protected _catching: Entity | null = null;
  protected _catcher: Entity | null = null;
  protected _states: States;
  protected readonly _next_frame_by_id: INextFrame = { id: '' };
  aabb_min_x: number = 0;
  aabb_max_x: number = 0;
  aabb_min_z: number = 0;
  aabb_max_z: number = 0;
  /** 在world中运算，左侧可见长度，用于判断出界 */
  l_len: number = 0;
  /** 在world中运算，右侧可见长度，用于判断出界 */
  r_len: number = 0;
  /**
   * 实体名称
   *
   * @protected
   * @type {string|null}
   */
  protected _name: string | null = null;

  /**
   * 所属队伍
   *
   * @protected
   * @type {string}
   */
  protected _team!: string;
  protected _mp: number = 0;
  protected _mp_max: number = 0;
  protected _hp: number = 0;
  protected _hp_r: number = 0;
  protected _hp_max: number = 0;
  protected _bearer: Entity | null = null;
  protected _holding: Entity | null = null;
  protected _arest: number = 0;
  public motionless: number = 0;
  public shaking: number = 0;

  /**
   * 燃烧/坠落状态中，本次是否已弹跳过（防止重复弹跳）
   */
  public bounced: boolean = false;
  public lying_a_count: number = 0;
  public lying_d_count: number = 0;
  public lying_c_count: number = 0;
  public drop_hurted: boolean = false;

  /**
   * 抓人剩余值
   *
   * 当抓住一个被击晕的人时，此值充满。
   */
  protected _catch_time: number = 0;
  protected _catch_time_max: number | null = null;

  /**
   * 隐身计数，每帧-1
   *
   * @protected
   * @type {number}
   */
  protected _invisible_duration: number = 0;

  /**
   * 无敌时间计数，每帧-1
   *
   * @protected
   * @type {number}
   */
  protected _invulnerable_duration: number = 0;

  /**
   * 闪烁计数，每帧-1
   *
   * @protected
   * @type {number}
   */
  protected _blinking_duration: number = 0;

  /**
   * 闪烁完毕后下一动作
   *
   * @protected
   * @type {string}
   */
  protected _after_blink!: string | null;

  protected _state!: State_Base | null;
  protected _key_role!: boolean | null;
  protected _name_visible!: boolean | null;
  protected _wakeup_invuln!: boolean | null;
  protected _dead_gone!: boolean | null;
  protected _dead_join!: IDeadJoin | null;
  protected _ctrl_visible!: boolean | null;
  protected _ctrl!: BaseController;
  armor!: Readonly<IArmorInfo> | null;
  protected _opoints!: [IOpointInfo, number][];
  private prev_cpoint_a!: ICpointInfo | null;


  /**
   * 最近一次被攻击信息
   *
   * @type {Collision}
   * @memberof Entity
   */
  lastest_collided!: Collision | null;

  /**
   * 当前tick碰撞信息
   *
   * - 会在update后置空
   *
   * @type {Collision[]}
   * @memberof Entity
   */
  readonly collision_list: Collision[] = [];

  /**
   * 当前tick被碰撞信息
   *
   * - 会在update后置空
   *
   * @type {Collision[]}
   * @memberof Entity
   */
  readonly collided_list: Collision[] = [];

  protected _ground_y: number = 0;
  protected _prev_ground_y: number = 0;
  /** 是否在地面上 */
  is_on_ground: boolean = false;

  readonly buffs = new Map<string, Buff>()

  renderer: any;
  puppet: boolean = false;
  jumping = { x: 0, y: 0, z: 0, t: 0 }
  terrain: ITerrainInfo;
  protected _atom_time: number; // 帧时间步长（被 Physics/Recovery/Spawn 子模块访问）


  get lifetime() {
    return this._lifetime
  }
  get render_effect_time() {
    return this._render_effect_time
  }
  get outline_color(): string {
    return this._outline_color || Defines.TeamInfoMap[this.team]?.outline_color || ''
  };
  set outline_color(v: string) { this._outline_color = v; this._render_effect_time++; }
  get outline_alpha(): number { return this._outline_alpha; }
  set outline_alpha(v: number) { this._outline_alpha = v; this._render_effect_time++; }
  get outline_width(): number { return this._outline_width; }
  set outline_width(v: number) { this._outline_width = v; this._render_effect_time++; }
  get outline_enabled(): number | null { return this._outline_enabled ?? this.dataset('outline_enabled'); }
  set outline_enabled(v: number | null) { this._outline_enabled = v; this._render_effect_time++; }
  get mix_color(): string { return this._mix_color; }
  set mix_color(v: string) { this._mix_color = v; this._render_effect_time++; }
  get mix_strength(): number { return this._mix_strength; }
  set mix_strength(v: number) { this._mix_strength = v; this._render_effect_time++; }
  get greyscale(): number { return this._greyscale; }
  set greyscale(v: number) { this._greyscale = v; this._render_effect_time++; }

  get ground_y(): number { return this._ground_y }

  get data(): IEntityData { return this._data };
  get group() { return this._data.base.group };
  get mounted() { return this._mounted }
  get ghosted() { return this._ghosted }
  get reserve(): number { return this._reserve; }
  set reserve(v: number) {
    v = round_float(v);
    const o = this._reserve;
    if (o === v) return;
    this._reserve = v;
    this.callbacks.call("on_reserve_changed", this, v, o);
  }

  get type(): TEntityEnum { return this._data.type; }
  get itr(): IItrInfo[] | undefined { return this.frame.itr; }
  get bdy(): IBdyInfo[] | undefined { return this.frame.bdy; }
  get toughness_resting_max(): number { return this._toughness_resting_max; }
  set toughness_resting_max(v: number) {
    v = round_float(v);
    const o = this._toughness_resting_max;
    if (o === v) return;
    this._toughness_resting_max = v;
  }
  get resting_max(): number {
    return this._resting_max ?? this.world.dataset.resting_max;
  }
  set resting_max(v: number) {
    v = round_float(v);
    const o = this.resting_max;
    if (o === v) return;
    this._resting_max = v;
    this.callbacks.call("on_resting_max_changed", this, v, o);
  }
  get resting() { return this._resting; }
  set resting(v: number) {
    v = round_float(v);
    const o = this._resting;
    if (o === v) return;
    this._resting = v;
    this.callbacks.call("on_resting_changed", this, v, o);
  }
  get fall_value(): number { return this._fall_value; }
  set fall_value(v: number) {
    const o = this._fall_value;
    if (o === v) return;
    this._fall_value = round_float(v);
    if (v < o) {
      this.resting = this.resting_max;
      this.toughness_resting = this.toughness_resting_max;
    }
    this.callbacks.call("on_fall_value_changed", this, v, o);
  }

  get toughness(): number { return this._toughness; }
  set toughness(v: number) {
    v = round_float(v);
    if (v < 0) v = 0;
    const o = this._toughness;
    if (o === v) return;
    this._toughness = v;
    if (v < o) this.toughness_resting = this.toughness_resting_max;
    this.callbacks.call("on_toughness_changed", this, v, o);
  }

  get toughness_max(): number { return this._toughness_max; }
  set toughness_max(v: number) {
    v = round_float(v);
    if (v < 0) v = 0;
    const o = this._toughness_max;
    if (o === v) return;
    this._toughness_max = v;
    this.callbacks.call("on_toughness_max_changed", this, v, o);
  }
  get toughness_resting() { return this._toughness_resting; }
  set toughness_resting(v: number) {
    v = round_float(v);
    const o = this._toughness_resting;
    if (o === v) return;
    this._toughness_resting = v;
  }
  get catch_time_max(): number { return this._catch_time_max ?? this.world.dataset.catch_time_max; }
  set catch_time_max(v: number) {
    v = round_float(v);
    const o = this.catch_time_max;
    if (o === v) return;
    this._catch_time_max = v;
    this.callbacks.call("on_catch_time_max_changed", this, v, o);
  }
  get fall_value_max(): number { return this._fall_value_max ?? this.world.dataset.fall_value_max; }
  set fall_value_max(v: number) {
    v = round_float(v);
    const o = this.fall_value_max;
    if (o === v) return;
    this._fall_value_max = v;
    this.callbacks.call("on_fall_value_max_changed", this, v, o);
  }
  get defend_value(): number { return this._defend_value; }
  set defend_value(v: number) {
    const o = this._defend_value;
    if (o === v) return;
    this._defend_value = round_float(v);
    if (v < o) {
      this.resting = this.resting_max;
      this.toughness_resting = this.toughness_resting_max;
    }
    this.callbacks.call("on_defend_value_changed", this, v, o);
  }
  get defend_value_max(): number { return this._defend_value_max ?? this.world.dataset.defend_value_max }
  set defend_value_max(v: number) {
    v = round_float(v);
    const o = this.defend_value_max;
    if (o === v) return;
    this._defend_value_max = v;
    this.callbacks.call("on_defend_value_max_changed", this, v, o);
  }
  get healing(): number { return this._healing; }
  set healing(v: number) {
    v = round_float(v);
    if (this._hp_r === this._hp) v = 0
    const o = this._healing;
    if (o === v) return;
    this._healing = v;
    this.callbacks.call("on_healing_changed", this, v, o);
  }

  get defend_ratio(): number { return this._defend_ratio ?? this.world.dataset.defend_ratio; }
  set defend_ratio(v: number) {
    v = round_float(v);
    const o = this.defend_ratio;
    if (o === v) return;
    this._defend_ratio = v;
  }


  get stat_bar_type(): number {
    let r = this._stat_bar_type;
    if (r !== null) return r;
    return this.key_role ? StatBarType.Float : StatBarType.None
  }

  set stat_bar_type(v: number) {
    this._stat_bar_type = v;
  }

  get catching() {
    return this._catching;
  }
  get catcher() {
    return this._catcher;
  }
  get bearer(): Entity | null {
    return this._bearer;
  }

  set bearer(v: Entity | null) {
    this.set_bearer(v);
  }

  get holding(): Entity | null {
    return this._holding;
  }

  set holding(v: Entity | null) {
    this.set_holding(v);
  }

  get name(): string {
    if (this._name !== null)
      return this._name;
    const { ctrl } = this;
    if (is_human_ctrl(ctrl))
      return ctrl.player.name || `Player ${ctrl.player.id}`
    return this.data.base.name ?? ''
  }

  set name(v: string | null) {
    if (v === this.name) return;
    const o = this._name;
    this._name = v;
    this.callbacks.call("on_name_changed", this, v || '', o);
  }

  get mp(): number {
    return this._mp;
  }
  set mp(v: number) {
    const o = this._mp;
    v = max(0, v)
    v = round_float(v)
    if (o === v) return;
    this._mp = v
    if (v < o) summary_mgr.get(this.id).mp_usage += o - v;
    if (v < o && !is_independent(this.team)) summary_mgr.get(this.team).mp_usage += o - v;
    this.callbacks.call("on_mp_changed", this, v, o);
    if (o > 0 && v <= 0) {
      const nf = this.frame.on_exhaustion ?? this._data.on_exhaustion;
      if (nf) this.enter_frame(nf);
    }
  }

  get hp_r(): number {
    return this._hp_r;
  }
  set hp_r(v: number) {
    const o = this._hp_r;
    v = max(0, v)
    v = round_float(v)
    if (o === v) return;
    this.callbacks.call("on_hp_r_changed", this, (this._hp_r = v), o);
  }

  get hp(): number {
    return this._hp;
  }
  set hp(v: number) {
    const o = this._hp;
    v = max(0, v)
    v = round_float(v)
    if (o === v) return;
    this._hp = v;
    if (v < o) summary_mgr.get(this.id).hp_lost += o - v;
    if (v < o && !is_independent(this.team)) summary_mgr.get(this.team).hp_lost += o - v;

    this.callbacks.call("on_hp_changed", this, v, o);
    if (is_human_ctrl(this.ctrl) && (o > 0) !== (v > 0))
      this.world.mark_players_alive(this, v > 0);
    if (o > 0 && v <= 0) {
      this.callbacks.call("on_dead", this);
      this._state?.on_dead?.(this);
      if (
        this.state !== StateEnum.Gone &&
        this.frame.id !== FrameId.Gone &&
        this._data.base.brokens?.length
      ) {
        this.apply_opoints(this._data.base.brokens);
        this.play_sound(this._data.base.dead_sounds);
      }
      const nf = this.frame.on_dead ?? this._data.on_dead;
      if (nf) this.enter_frame(nf);
    }

    if (v > this._hp_r) {
      this.hp_r = v
    }
  }
  get mp_max(): number {
    return this._mp_max ?? this.world.dataset.mp_max;
  }
  set mp_max(v: number) {
    const o = this.mp_max;
    v = max(0, v)
    v = round_float(v)
    if (v === o) return;
    this.callbacks.call("on_mp_max_changed", this, (this._mp_max = v), o);
  }

  get hp_max(): number {
    return this._hp_max ?? this.world.dataset.hp_max;
  }
  set hp_max(v: number) {
    const o = this.hp_max;
    v = max(0, v)
    v = round_float(v)
    if (v === o) return;
    this.callbacks.call("on_hp_max_changed", this, (this._hp_max = v), o);
  }

  /**
   * 所属队伍
   *
   * @type {string}
   * @memberof Entity
   */
  get team(): string {
    return this._team;
  }

  /**
   * 所属队伍
   *
   * @type {string}
   * @memberof Entity
   */
  set team(v) {
    if (v == this._team) return;
    const o = this._team;
    this._team = v;
    this.variant = Number(this._team) || 0
    this.callbacks.call("on_team_changed", this, v, o);
    ++this._render_effect_time;
  }

  get src_emitter(): string | undefined { return this._emitters[0] }
  get emitter(): string | undefined { return this._emitters[this.emitters.length - 1] }
  get emitters(): string[] { return this._emitters; }

  /**
   * 闪烁计数
   *
   * @readonly
   * @type {number}
   */
  get blinking() {
    return this._blinking_duration;
  }
  set blinking(v: number) {
    this._blinking_duration = round_float(max(0, v));
  }

  /**
   * 隐身计数
   *
   * @readonly
   * @type {number}
   */
  get invisible() {
    return this._invisible_duration;
  }
  set invisible(v: number) {
    this._invisible_duration = round_float(max(0, v));
  }

  /**
   * 无敌计数
   *
   * @readonly
   * @type {number}
   */
  get invulnerable() {
    return this._invulnerable_duration;
  }
  set invulnerable(v: number) {
    this._invulnerable_duration = round_float(max(0, v));
  }

  get ctrl(): BaseController {
    return this._ctrl;
  }
  set ctrl(v: BaseController | undefined) {
    if (!v) return;
    if (this._ctrl === v) return;
    const prev = this._ctrl
    this._ctrl = v;
    this.callbacks.call('on_ctrl_changed', v, prev, this)
    this.world.mark_players_alive(this, is_human_ctrl(v) && this.hp > 0);
  }
  get key_role(): boolean {
    if (this._key_role !== null) return this._key_role;
    if (this.ctrl.player) return this._key_role = true;
    const { group } = this._data.base
    if (!group?.length) return false;
    for (let i = 0; i < group.length; ++i) {
      if (
        group[i] == EntityGroup.Regular ||
        group[i] == EntityGroup.Boss
      ) return this._key_role = true
    }
    return this._key_role = false;
  }
  set key_role(v: boolean | null) {
    if (this._key_role === v) return;
    this._key_role = v;
  }
  get name_visible(): boolean {
    return this._name_visible ?? this.key_role;
  }
  set name_visible(v: boolean | null) {
    this._name_visible = v;
  }
  /** 是否有起身无敌 */
  get wakeup_invuln(): boolean {
    return this._wakeup_invuln ?? this.key_role
  }
  set wakeup_invuln(v: boolean) {
    this._wakeup_invuln = v;
  }

  get dead_gone(): boolean {
    if (this._dead_gone !== null) return this._dead_gone;
    return !this.key_role;
  }
  set dead_gone(v: boolean | null) {
    if (this._dead_gone === v) return;
    this._dead_gone = v;
  }
  get dead_join() {
    return this._dead_join
  }
  set dead_join(v) {
    this._dead_join = v
  }

  get spawn_time() { return this._spawn_time }
  get gravity(): number {
    const g1 = this._state?.get_gravity?.(this);
    const g2 = this.ctrl.is_end(GK.Defend) ?
      this.dataset('gravity') :
      this.dataset('gravity_d')
    return g1 ?? g2
  }
  get itr_motionless(): number {
    if (this.type === EntityEnum.Ball)
      return this.dataset('ball_itr_motionless')
    return this.dataset('itr_motionless')
  }
  get arest(): number {
    return this._arest;
  }
  set arest(v: number) {
    if (v == this._arest) return;
    this._arest = round_float(v);
  }
  get weight(): number {
    return this.data.base.weight ?? 1;
  }
  get base_type(): number {
    return this.data.base.type ?? 0
  }
  get ctrl_visible(): boolean | null {
    return this._ctrl_visible
  }
  set ctrl_visible(v: boolean | null) {
    this._ctrl_visible = v;
  }
  get state() { return this.frame.state }
  constructor(world: World, data: IEntityData, states: States = ENTITY_STATES) {
    this.world = world;
    this.lfw = world.lfw;
    this._data = data;
    this._states = states;
    this._atom_time = world.dataset.atom_time;
    this.terrain = Ground.horizon;
    this.reset(data, states)
  }
  reset(data: IEntityData, states: States = ENTITY_STATES) {
    let buffs = Array.from(this.buffs.values())
    for (const buf of buffs) buf.del_victims(this.id)
    this.buffs.clear();
    const { world, lfw } = this;
    this.is_on_ground = false;
    this.terrain = Ground.horizon;
    this._data = data;
    this.id = lfw.new_id;
    this.wait = 0;
    this._lifetime = 0;
    this.fallinjury = 0;
    this._ground_y = 0;
    this.variant = 0;
    this.transforms = null;
    this.transform_index = 0;
    this._reserve = 0
    this._mounted = 0;
    this._ghosted = 0;
    this.prev_position.set(
      Number.MIN_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER
    )
    this.position.set(0, 0, 0)
    this.fuse_bys = null;
    this.dismiss_time = null;
    this.dismiss_data = null;
    this.copies.clear()
    this._stat_bar_type = null;
    this._toughness_resting_max = Defines.DEFAULT_TOUGHNESS_RESTING_MAX;
    this._resting_max = data.base.resting_max ?? null;
    this._resting = 0;
    this._toughness = 0;
    this._toughness_max = 0;
    this._toughness_resting = 0;
    this._fall_value_max = data.base.fall_value_max ?? null;
    this._defend_value_max = data.base.defend_value_max ?? null;
    this._defend_ratio = data.base.defend_ratio ?? null;
    this._healing = 0;
    this._catch_time_max = data.base.catch_time_max ?? null;
    this.throwinjury = 0;
    this.facing = 1;
    this.frame = EMPTY_FRAME_INFO;
    this._prev_frame = EMPTY_FRAME_INFO;
    this.set_catching(null)
    this._catcher = null
    this._wakeup_invuln = null;
    this._name_visible = null;
    this._outline_alpha = 0.8;
    this.velocity.set(0, 0, 0)
    this.prev_velocity.set(0, 0, 0);
    this.callbacks.clear();
    this._name = null
    this._team = world.lfw.new_team;
    this._landing_frame = null;
    this._bearer = null;
    this._holding = null;
    this._emitters.length = 0;
    this._arest = 0;
    this.vrests.clear()
    this.blockers.clear()
    this.superpunchs.clear()
    this.motionless = 0;
    this.shaking = 0;
    this.bounced = false;
    this.lying_a_count = 0;
    this.lying_d_count = 0;
    this.lying_c_count = 0;
    this.drop_hurted = false;
    this._states = states;
    this._hp_r_tick.max = this.dataset('hp_r_ticks')
    this._hp_r_tick.value = 0;

    this._mp_r_tick.max = this.dataset('mp_r_ticks')
    this._mp_r_tick.value = 0;

    this._fall_r_tick.max = this.dataset('fall_r_ticks')
    this._fall_r_tick.value = 0;

    this._defend_r_tick.max = this.dataset('defend_r_ticks');
    this._defend_r_tick.value = 0;

    this._toughness_r_value = this.dataset('toughness_r_value');
    this._defend_r_value = this.dataset('defend_r_value');
    this._fall_r_value = this.dataset('fall_r_value');

    this._hp_max = this.dataset('hp_max');
    this._mp_max = this.dataset('mp_max');
    this._defend_ratio = data.base.defend_ratio ?? null
    this.jumping.x = 0
    this.jumping.y = 0
    this.jumping.z = 0
    this.jumping.t = 0
    this._ctrl = new InvalidController("", this);
    this.reset_armor();

    this.fall_value = this.fall_value_max;
    this.defend_value = this.defend_value_max;
    this._hp = this._hp_r = this.hp_max;
    this._mp = this.mp_max;
    this.set_catch_time(this.catch_time_max)
    this._invisible_duration = 0;
    this._invulnerable_duration = 0;
    this._blinking_duration = 0;
    this._after_blink = null;
    this._state = null;
    this._key_role = null;
    this._dead_gone = null;
    this._dead_join = null;
    this._ctrl_visible = null;
    this.drink = data.base.drink ? new DrinkInfo(data.base.drink) : null
    this._opoints = [];
    this.prev_cpoint_a = null;
    this.collision_list.length = 0;
    this.collided_list.length = 0;
    this.lastest_collided = null;
    this._outline_color = '';
    this._outline_alpha = 0.8;
    this._outline_width = 1;
    this._outline_enabled = null;
    this._mix_color = '';
    this._mix_strength = 0;
    this._greyscale = 0;
    this._render_effect_time = 0;
  }
  reset_armor() {
    const { armor } = this._data.base
    this.armor = armor || null;
    this.toughness = this.toughness_max = armor?.toughness ?? 0;
    this.toughness_resting = 0;
    this.toughness_resting_max = armor?.toughness_resting ?? 0;
    this._toughness_r_value = armor?.toughness_r_value ?? this.dataset('toughness_r_value')
    this._toughness_r_tick.max = armor?.toughness_r_tick ?? this.dataset('toughness_r_tick');
    this._toughness_r_tick.value = 0;
  }

  set_catching(v: Entity | null): this {
    if (this._catching === v) return this;
    this._catching = v;
    return this;
  }
  add_catch_time(value: number): this {
    if (!value) return this;
    return this.set_catch_time(this._catch_time + value);
  }
  set_catch_time(value: number): this {
    const v = round_float(value)
    if (this._catch_time == v) return this;
    this._catch_time = clamp(v, 0, this.catch_time_max);
    return this;
  }
  set_bearer(v: Entity | null): this {
    if (this._bearer === v) return this;
    const old = this._bearer;
    this._bearer = v;
    this.callbacks.call("on_holder_changed", this, v, old);
    return this;
  }

  set_holding(v: Entity | null): this {
    if (this._holding === v) return this;
    const old = this._holding;
    this._holding = v;
    this.callbacks.call("on_holding_changed", this, v, old);
    return this;
  }

  find_auto_frame(): IFrameInfo {
    return (
      this._state?.get_auto_frame?.(this) ?? this._data.frames["0"] ?? this.frame
    );
  }

  on_spawn(
    emitter: Entity,
    opoint: IOpointInfo,
    offset_velocity: IVector3 = Ditto.vec3(0, 0, 0),
    facing: TFace = emitter.facing,
  ): this {
    const emitter_frame = emitter.frame;
    if (emitter.state === StateEnum.Ball_Rebounding) {
      const attacker = emitter.lastest_collided?.attacker ?? emitter;
      this._emitters[0] = attacker.id;
      this._emitters.length = 1;
      this.team = attacker.team;
      this.facing = emitter.facing;
    } else {
      this._emitters.push(...emitter.emitters, emitter.id);
      this.team = emitter.team;
      this.facing = emitter.facing;
    }
    const { pos_type } = opoint;
    let { x: pos_x, y: pos_y, z: pos_z } = emitter.position;
    const opoint_y = (opoint.__gen_y ? opoint.__gen_y.get(emitter) : opoint.y) ?? 0;
    const opoint_x = (opoint.__gen_x ? opoint.__gen_x.get(emitter) : opoint.x) ?? 0;
    const opoint_z = (opoint.__gen_z ? opoint.__gen_z.get(emitter) : opoint.z) ?? 2;


    if (pos_type === 1) {
      pos_y = pos_y - opoint_y;
      pos_x = pos_x + emitter.facing * opoint_x;
    } else {
      pos_y = pos_y + emitter_frame.centery - opoint_y;
      pos_x = pos_x - emitter.facing * (emitter_frame.centerx - opoint_x);
    }
    this.prev_position.copy(emitter.position);
    this.set_position(pos_x, pos_y, pos_z + opoint_z);

    const result = this.get_next_frame(opoint.action);
    facing = result?.which.facing
      ? this.handle_facing_flag(result.which.facing)
      : emitter.facing;

    if (result) this.enter_frame(result.which);
    else this.enter_frame(Defines.NEXT_FRAME_AUTO);

    let { speedz: o_speedz = this.get_opoint_speed_z(emitter, opoint) } = opoint;
    let o_dvx = (opoint.__gen_dvx ? opoint.__gen_dvx.get(emitter) : opoint.dvx) ?? 0
    let o_dvy = (opoint.__gen_dvy ? opoint.__gen_dvy.get(emitter) : opoint.dvy) ?? 0
    let o_dvz = (opoint.__gen_dvz ? opoint.__gen_dvz.get(emitter) : opoint.dvz) ?? 0

    const { weight } = this;
    o_dvy = o_dvy / weight;
    const ud = is_fighter(emitter) ? emitter.ctrl.UD : 0;
    const { x: ovx, y: ovy, z: ovz } = offset_velocity;
    if (o_dvx > 0) o_dvx = o_dvx / weight - abs(ovz / 2);
    else o_dvx = o_dvx / weight + abs(ovz / 2);

    if (is_num(opoint.max_hp))
      this.hp = this.hp_r = this.hp_max = opoint.max_hp;
    if (is_num(opoint.hp)) this.hp = this.hp_r = opoint.hp;
    if (is_num(opoint.max_mp)) this.mp = this.mp_max = opoint.max_mp;
    if (is_num(opoint.mp)) this.mp = opoint.mp;

    const { dvy = 0, dvz = 0, dvx = 0 } = this;
    const {
      vxm,
      vym,
      vzm,
      acc_x = 0,
      acc_y = 0,
      acc_z = 0,
    } = this.frame;
    const z_disabled =
      result?.frame?.state === StateEnum.Normal ||
      result?.frame?.state === StateEnum.Burning;

    let vx = ovx + o_dvx * facing;
    let vy = ovy + o_dvy + dvy;
    let vz = z_disabled ? 0 : ovz + o_dvz + o_speedz * ud;
    if (vxm === SpeedMode.Fixed) vx = dvx;
    if (vym === SpeedMode.Fixed) vy = dvy;
    if (vzm === SpeedMode.Fixed) vz = dvz;
    if (vxm == SpeedMode.Extra && acc_x) vx += acc_x;
    if (vym == SpeedMode.Extra && acc_y) vy += acc_y;
    if (vzm == SpeedMode.Extra && acc_z) vz += acc_z;

    this.prev_velocity.x = this.velocity.x = round_float(vx);
    this.prev_velocity.y = this.velocity.y = round_float(vy);
    this.prev_velocity.z = this.velocity.z = round_float(vz);
    switch (opoint.kind) {
      case OpointKind.Pick:
        emitter.drop_holding();
        this.bearer = emitter;
        this.bearer.holding = this;
        break;
    }
    this.motionless = opoint.motionless ?? 2;
    return this;
  }
  get_opoint_speed_z(emitter: Entity, opoint: IOpointInfo): number {
    if (opoint.speedz !== void 0) return opoint.speedz;
    if (!is_fighter(emitter)) return 0;
    switch (this.state) {
      case StateEnum.Ball_Flying:
      case StateEnum.Ball_3006:
      case StateEnum.Weapon_Throwing:
      case StateEnum.HeavyWeapon_InTheSky:
        return Defines.DEFAULT_OPOINT_SPEED_Z;
    }
    return 0;
  }

  set_state(state_code: number): void {
    const v = this._states.get(state_code) || this._states.fallback(this._data.type, state_code);
    if (this._state === v) return;
    this._state?.leave?.(this, this.frame);
    this._state = v || null;
    this._state?.enter?.(this, this.get_prev_frame());
  }

  set_frame(v: IFrameInfo) {
    if (v.id === GONE_FRAME_INFO.id) {
      this._opoints.length = 0
    } else {
      for (let i = 0; i < this._opoints.length; ++i) {
        const { interval_mode, interval_id } = this._opoints[i]![0];
        if (interval_mode === 1) {
          const exists = !!find(v.opoint, o => o.interval_id === interval_id)
          if (!exists) {
            this._opoints.splice(i, 1)
            --i
          }
        } else {
          this._opoints.splice(i, 1)
          --i
        }
      }
    }
    this._prev_frame = this.frame;
    this._landing_frame = null;
    this.frame = v;
    if (!v.itr?.length) this.arest = 0
    const prev_state_code = this._prev_frame.state;
    const next_state_code = this.state;
    if (prev_state_code !== next_state_code) {
      this.set_state(next_state_code)
    }
    if (v.invisible) this.invisibility(v.invisible);
    if (v.opoint) this.apply_opoints(v.opoint);
    if (!v.cpoint) {
      this.set_catching(null);
      this._catcher = null;
    }
    if (v.broadcasts?.length)
      for (const m of v.broadcasts)
        this.lfw.broadcast(m)
    this.holding?.follow_bearer();
    this.catching?.follow_catcher();
  }

  apply_opoints(opoints: IOpointInfo[]): void {
    for (const opoint of opoints) {
      const { interval = 0, interval_id, interval_mode } = opoint;
      const interval_info = this._opoints.find(
        (v) => v[0].interval_id === interval_id,
      );
      if (interval_info && interval_mode === 1) {
        if (interval_info[1] !== opoint.interval) continue;
      } else if (interval > 0) {
        this._opoints.push([opoint, 0]);
      }
      let enemies: ReadonlyArray<Entity> = [];
      let allies: ReadonlyArray<Entity> = [];
      let multi_type: OpointMultiEnum | undefined = void 0;
      let count = 0;
      const multi = opoint.multi ?? 1;
      if (is_num(multi)) {
        count = multi;
      } else if (multi) {
        const { type, min = 0, max = 355, skip_zero } = multi;
        switch ((multi_type = type)) {
          case OpointMultiEnum.AccordingEnemies:
            enemies = this.world.list_entities(`ef_${this.team}`, (o) => is_fighter(o) && this.team != o.team && o.hp > 0);
            if (skip_zero && !enemies.length) break;
            count = clamp(enemies.length, min, max);
            break;
          case OpointMultiEnum.AccordingAllies:
            allies = this.world.list_entities(`af_${this.team}`, (o) => {
              if (!is_fighter(o)) return false;
              if (this.team != o.team) return false;
              if (o.hp <= 0) return false;
              if (o == this) return false;
              if (o.id == this.src_emitter) return false;
              return true
            });
            if (skip_zero && !allies.length) break;
            count = clamp(allies.length, min, max);
            break;
          case OpointMultiEnum.Emitter:
            const { emitter } = this;
            if (!emitter) break;
            const e = this.world.find_entity(emitter);
            if (!e) break;
            allies = [e];
            count = 1;
            break;
        }
      }
      let facing = this.facing;
      for (let i = 0; i < count; ++i) {
        const v = Ditto.vec3(0, 0, 0);
        switch (opoint.spreading) {
          case void 0:
          case OpointSpreading.Normal:
            v.z = (i - (count - 1) / 2) * 2.5;
            break;
          case OpointSpreading.Spreading:
            if (opoint.__spreading_random_x)
              v.x = opoint.__spreading_random_x.get();
            if (opoint.__spreading_random_y)
              v.y = opoint.__spreading_random_y.get();
            if (opoint.__spreading_random_z)
              v.z = opoint.__spreading_random_z.get();
            facing = v.x < 0 ? -1 : v.x > 0 ? 1 : facing;
            break;
        }
        const e = this.spawn_entity(opoint, v, facing);
        if (!e) return;
        switch (opoint.spreading) {
          case OpointSpreading.FloatRange: {
            const { x, y, z } = e.velocity;
            this.lfw.mt.mark = "ao_x";
            const xx = opoint.__spreading_random_x?.get() ?? x;
            this.lfw.mt.mark = "ao_y";
            const yy = opoint.__spreading_random_y?.get() ?? y;
            this.lfw.mt.mark = "ao_z";
            const zz = opoint.__spreading_random_z?.get() ?? z;
            e.set_velocity(xx, yy, zz);
            break;
          }
        }
        switch (multi_type) {
          case OpointMultiEnum.AccordingEnemies:
            if (is_ball_ctrl(e.ctrl))
              e.ctrl.chasing = enemies[i % enemies.length];
            break;
          case OpointMultiEnum.AccordingAllies:
            if (is_ball_ctrl(e.ctrl))
              e.ctrl.chasing = allies[i % allies.length];
            break;
          case OpointMultiEnum.Emitter:
            if (is_ball_ctrl(e.ctrl))
              e.ctrl.chasing = allies[0];
            break;
        }
        if (opoint.inherit_speed_x)
          e.set_velocity_x(e.velocity.x + this.velocity.x * opoint.inherit_speed_x);
        if (opoint.inherit_speed_y)
          e.set_velocity_y(e.velocity.y + this.velocity.y * opoint.inherit_speed_y);
        if (opoint.inherit_speed_z)
          e.set_velocity_z(e.velocity.z + this.velocity.z * opoint.inherit_speed_z);
      }
    }
  }

  spawn_entity(
    opoint: IOpointInfo,
    offset_velocity: IVector3 = Ditto.vec3(0, 0, 0),
    facing: TFace = this.facing,
  ): Entity | undefined {
    if (opoint.unimportant && this.world.entities.length > 355) return void 0;
    this.lfw.mt.mark = "se_1";
    const oid = this.lfw.mt.pick(opoint.oid);
    if (!oid) {
      Ditto.warn(
        `[Entity::spawn_object] failed, oid: ${oid}, opoint: `,
        opoint,
      );
      return;
    }
    const data = this.lfw.datas.find(oid);
    if (!data) {
      Ditto.warn(
        `[Entity::spawn_object] failed, oid: ${oid}, data: `,
        data,
        ` opoint: `,
        opoint,
      );
      debugger;
      return;
    }
    const entity = this.lfw.factory.create_entity(this.world, data);
    if (!entity) {
      Ditto.warn(
        `[Entity::spawn_object] failed, oid: ${oid}, data: `,
        data,
        ` opoint: `,
        opoint,
      );
      debugger;
      return;
    }
    entity.ctrl =
      this.lfw.factory.create_ctrl(entity._data.id, "", entity) ?? entity.ctrl;
    entity
      .on_spawn(this, opoint, offset_velocity, facing)
      .attach(opoint.ghost);
    if (entity.data.id === this.data.id) this.copies.add(entity.id);
    entity.key_role = false;
    entity.dead_gone = true;
    for (const [, v] of this.vrests) entity.add_v_rest(collision_clone(v));

    return entity;
  }

  attach(ghost = false): this {
    this._spawn_time = this.world.game_time;
    this._mounted = 1;
    this._ghosted = ghost ? 1 : 0;
    this.world.add_entities(this);

    this.set_state(this.frame.state)

    this.set_position(this.position.x, this.position.y, this.position.z)
    if (this.position.y > this.ground_y) this.leave_ground();
    else this.is_on_ground = true;
    if (this.frame.id == FrameId.None)
      this.enter_frame(Defines.NEXT_FRAME_AUTO);

    return this;
  }

  /**
   * 实体响应地面速度衰减（x轴方向与z轴方向的速度）的衰减
   *
   * 速度衰减逻辑如下，
   * - ```v *= 当前衰减系数*世界摩擦系数```
   * - ```v -= 世界摩擦力（使v向0的方向变化，直至归0）```
   *
   * 以下情况不响应:
   * - 实体处于地面以上(不含地面，即：position.y > ground_y）
   * - 角色处于shaking中（即实体被某物击中, see IItrInfo.shaking）
   * - 角色处于motionless中，（即实体击中某物时, see IItrInfo.motionless）
   *
   * @see {IItrInfo.shaking} 目标停顿值
   * @see {IItrInfo.motionless} 自身停顿值
   * @see {World.friction_factor} 世界摩擦系数
   * @see {World.friction} 世界摩擦力
   *
   * @param {number} [factor=1] 当前衰减系数
   */
  handle_ground_velocity_decay(factor: number = 1): void {
    if (
      this.position.y > this.ground_y ||
      this.shaking ||
      this.motionless
    )
      return;
    const landing = this._landing_frame === this.frame;
    factor *=
      landing
        ? this.dataset("land_friction_factor")
        : this.dataset("friction_factor");
    const fx = landing
      ? this.dataset("land_friction_x")
      : this.dataset("friction_x");
    const fz = landing
      ? this.dataset("land_friction_z")
      : this.dataset("friction_z");
    this.handle_velocity_decay(fx, fz, factor);
  }

  handle_velocity_decay(accx: number, accz: number = accx, factor: number = 1): void {
    let { x, z } = this.velocity;
    const { atom_time } = this.world.dataset;
    x = round_float(x * pow(factor, atom_time));
    z = round_float(z * pow(factor, atom_time));
    accx = round_float(accx * atom_time);
    accz = round_float(accz * atom_time);
    const { ctrl_x, ctrl_z } = this.frame;
    let { dvx = 0, dvz = 0 } = this;
    const { UD, LR } = this.ctrl;
    if (ctrl_x && !LR) dvx = 0;
    if (ctrl_z && !UD) dvz = 0;
    if (x > dvx) {
      x -= accx;
      if (x < dvx) x = dvx;
    } else if (x < -dvx) {
      x += accx;
      if (x > -dvx) x = -dvx;
    }
    if (z > dvz) {
      z -= accz;
      if (z < dvz) z = dvz;
    } else if (z < -dvz) {
      z += accz;
      if (z > -dvz) z = -dvz;
    }
    this.set_velocity_x(x);
    this.set_velocity_z(z);
  }

  handle_gravity(): void {
    if (this.bearer || this.catcher || this.shaking || this.motionless) return;
    const { gravity_enabled = true } = this.frame;
    if (this.position.y <= this.ground_y || !gravity_enabled) return;
    this.velocity.y = round_float(
      this.velocity.y - this.gravity * this._atom_time,
    );
  }
  get dvx(): number | undefined {
    const { dvx: v } = this.frame;
    return v ? v * (this.dataset("fvx_f") as number) : v;
  }
  get dvy(): number | undefined {
    const { dvy: v } = this.frame;
    return v ? v * (this.dataset("fvy_f") as number) : v;
  }
  get dvz(): number | undefined {
    const { dvz: v } = this.frame;
    return v ? v * (this.dataset("fvz_f") as number) : v;
  }
  update_velocity(vinfo: IVelocityInfo): void {
    if (this.bearer || this.catcher || this.shaking || this.motionless) return;
    const { atom_time } = this.world.dataset;

    let { dvx, dvy, dvz } = vinfo;
    if (dvx) dvx = round_float(dvx * this.dataset("fvx_f"));
    if (dvy) dvy = round_float(dvy * this.dataset("fvy_f"));
    if (dvz) dvz = round_float(dvz * this.dataset("fvz_f"));
    let {
      vxm = SpeedMode.Default,
      vym = SpeedMode.AccTo,
      vzm = SpeedMode.Default,
      acc_x,
      acc_y,
      acc_z,
      ctrl_x = 0,
      ctrl_y = 0,
      ctrl_z = 0,
    } = vinfo;

    if (
      (vxm == SpeedMode.AccTo || vxm == SpeedMode.FixedAccTo) &&
      acc_x == void 0 &&
      dvx
    )
      acc_x = dvx;
    if (
      (vym == SpeedMode.AccTo || vym == SpeedMode.FixedAccTo) &&
      acc_y == void 0 &&
      dvy
    )
      acc_y = dvy;
    if (
      (vzm == SpeedMode.AccTo || vzm == SpeedMode.FixedAccTo) &&
      acc_z == void 0 &&
      dvz
    )
      acc_z = dvz;
    if (acc_x) acc_x = round_float(acc_x * atom_time);
    if (acc_y) acc_y = round_float(acc_y * atom_time);
    if (acc_z) acc_z = round_float(acc_z * atom_time);

    let { x: vx, y: vy, z: vz } = this.velocity;
    const { UD, LR, jd } = this._ctrl;
    const { facing } = this;
    if (dvx == void 0) {
      /* noop */
    } else if (!ctrl_x) vx = calc_v(vx, dvx, vxm, acc_x, facing);
    else if (LR != 0 && SpeedCtrl.Control == ctrl_x)
      vx = calc_v(vx, dvx, vxm, acc_x, LR);
    else if (LR != 0 && SpeedCtrl.Enable == ctrl_x)
      vx = calc_v(vx, dvx, vxm, acc_x, 1);
    else if (LR == 0 && SpeedCtrl.Disable == ctrl_x)
      vx = calc_v(vx, dvx, vxm, acc_x, 1);

    if (dvy == void 0) {
      /* noop */
    } else if (!ctrl_y) vy = calc_v(vy, dvy, vym, acc_y, 1);
    else if (jd != 0 && SpeedCtrl.Control == ctrl_y)
      vy = calc_v(vy, dvy, vym, acc_y, jd);
    else if (jd != 0 && SpeedCtrl.Enable == ctrl_y)
      vy = calc_v(vy, dvy, vym, acc_y, 1);
    else if (jd == 0 && SpeedCtrl.Disable == ctrl_y)
      vy = calc_v(vy, dvy, vym, acc_y, 1);

    if (dvz == void 0) {
      /* noop */
    } else if (!ctrl_z) vz = calc_v(vz, dvz, vzm, acc_z, 1);
    else if (UD != 0 && SpeedCtrl.Control == ctrl_z)
      vz = calc_v(vz, dvz, vzm, acc_z, UD);
    else if (UD != 0 && SpeedCtrl.Enable == ctrl_z)
      vz = calc_v(vz, dvz, vzm, acc_z, 1);
    else if (UD == 0 && SpeedCtrl.Disable == ctrl_z)
      vz = calc_v(vz, dvz, vzm, acc_z, 1);

    this.velocity.x = round_float(vx);
    this.velocity.y = round_float(vy);
    this.velocity.z = round_float(vz);
  }

  dismiss_fusion(frame_id: string): void {
    if (!this.fuse_bys?.length) return;
    const size = this.fuse_bys.length + 1;
    const hp = round(this.hp / size);
    const hp_r = round(this.hp_r / size);
    const mp = round(this.mp / size);
    let facing = this.facing;
    this.hp = hp;
    this.mp = mp;
    this.hp_r = hp_r;
    for (const fighter of this.fuse_bys) {
      fighter.hp = hp;
      fighter.mp = mp;
      fighter.hp_r = hp_r;
      fighter.facing = facing = turn_face(facing);
      fighter.enter_frame_by_id(frame_id, true);
      fighter.invisible = fighter.motionless = fighter.invulnerable = 0;
    }
    if (this.dismiss_data) this.transform(this.dismiss_data);
    this.enter_frame_by_id(frame_id, true);
    this.dismiss_time = null;
    this.dismiss_data = null;
    this.fuse_bys = null;
  }

  find_align_frame(
    frame_id: string,
    src: string[] | undefined | null,
    dst: string[] | undefined | null
  ): INextFrame {
    if (dst?.length && src?.length) {
      const src_idx = src.indexOf(frame_id);
      const dst_idx = (src_idx + 1) % dst.length;
      return { id: dst[dst_idx] };
    } else if (dst?.length) {
      return { id: dst[0] };
    } else {
      return this.find_auto_frame();
    }
  }
  toughness_recovering(): void {
    if (this.toughness_resting > 0) {
      if (!this.frame.toughness_recover)
        return
      this.toughness_resting = clamp_add(
        this.toughness_resting,
        -this._atom_time,
        0,
        this._toughness_resting_max,
      );
      return;
    }

    if (this.toughness >= this.toughness_max) return;
    if (!this._toughness_r_tick.add(this._atom_time)) return;
    this.toughness = clamp_add(this.toughness, this._toughness_r_value, 0, this._toughness_max);
  }

  fall_value_recovering(): void {
    if (this.fall_value >= this.fall_value_max) return;
    if (!this._fall_r_tick.add(this._atom_time)) return;
    this.fall_value = clamp_add(this.fall_value, this._fall_r_value, 0, this.fall_value_max,);
  }
  defend_value_recovering(): void {
    if (this.defend_value >= this.defend_value_max) return;
    if (!this._defend_r_tick.add(this._atom_time)) return;
    this.defend_value = clamp_add(
      this.defend_value,
      this._defend_r_value,
      0,
      this.defend_value_max,
    );
  }

  stat_recovering(): void {
    if (this.resting > 0) {
      if (!this.frame.stat_recover) return;
      this.resting = clamp_add(this.resting, -this._atom_time, 0, this.resting_max);
      return;
    }
    this.fall_value_recovering();
    this.defend_value_recovering();
  }

  drop_holding(): void {
    if (!this.holding) return;
    this.lfw.mt.mark = "dh_1";
    const { holding } = this;
    holding.bearer = null;
    this.holding = null;

    const on_hands = holding.data.indexes?.on_hands;
    const in_the_skys = holding.data.indexes?.in_the_skys

    const nf = this.find_align_frame(
      holding.frame.id,
      on_hands,
      in_the_skys,
    ) ?? {
      id: FrameId.Auto,
    };
    holding.enter_frame(nf);
    holding.set_position(
      holding.position.x,
      holding.position.y,
      holding.position.z
    );
    holding.team = this.team;
    /*
    避免掉落的武器能被相同攻击对象立刻打中
    */
    for (const [, v] of this.vrests) holding.add_v_rest(collision_clone(v));
  }

  hp_recovering(): void {
    if (this._hp <= 0 || this._hp >= this._hp_r) return;
    this._hp_r_tick.max =
      this.healing > 0
        ? this.dataset("hp_healing_ticks")
        : this.dataset("hp_r_ticks");
    if (!this._hp_r_tick.add(this._atom_time)) return;
    const value =
      this.healing > 0
        ? this.dataset("hp_healing_value")
        : this.dataset("hp_r_value");
    this.hp = min(this._hp_r, this._hp + value);
    if (this._hp === this._hp_r) this.healing = 0;
    else if (this._healing) this.healing = max(0, this._healing - value);
  }

  mp_recovering(): void {
    if (
      this._hp <= 0 ||
      this._mp >= this.mp_max ||
      this._blinking_duration ||
      this._invisible_duration
    )
      return;
    this._mp_r_tick.max = this.dataset("mp_r_ticks");
    if (!this._mp_r_tick.add(this._atom_time)) return;
    const r_ratio = this.dataset("mp_r_ratio");
    const value =
      1 +
      floor(
        round_float(
          (this.hp_max - min(r_ratio * this._hp, this.hp_max)) / 100,
        ),
      );
    this.mp = min(this.mp_max, this._mp + value);
  }

  check_fusion_dismissing(): boolean {
    if (!this.fuse_bys?.length) return false;

    const { x, y, z } = this.position;
    for (const fighter of this.fuse_bys) {
      fighter.position.set(x, y, z);
    }
    if (this.dismiss_time) {
      this.dismiss_time = round_float(this.dismiss_time - this._atom_time);
    }

    const should_dismiss =
      ((this.dismiss_time !== null && this.dismiss_time <= 0) ||
        this.ctrl.sametime_keys_test("dja") ||
        this.ctrl.sequence_keys_test("ja")) &&
      y == 0;
    if (should_dismiss) this.dismiss_fusion("112");
    return should_dismiss;
  }
  // debug_step_check() {
  //   if (is_f_num(this.position.x) || is_f_num(this.position.y) || is_f_num(this.position.z))
  //     debugger;
  // }
  update(): void {
    this._atom_time = this.world.dataset.atom_time;
    const rf = round_float;
    this._lifetime += 1;
    if (this.frame.facing) this.facing = this.handle_facing_flag(this.frame.facing)
    if (this.check_fusion_dismissing()) return;
    this.hp_recovering()
    this.mp_recovering();

    if (this.frame.hp) this.hp -= this.frame.hp * this._atom_time;
    if (this.frame.mp) this.mp -= this.frame.mp * this._atom_time;

    if (this.shaking <= 0 || 0 == this.dataset('vrest_after_shaking'))
      for (const [k, v] of this.vrests) {
        if (v.rest > 0) {
          v.rest = rf(v.rest - this._atom_time);
          if (v.rest < 0) v.rest = 0;
        } else {
          this.del_v_rest(k)
        }
      }

    if (0 == this.dataset('arest_after_motionless') || this.motionless <= 0) {
      if (this.arest > 0) {
        this.arest = rf(this.arest - this._atom_time);
        if (this.arest < 0) this.arest = 0;
      } else {
        this.arest = 0
      }
    }

    if (this._invisible_duration > 0) {
      this._invisible_duration = rf(this._invisible_duration - this._atom_time);
      if (this._invisible_duration <= 0) {
        this._invisible_duration = 0;
        this._blinking_duration = this.dataset('invisible_blinking');
      }
    }
    if (this._invulnerable_duration > 0) {
      this._invulnerable_duration = rf(this._invulnerable_duration - this._atom_time);
      if (this._invulnerable_duration < 0) this._invulnerable_duration = 0;
    }

    if (this._blinking_duration > 0) {
      this._blinking_duration = rf(this._blinking_duration - this._atom_time);
      if (this._blinking_duration <= 0) {
        this._blinking_duration = 0;
        if (this._after_blink === FrameId.Gone) {
          this.frame = GONE_FRAME_INFO;
          this.arest = 0;
        } else if (this._after_blink === FrameId.Respawn) {
          this.hp = this.hp_r = this.hp_max;

          let max_distance = Number.MAX_SAFE_INTEGER
          let friend: Entity | undefined;
          for (const e of this.world.puppets.values()) {
            if (e.hp <= 0) continue;
            const d =
              abs(round(e.position.x - this.position.x)) +
              abs(round(e.position.z - this.position.z));
            if (d > max_distance) continue;
            max_distance = d;
            friend = e;
          }
          if (friend) {
            this.lfw.mt.mark = 'u_1'
            const x = this.lfw.mt.range(
              max(round(friend.position.x - 100), this.world.stage.player_l),
              min(round(friend.position.x + 100), this.world.stage.player_r)
            )
            this.lfw.mt.mark = 'u_2'
            const z = this.lfw.mt.range(
              min(round(friend.position.z - 100), this.world.stage.far),
              max(round(friend.position.z + 100), this.world.stage.near)
            )
            this.set_position(x, 550, z)
          } else {
            this.set_position_y(550)
          }
          this.enter_frame(Defines.NEXT_FRAME_AUTO)
        }
      }
    }
    for (const pair of this._opoints) {
      const [opoint, time] = pair
      if (time === opoint.interval) {
        this.apply_opoints([opoint])
        pair[1] = 0;
      } else {
        pair[1] = time + 1;
      }
    }
    this.stat_recovering();
    this.toughness_recovering();

    this._state?.pre_update?.(this);
    if (this.wait > 0) {
      if (
        this.motionless <= 0 &&
        this.shaking <= 0 &&
        !this._catcher &&
        !this._bearer
      ) {
        this.wait = rf(this.wait - this._atom_time)
        if (this.wait < 0) this.wait = 0;
      }
    } else if (this.frame.next) {
      this.enter_frame(this.frame.next)
    } else {
      this.set_frame(this.find_auto_frame())
    }
    this.handle_gravity();
    this.update_velocity(this.frame);
    this._state?.update(this);
    this.update_position();
    if (this.motionless > 0) {
      this.motionless = rf(this.motionless - this._atom_time);
      if (this.motionless < 0) this.motionless = 0
    }
    if (this.shaking > 0) {
      this.shaking = rf(this.shaking - this._atom_time);
      if (this.shaking < 0) this.shaking = 0
    }
    if (this.update_catching()) return;
    if (this.update_caught()) return;
    const { result, keys } = this.ctrl.update();
    if (result) {
      const r = this.handle_next_frame_result(result);
      if (r >= EnterFrameResult.Entered && keys != GK.a) {
        /*
        FIXME: 
          此处为了Louis的抓人逻辑，简单粗暴的重置了抓人时间计算。
          这大概不是合适的实现。
            -Gim
        */
        this.set_catch_time(this.catch_time_max)
      }
    }

    if (!this.shaking && !this.motionless && !this._bearer && !this._catcher)
      this.update_landable();
    this._holding?.follow_bearer();
    this.collision_list.length = 0;
    this.collided_list.length = 0;
    this.prev_position.copy(this.position);
  }

  /**
   * 处理与地面的交互
   */
  protected update_landable() {
    const { _ground_y, is_on_ground } = this;

    /** itr/bdy与地面的碰撞 */
    const { __hit_ground_bdys, __hit_ground_itrs } = this.frame
    if (__hit_ground_bdys) this.update_itr_bdy_hit_ground(__hit_ground_bdys);
    if (__hit_ground_itrs) this.update_itr_bdy_hit_ground(__hit_ground_itrs);

    if (!this.frame.landable) return;

    /** 
     是否本帧落地.
 
     注意：不能简单用 velocity.y <= 0 判断落地，因为存在Y速度向上但仍是落地的情况。
     例如在45度斜坡上，X轴速度带来的水平位移使 ground_y 上升得比自身Y坐标更快，
     此时即使 velocity.y > 0，position.y 仍可能 <= ground_y，应视为落地。
    */
    const just_land = !is_on_ground && (
      this.position.y <= _ground_y
    )

    // 落地
    if (just_land) {
      this.is_on_ground = true;
      this.position.y = _ground_y;
      this._temp_v.x = this.velocity.x
      this._temp_v.y = this.velocity.y
      this._temp_v.z = this.velocity.z
      this.velocity.y = 0;
      this.prev_velocity.y = 0;
      this._state?.on_landing?.(this, this._temp_v);
      this.play_sound(this._data.base.drop_sounds);
      if (this.throwinjury) {
        this.hp -= this.throwinjury;
        this.hp_r -= round(this.throwinjury * (1 - this.dataset('hp_recoverability')))
        this.throwinjury = 0;
      }
      if (this.fallinjury) {
        this.hp -= this.fallinjury;
        this.hp_r -= round(this.fallinjury * (1 - this.dataset('hp_recoverability')))
        this.fallinjury = 0;
      }
      this._landing_frame = this.frame
    } else if (is_on_ground) {

      if (this.position.y - _ground_y > this.world.ground.step) {
        // 离地面太高
        this.leave_ground();
        this._state?.on_leave_ground?.(this);
      } else {
        // 视为 斜坡/楼梯
        this.position.y = _ground_y;
      }
    }
  }

  update_itr_bdy_hit_ground(itrs: (IItrInfo | IBdyInfo)[]): void {
    if (!itrs?.length) return;
    for (const itr of itrs) {
      if (!itr.on_hit_ground) continue;
      const { y = 0, h = 0 } = itr;
      if ((this.position.y + this.frame.centery - y - h) > this._ground_y)
        continue;
      this.enter_frame(itr.on_hit_ground);
    }
  }
  update_position(): void {
    if (this.bearer || this.catcher || this.shaking || this.motionless) return;
    let { x: vx, y: vy, z: vz } = this.velocity;
    const atom_time = this._atom_time;
    for (const [, v] of this.blockers) {
      if (
        (vx < 0 && v.attacker.position.x < this.position.x) ||
        (vx > 0 && v.attacker.position.x > this.position.x)
      ) {
        vx = 0;
        this.prev_velocity.x = 0;
      }
      if (
        (vz < 0 && v.attacker.position.z < this.position.z) ||
        (vz > 0 && v.attacker.position.z > this.position.z)
      ) {
        vz = 0;
        this.prev_velocity.z = 0;
      }
    }
    if (!this.shaking && !this.motionless) {
      let { x, y, z } = this.position;
      x += (vx + this.prev_velocity.x) * 0.5 * atom_time
      y += (vy + this.prev_velocity.y) * 0.5 * atom_time;
      z += (vz + this.prev_velocity.z) * 0.5 * atom_time;
      this.set_position(x, y, z);
    }
    this.prev_velocity.set(vx, vy, vz);
  }

  /**
   * hp意外归0时，应该去的地方
   * @returns
   */
  get_sudden_death_frame(): TNextFrame {
    return this._state?.get_sudden_death_frame?.(this) || Defines.NEXT_FRAME_AUTO
  }

  /**
   * 获取“被抓结束”帧
   *
   * 被抓后，抓人者的“抓取值”降至0时，视为“被抓结束”，
   * 此时被抓者跳去的帧即为“被抓结束”帧
   *
   * @returns 下帧信息
   */
  get_caught_end_frame(): INextFrame {
    if (this.position.y < this.ground_y) this.position.y = this.ground_y + 1;
    return this._state?.get_caught_end_frame?.(this) || Defines.NEXT_FRAME_AUTO
  }

  /**
   * 获取“被抓取消”帧
   *
   * 被抓后，抓人者的“抓取值”未降至0，且catcher的帧缺少cpoint时，视为“被抓取消”，
   * 此时跳去的帧即为“被抓结束”帧
   *
   * @returns 下帧信息
   */
  get_caught_cancel_frame(): INextFrame {
    if (this.position.y < this.ground_y) this.position.y = this.ground_y + 1;
    return Defines.NEXT_FRAME_AUTO;
  }

  update_caught(): boolean {
    const cer = this._catcher;
    if (!cer) return false;
    /** "对齐颗粒度" */
    this.follow_catcher();
    if (!cer._catch_time) {
      this._catcher = null;
      this.prev_cpoint_a = null;
      this.enter_frame(this.get_caught_end_frame());
      return true;
    }

    const frame_a = cer.frame;
    const { cpoint: cp_a } = frame_a;
    if (!cp_a) {
      this._catcher = null;
      this.prev_cpoint_a = null;
      this.set_velocity_y(3);
      this.enter_frame(this.get_caught_cancel_frame());
      return true;
    }

    if (this.prev_cpoint_a !== cp_a) {
      const { injury } = cp_a;
      if (injury) {
        const prev_hp = this.hp;
        this.hp -= injury;
        this.hp_r -= injury * (1 - this.dataset('hp_recoverability'))
        summary_mgr.apply_damage(cer, injury, this, prev_hp);
      }
      const shaking = cp_a.shaking
      if (typeof shaking === 'number')
        this.shaking = shaking;
      else if (injury)
        this.shaking = this.dataset('itr_shaking')
    }
    this.prev_cpoint_a = cp_a;

    const { throwvx: tx = 0, throwvy: ty = 0, throwvz: tz = 0, throwinjury: ti = 0 } = cp_a;
    if (ti > 0) this.throwinjury = ti;
    if (tx || ty || tz) {
      this.follow_catcher();
      this._catcher = null;
      this.prev_cpoint_a = null;
    }
    if (cp_a.vaction) {
      return this.enter_frame(cp_a.vaction) >= EnterFrameResult.Entered;
    };
    return false
  }
  drop_catching(): boolean {
    if (!this._catching) return false;
    if (this._catching._catcher === this)
      this._catching._catcher = null;
    this.set_catching(null);
    this.enter_frame(Defines.NEXT_FRAME_AUTO);
    return true;
  }
  update_catching(): boolean {
    if (!this._catching) return false;
    if (!this._catch_time) {
      this.set_catching(null);
      this.enter_frame(Defines.NEXT_FRAME_AUTO);
      return true;
    }
    const { cpoint: cpoint_a } = this.frame;
    if (cpoint_a?.decrease)
      this.add_catch_time(cpoint_a.decrease * this._atom_time)

    if (!cpoint_a) {
      this.set_catching(null);
      this.set_catch_time(this.catch_time_max);
      this.enter_frame(Defines.NEXT_FRAME_AUTO);
      return true;
    }

    const { throwvx, throwvy, throwvz, throwinjury } = cpoint_a;
    if (throwinjury !== void 0) {
      if (throwinjury > 0) {
        // TODO：丢出后，被丢的人落地后的受到的伤害
        // return;
      } else if (throwinjury === -1) {
        if (is_fighter(this) && is_fighter(this._catching)) {
          this.transfrom_to_another(this._catching._data);
          this.enter_frame(this.find_auto_frame())
          return true;
        }
      } else {
        this.enter_frame(GONE_FRAME_INFO);
        return true;
      }
    }
    if (throwvx || throwvy || throwvz) {
      this.set_catching(null);
      return false;
    }

    /** "对齐颗粒度" */
    this.follow_catcher();
    return false;
  }

  follow_catcher() {
    const a = this._catcher;
    const b = this;
    if (!a) return;
    const { centerx: afx, centery: afy, cpoint: ac, } = a.frame;
    if (!ac) return;
    const { throwvx: tx = 0, throwvy: ty = 0, throwvz: tz = 0 } = ac;
    const { centerx: bfx, centery: bfy, cpoint: bc } = this.frame;
    const { x: ax, y: ay, z: az } = a.position;
    const a_face = a.facing;
    const { x: acx = 0, y: acy = 0, z: acz = 0 } = ac
    if (tx || ty || tz) {
      const vx = tx * this.dataset('tvx_f') * a_face
      const vy = ty * this.dataset('tvy_f')
      const vz = tz * this.dataset('tvz_f') * (a.ctrl.UD || 0)
      this.set_velocity(vx, vy, vz)
      this.set_position(
        (2 * vx) + ax - a_face * (afx - acx),
        (2 * vy) + ay + afy - acy,
        (2 * vz) + az + acz,
      )
      return;
    }
    const b_face = b.facing;
    const { x: bcx = 0, y: bcy = 0, z: bcz = 0 } = bc || {}
    this.set_position(
      ax - a_face * (afx - acx) + b_face * (bfx - bcx),
      ay + afy - acy + bcy - bfy,
      az + acz - bcz,
    )

  }

  /**
   * 获取“抓人结束”帧
   *
   * 抓人后，“抓取值”降至0时，视为“抓人结束”，
   *
   * 此时跳去的帧即为“抓人结束”帧
   *
   * @returns 下帧信息
   */
  get_catching_end_frame(): INextFrame {
    return Defines.NEXT_FRAME_AUTO;
  }

  /**
   * 获取“抓人取消”帧
   *
   * 抓人后，“抓取值”未降至0，且任意一方的帧缺少cpoint时，视为“抓人取消”，
   *
   * 此时跳去的帧即为“抓人取消”帧
   *
   * @returns 下帧信息
   */
  get_catching_cancel_frame(): INextFrame { return Defines.NEXT_FRAME_AUTO; }

  transfrom_to_another(data?: IEntityData): boolean {
    const datas = this.transforms = data ?
      [this._data, data] :
      this.transforms;
    if (!datas?.length) return false;
    const curr_idx = this.transform_index;
    const next_idx = (curr_idx + 1) % datas.length;
    const next_data = datas[next_idx]
    if (!next_data) return false;
    this.transform_index = next_idx;
    this.transform(next_data);
    if (next_idx === 0) {
      // TODO: 这个逻辑感觉怪怪的，后续可以改成直接在数据里写死变身后的帧
      let nf = this.get_next_frame({ id: "245" })?.frame
      if (!nf) nf = this.find_auto_frame();
      this.enter_frame(nf);
    }
    if (this.copies.size) {
      const gones: string[] = []
      for (const id of this.copies) {
        const copy = this.world.entity_map.get(id);
        if (!copy?.mounted) gones.push(id)
        else copy.transform(next_data)
      }
      for (const d of gones)
        this.copies.delete(d)
    }
    return true;
  }

  start_catch(target: Entity, itr: IItrInfo) {
    if (itr.catchingact === void 0) {
      Ditto.warn(`[Entity::start_caught] cannot catch, catchingact got ${itr.catchingact}`);
      return;
    }
    this.set_catch_time(this.catch_time_max);
    this.set_catching(target)
    this.enter_frame(itr.catchingact);
  }

  start_caught(attacker: Entity, itr: IItrInfo) {
    if (itr.caughtact === void 0) {
      Ditto.warn(`[Entity::start_caught] cannot be caught, caughtact got ${itr.caughtact}`)
      return;
    }
    this._catcher = attacker;
    this.resting = 0;
    this.fall_value = this.fall_value_max;
    this.defend_value = this.defend_value_max;
    this.enter_frame(itr.caughtact);
  }

  spark_point(r0: IBounding, r1: IBounding) {
    const cross: IBounding = cross_bounding(r0, r1);
    const {
      left: l,
      right: r,
      top: t,
      bottom: b,
      near: n,
      far: f,
    } = cross
    this.lfw.mt.mark = 'sp_1'
    const x = this.lfw.mt.range(l, r);
    const y = 2 + round_float((b + t) / 2);//this.lf2.random_in(b, t);
    const z = max(f, n) + 3;
    return [x, y, z] as const;
  }

  release(): void {
    if (!this._mounted) return;
    this.bearer?.drop_holding();
    this.catcher?.drop_catching();
    this._mounted = 0;
    this.world.del_entity(this);
    this.callbacks.call("on_disposed", this);
    this.callbacks.clear()
    this.reset(this.data, this._states);
  }

  /**
   * 开始闪烁,闪烁完成后移除自己
   *
   * @param {number} duration 闪烁持续帧数
   */
  blink_and_gone(duration: number) {
    this._blinking_duration = duration;
    this._after_blink = FrameId.Gone;
  }
  blink_and_respawn(duration: number) {
    this._blinking_duration = duration;
    this._after_blink = FrameId.Respawn;
  }

  /**
   * 开始隐身
   *
   * @param {number} duration 隐身持续帧数
   */
  invisibility(duration: number) {
    this._invisible_duration = duration;
  }


  get_flag(other: Entity): number {
    let ret = this.team === other.team ? HitFlag.Ally : HitFlag.Enemy;
    if (this.hp <= 0) ret |= HitFlag.Dead;
    return ret | this.type;
  }
  is_ally(other: Entity): boolean {
    return this.team === other.team;
  }

  pick(weapon: Entity) {
    if (weapon.bearer) return;
    if (this.holding) return;
    this.holding = weapon;
    weapon.bearer = this;
    weapon.follow_bearer()
    summary_mgr.get(this.id).picking_sum += 1
    if (!is_independent(this.team))
      summary_mgr.get(this.team).picking_sum += 1;
  }

  follow_bearer() {
    const { bearer } = this;
    if (!bearer) return;
    this.team = bearer.team;
    if (this.hp <= 0 && this.bearer) {
      this.drop_holding()
      return;
    }
    const {
      wpoint: wp_a = {} as Partial<IWpointInfo>,
      centerx: cx_a, centery: cy_a,
    } = bearer.frame;

    if (wp_a.kind === WpointKind.Drop) {
      bearer.drop_holding();
      this.lfw.mt.mark = 'dh_v'
      const vy = 3
      const vx = this.lfw.mt.range(-10, 10) / 10
      const vz = this.lfw.mt.range(-10, 10) / 20;
      this.set_velocity(vx, vy, vz)
      return;
    }

    if (wp_a.weaponact !== this.frame.id) {
      // fallback=true 用于 还原wpoint丢失的情况
      this.enter_frame_by_id(wp_a.weaponact, true);
    }

    const {
      wpoint: wp_b = {} as Partial<IWpointInfo>,
      centerx: cx_b, centery: cy_b,
    } = this.frame;

    const weight = this._data.base.weight || 1;
    let { dvx, dvy, dvz } = wp_a;
    const { x, y, z } = bearer.position;
    this.facing = bearer.facing;
    const { x: wa_x = 0, y: wa_y = 0, z: wa_z = 0 } = wp_a;
    const { x: wb_x = 0, y: wb_y = 0, z: wb_z = 0 } = wp_b

    if (wp_a.kind) {
      this.prev_position.copy(bearer.position)
      this.set_position(
        x + this.facing * (wa_x - cx_a + cx_b - wb_x),
        y + cy_a - wa_y - cy_b + wb_y,
        z + wa_z - wb_z,
      )
    } else { // 还原wpoint丢失的情况
      this.set_position(
        x + this.facing * (wa_x - cx_a),
        y + cy_a - wa_y,
        z + wa_z,
      )
    }

    // 武器被丢
    if (dvx !== void 0 || dvy !== void 0 || dvz !== void 0) {
      bearer.holding = null;
      this.bearer = null;
      dvx = dvx ? dvx * this.dataset('wvx_f') : 0
      dvy = dvy ? dvy * this.dataset('wvy_f') : 0
      dvz = dvz ? dvz * this.dataset('wvz_f') : 0
      const nf = this.find_align_frame(
        this.frame.id,
        this.data.indexes?.on_hands,
        this.data.indexes?.throwings
      )
      this.prev_position.copy(this.position)
      this.set_position(
        round(x + this.facing * (wa_x - cx_a)),
        round(y + cy_a - wa_y),
        round(z + wa_z),
      )
      const vz = bearer.ctrl ? bearer.ctrl.UD * (dvz || 0) : 0;
      dvx = dvx / weight;
      dvy = dvy / weight;
      const vx = (dvx - abs(vz / 2)) * this.facing;
      this.set_velocity(vx, dvy, vz);
      this.enter_frame(nf);
      return;
    }
  }

  enter_frame_by_id(id: string | undefined, fallback: boolean = false): EnterFrameResult {
    if (id == void 0 && fallback) id = FrameId.Auto;
    this._next_frame_by_id.id = id;
    return this.enter_frame(this._next_frame_by_id, fallback);
  }

  enter_frame(nfs: TNextFrame, fallback: boolean = false): EnterFrameResult {
    if (this.frame.id === FrameId.Gone)
      return EnterFrameResult.Gone;

    const result = this.get_next_frame(nfs);
    if (!result && fallback) {
      const frame = this.find_auto_frame()
      this.set_frame(frame);
      this.wait = this.handle_wait_flag(void 0, frame);
      return EnterFrameResult.Fallback;
    }
    if (!result) return EnterFrameResult.NotFound;
    return this.handle_next_frame_result(result);
  }

  handle_next_frame_result(result: INextFrameResult, fallback: boolean = false) {
    const { frame, which: flags } = result;
    if (!this.world.dataset.infinity_mp) {
      const { mp, hp } = flags;
      if (mp) this.mp -= mp;
      if (hp) this.hp -= hp;
    }
    if (frame) {
      this.play_sound(frame.sound, this.position)
      this.set_frame(frame);
    } else if (this.frame === EMPTY_FRAME_INFO || fallback) {
      this.set_frame(this.find_auto_frame());
    }
    if (flags.facing != void 0) this.facing = this.handle_facing_flag(flags.facing);
    if (frame) this.wait = this.handle_wait_flag(flags.wait, frame);
    if (Array.isArray(flags.sound)) this.play_sound(flags.sound);
    if (flags.blink_time) this.blinking = flags.blink_time;
    if (flags.reset_keys) this.ctrl.reset_key_list();
    if (flags.transfrom_to_another) this.transfrom_to_another();
    return frame ? EnterFrameResult.Entered : EnterFrameResult.Fallback;
  }

  handle_wait_flag(wait: string | number | undefined, frame?: IFrameInfo): number {
    if (wait == void 0 && frame) return frame.wait + this.world.dataset.wait_offset;
    if (is_positive(wait)) return wait;
    if (wait === "i" || !frame) return this.wait;
    if (wait === "d") return max(0, frame.wait - this.frame.wait + this.wait);
    return frame.wait + this.world.dataset.wait_offset;
  }

  /**
   * 进入下一帧时，需要处理朝向
   *
   * @see {FacingFlag}
   * @param facing 目标朝向, 可参考FacingFlag
   * @param frame 帧
   * @returns 返回新的朝向
   */
  handle_facing_flag(facing: number | undefined): -1 | 1 {
    switch (facing) {
      case FacingFlag.Ctrl:
        return this.ctrl?.LR || this.facing;
      case FacingFlag.AntiCtrl:
        return this.ctrl?.LR
          ? turn_face(this.ctrl.LR)
          : this.facing;
      case FacingFlag.SameAsCatcher:
        return this._catcher?.facing || this.facing;
      case FacingFlag.OpposingCatcher:
        return turn_face(this._catcher?.facing) || this.facing;
      case FacingFlag.Backward:
        return turn_face(this.facing);
      case FacingFlag.Left:
      case FacingFlag.Right:
        return facing;
      case FacingFlag.VX: {
        const vx = this.velocity.x
        return vx > 0 ? 1 : vx < 0 ? -1 : this.facing
      }
      case FacingFlag.AntiVX: {
        const vx = this.velocity.x
        return vx > 0 ? -1 : vx < 0 ? 1 : this.facing
      }
      case FacingFlag.Trend: {
        const { LR } = this.ctrl;
        if (LR) return LR;
        const vx = this.velocity.x;
        return vx > 0 ? 1 : vx < 0 ? -1 : this.facing;
      }
      case FacingFlag.SameAsBearer:
        return this._bearer?.facing || this.facing;
      case FacingFlag.OpposingBearer:
        return turn_face(this._bearer?.facing) || this.facing;
    }
    return this.facing;
  }

  get_next_frame(which: TNextFrame): INextFrameResult | undefined {
    if (Array.isArray(which)) {
      const l = which.length;
      const remains: INextFrame[] = []
      for (let i = 0; i < l; ++i) {
        const nf: INextFrame | undefined = which[i];
        if (!nf) continue;
        if (!nf.__judger) {
          remains.push(nf)
          continue;
        }
        const f = this.get_next_frame(nf);
        if (f) return f;
      }
      const next = this.lfw.mt.pick(remains)
      if (!next) return;
      return this.get_next_frame(next);
    }
    const id = which.id;
    const judger = which.__judger;
    const use_hp = which.hp;
    const use_mp = which.mp;
    const { mp_mode } = which;
    if (judger && !judger.run(this)) {
      return void 0;
    }
    let frame: IFrameInfo | undefined;
    if (id) {
      this.lfw.mt.mark = 'gnf_1'
      frame = this.find_frame_by_id(this.lfw.mt.pick(id));
      if (!frame) return void 0;
    }
    if (!this.world.dataset.infinity_mp && frame) {
      if (this.frame.next === which) {
        // 用next 进入此动作，负数表示消耗，无视正数。若消耗完毕跳至按下防御键的指定跳转动作
        if (use_mp && this._mp < use_mp)
          return this.get_next_frame(frame.hit?.d ?? Defines.NEXT_FRAME_AUTO);
        if (use_hp && this._hp <= use_hp)
          return this.get_next_frame(frame.hit?.d ?? Defines.NEXT_FRAME_AUTO);
      } else {
        if (use_mp && this._mp < use_mp && mp_mode != 1) return void 0;
        if (use_hp && this._hp <= use_hp) return void 0;
      }
    }
    let w: INextFrame;
    if (is_str(which)) {
      w = { id: which };
    } else {
      w = which;
    }
    return { frame, which: w };
  }

  find_frame_by_id(id: string | undefined): IFrameInfo | undefined {
    const r = this._state?.find_frame_by_id?.(this, id);
    if (r) return r;

    switch (id) {
      case void 0:
      case FrameId.None:
      case FrameId.Self:
        return this.frame;
      case FrameId.Auto:
        return this.find_auto_frame();
      case FrameId.Gone:
        return GONE_FRAME_INFO;
    }
    if (!this._data.frames[id]) {
      Ditto.warn(
        Entity.TAG + "::find_frame_by_id",
        "frame not find! id:",
        id,
      );
      return this.find_auto_frame();
    }
    return this._data.frames[id];
  }
  get_prev_frame() {
    return this._prev_frame;
  }
  set_velocity(
    _x?: number | null,
    _y?: number | null,
    _z?: number | null,
  ) {
    if (is_f_num(_x) || is_f_num(_y) || is_f_num(_z)) debugger;
    if (_x !== null && _x !== void 0) this.prev_velocity.x = this.velocity.x = round_float(_x)
    if (_y !== null && _y !== void 0) this.prev_velocity.y = this.velocity.y = round_float(_y)
    if (_z !== null && _z !== void 0) this.prev_velocity.z = this.velocity.z = round_float(_z)
    if (this.velocity.y > 0) this.leave_ground();
  }
  set_velocity_x(x: number) {
    this.set_velocity(x)
  }
  set_velocity_y(y: number) {
    this.set_velocity(null, y)
  }
  set_velocity_z(z: number) {
    this.set_velocity(null, null, z)
  }
  set_position(_x?: number | null, _y?: number | null, _z?: number | null) {
    if (is_f_num(_x) || is_f_num(_y) || is_f_num(_z)) debugger;
    if (_x !== null && _x !== void 0) this.position.x = round_float(_x)
    if (_y !== null && _y !== void 0) this.position.y = round_float(_y)
    if (_z !== null && _z !== void 0) this.position.z = round_float(_z)
    if (this.prev_position.x === Number.MIN_SAFE_INTEGER)
      this.prev_position.copy(this.position);
    const { x, y, z } = this.world.restrict(this);
    if (this.position.x !== x && this.frame.on_x_restrict)
      this.enter_frame(this.frame.on_x_restrict)
    if (this.position.z !== z && this.frame.on_z_restrict)
      this.enter_frame(this.frame.on_z_restrict)
    if (this.position.y !== y && this.frame.on_y_restrict)
      this.enter_frame(this.frame.on_y_restrict)
    if (
      this.position.x !== x ||
      this.position.y !== y ||
      this.position.z !== z
    ) {
      if (this.frame.on_restrict)
        this.enter_frame(this.frame.on_restrict)
      this._state?.on_restrict?.(this, x, y, z);
    }
    this._ground_y = this.world.ground.y(this.terrain, this.position.x, this.position.z);
  }

  set_position_x(x: number) {
    this.set_position(x)
  }

  set_position_y(y: number) {
    this.set_position(null, y)
  }

  set_position_z(z: number) {
    this.set_position(null, null, z)
  }

  /** 离地 */
  leave_ground(): void {
    if (eqlt(this.position.y, this.ground_y))
      this.position.y = round_float(this.ground_y + 0.1);
    this.is_on_ground = false;
  }

  transform(data: IEntityData) {
    if (!is_human_ctrl(this.ctrl))
      this.ctrl = this.lfw.factory.create_ctrl(data.id, this.ctrl.player_id, this);
    const prev = this._data;
    this._data = data;
    this.reset_armor()
    this.callbacks.call("on_data_changed", this._data, prev, this)
  }

  play_sound(sounds: string | string[] | undefined, pos: IVector3Like = this.position): void {
    if (!sounds?.length) return;
    let { x, y, z } = pos;
    const { frame } = this;
    if (frame.state === StateEnum.Message) {
      let { centerx, width } = frame;
      let { camera: { position: { x: cam_x } } } = this.world;
      let cam_r = cam_x + this.world.dataset.screen_w;
      const offset_x = this.facing === 1 ? centerx : width - centerx;
      cam_r -= width - offset_x;
      cam_x += offset_x;
      x = clamp(x, cam_x, cam_r);
    }
    if (Array.isArray(sounds)) {
      for (const sound of sounds) {
        this.lfw.sounds.play(sound, x, y, z);
      }
    } else {
      this.lfw.sounds.play(sounds, x, y, z);
    }
  }

  get_emitter(idx: number): Entity | undefined {
    const emittier_id = this.emitters[idx];
    if (!emittier_id) return;
    return this.world.entity_map.get(emittier_id);
  }

  get_v_rest(a_id: string): number {
    return this.vrests.get(a_id)?.rest || 0;
  }
  add_v_rest(c: Collision) {
    this.vrests.set(c.aid, c);
    if (c.itr.kind === ItrKind.Block) this.blockers.set(c.aid, c);
    if (c.itr.kind === ItrKind.SuperPunchMe) this.superpunchs.set(c.aid, c);
  }
  del_v_rest(a_id: string) {
    this.vrests.delete(a_id);
    this.blockers.delete(a_id);
    this.superpunchs.delete(a_id);
  }
  dataset<K extends keyof IWorldDataset>(name: K): IWorldDataset[K] {
    return (
      this.frame.dataset?.[name] ??
      this.data.base[name] ??
      this.world.bg.data.dataset?.[name] ??
      this.world.dataset[name]
    )
  }
  itr_fall(itr: IItrInfo): number {
    return itr.fall ?? this.dataset('itr_fall')
  }

  to_snapshot(nums: number[], strs: string[]): void {
    nums[NSlot.WAIT] = this.wait;
    nums[NSlot.VARIANT] = this.variant;
    nums[NSlot.TRANSFORM_INDEX] = this.transform_index;
    nums[NSlot.LIFETIME] = this._lifetime;
    nums[NSlot.SPAWN_TIME] = this._spawn_time;
    nums[NSlot.RESERVE] = this._reserve;
    nums[NSlot.MOUNTED] = this._mounted;
    nums[NSlot.GHOSTED] = this._ghosted;
    nums[NSlot.RESTING] = this._resting;
    nums[NSlot.RESTING_MAX] = this._resting_max ?? NaN;
    nums[NSlot.TOUGHNESS] = this._toughness;
    nums[NSlot.TOUGHNESS_MAX] = this._toughness_max;
    nums[NSlot.TOUGHNESS_R_VALUE] = this._toughness_r_value;
    nums[NSlot.TOUGHNESS_RESTING] = this._toughness_resting;
    nums[NSlot.TOUGHNESS_RESTING_MAX] = this._toughness_resting_max;
    nums[NSlot.FALL_VALUE] = this._fall_value;
    nums[NSlot.FALL_VALUE_MAX] = this._fall_value_max ?? NaN;
    nums[NSlot.FALL_R_VALUE] = this._fall_r_value;
    nums[NSlot.DEFEND_VALUE] = this._defend_value;
    nums[NSlot.DEFEND_VALUE_MAX] = this._defend_value_max ?? NaN;
    nums[NSlot.DEFEND_R_VALUE] = this._defend_r_value;
    nums[NSlot.HEALING] = this._healing;
    nums[NSlot.DEFEND_RATIO] = this._defend_ratio ?? NaN;
    
    nums[NSlot.FALLINJURY] = this.fallinjury;
    nums[NSlot.THROWINJURY] = this.throwinjury;
    nums[NSlot.FACING] = this.facing;

    nums[NSlot.POS_X] = this.position.x;
    nums[NSlot.POS_Y] = this.position.y;
    nums[NSlot.POS_Z] = this.position.z;
    nums[NSlot.PREV_POS_X] = this.prev_position.x;
    nums[NSlot.PREV_POS_Y] = this.prev_position.y;
    nums[NSlot.PREV_POS_Z] = this.prev_position.z;
    nums[NSlot.VEL_X] = this.velocity.x;
    nums[NSlot.VEL_Y] = this.velocity.y;
    nums[NSlot.VEL_Z] = this.velocity.z;
    nums[NSlot.PREV_VEL_X] = this.prev_velocity.x;
    nums[NSlot.PREV_VEL_Y] = this.prev_velocity.y;
    nums[NSlot.PREV_VEL_Z] = this.prev_velocity.z;

    nums[NSlot.MP] = this._mp;
    nums[NSlot.MP_MAX] = this._mp_max;
    nums[NSlot.HP] = this._hp;
    nums[NSlot.HP_R] = this._hp_r;
    nums[NSlot.HP_MAX] = this._hp_max;

    nums[NSlot.AREST] = this._arest;
    nums[NSlot.MOTIONLESS] = this.motionless;
    nums[NSlot.SHAKING] = this.shaking;

    nums[NSlot.CATCH_TIME] = this._catch_time;
    nums[NSlot.CATCH_TIME_MAX] = this._catch_time_max ?? NaN;
    nums[NSlot.DISMISS_TIME] = this.dismiss_time ?? NaN;

    nums[NSlot.INVISIBLE_DURATION] = this._invisible_duration;
    nums[NSlot.INVULNERABLE_DURATION] = this._invulnerable_duration;
    nums[NSlot.BLINKING_DURATION] = this._blinking_duration;

    nums[NSlot.JUMP_X] = this.jumping.x;
    nums[NSlot.JUMP_Y] = this.jumping.y;
    nums[NSlot.JUMP_Z] = this.jumping.z;
    nums[NSlot.JUMP_T] = this.jumping.t;

    nums[NSlot.GROUND_Y] = this._ground_y;
    nums[NSlot.PREV_GROUND_Y] = this._prev_ground_y;

    nums[NSlot.AABB_MIN_X] = this.aabb_min_x;
    nums[NSlot.AABB_MAX_X] = this.aabb_max_x;
    nums[NSlot.AABB_MIN_Z] = this.aabb_min_z;
    nums[NSlot.AABB_MAX_Z] = this.aabb_max_z;
    nums[NSlot.L_LEN] = this.l_len;
    nums[NSlot.R_LEN] = this.r_len;

    nums[NSlot.STAT_BAR_TYPE] = this._stat_bar_type ?? NaN;

    this._hp_r_tick.write_nums(nums, NSlot.HP_R_TICK_VALUE);
    this._mp_r_tick.write_nums(nums, NSlot.MP_R_TICK_VALUE);
    this._resting_tick.write_nums(nums, NSlot.RESTING_TICK_VALUE);
    this._toughness_r_tick.write_nums(nums, NSlot.TOUGHNESS_R_TICK_VALUE);
    this._fall_r_tick.write_nums(nums, NSlot.FALL_R_TICK_VALUE);
    this._defend_r_tick.write_nums(nums, NSlot.DEFEND_R_TICK_VALUE);

    nums[NSlot.BOUNCED] = this.bounced ? 1 : 0;
    nums[NSlot.LYING_A_COUNT] = this.lying_a_count;
    nums[NSlot.LYING_D_COUNT] = this.lying_d_count;
    nums[NSlot.LYING_C_COUNT] = this.lying_c_count;
    nums[NSlot.DROP_HURTED] = this.drop_hurted ? 1 : 0;
    nums[NSlot.IS_ON_GROUND] = this.is_on_ground ? 1 : 0;
    nums[NSlot.KEY_ROLE] = to_tri(this._key_role);
    nums[NSlot.NAME_VISIBLE] = to_tri(this._name_visible);
    nums[NSlot.WAKEUP_INVULN] = to_tri(this._wakeup_invuln);
    nums[NSlot.DEAD_GONE] = to_tri(this._dead_gone);
    nums[NSlot.CTRL_VISIBLE] = to_tri(this._ctrl_visible);

    strs[SSlot.ID] = this.id;
    strs[SSlot.DATA_ID] = this._data.id;
    strs[SSlot.FRAME_ID] = this.frame.id;
    strs[SSlot.PREV_FRAME_ID] = this._prev_frame.id;
    strs[SSlot.LANDING_FRAME_ID] = this._landing_frame?.id ?? '';
    strs[SSlot.CATCHING_ID] = this._catching?.id ?? '';
    strs[SSlot.CATCHER_ID] = this._catcher?.id ?? '';
    strs[SSlot.BEARER_ID] = this._bearer?.id ?? '';
    strs[SSlot.HOLDING_ID] = this._holding?.id ?? '';
    strs[SSlot.TEAM] = this._team;
    strs[SSlot.NAME] = this._name ?? '';
    strs[SSlot.AFTER_BLINK] = this._after_blink ?? '';
    strs[SSlot.DISMISS_DATA_ID] = this.dismiss_data?.id ?? '';
    strs[SSlot.TRANSFORM_0_ID] = this.transforms?.[0]?.id ?? '';
    strs[SSlot.TRANSFORM_1_ID] = this.transforms?.[1]?.id ?? '';
  }

  read_snapshot(nums: number[], strs: string[]): void {
    this.wait = nums[NSlot.WAIT];
    this.variant = nums[NSlot.VARIANT];
    this.transform_index = nums[NSlot.TRANSFORM_INDEX];
    this._lifetime = nums[NSlot.LIFETIME];
    this._spawn_time = nums[NSlot.SPAWN_TIME];

    this._reserve = nums[NSlot.RESERVE];
    this._mounted = nums[NSlot.MOUNTED];
    this._ghosted = nums[NSlot.GHOSTED];

    this._resting = nums[NSlot.RESTING];
    this._resting_max = num_or_null(nums[NSlot.RESTING_MAX]);
    this._toughness = nums[NSlot.TOUGHNESS];
    this._toughness_max = nums[NSlot.TOUGHNESS_MAX];
    this._toughness_r_value = nums[NSlot.TOUGHNESS_R_VALUE];
    this._toughness_resting = nums[NSlot.TOUGHNESS_RESTING];
    this._toughness_resting_max = nums[NSlot.TOUGHNESS_RESTING_MAX];

    this._fall_value = nums[NSlot.FALL_VALUE];
    this._fall_value_max = num_or_null(nums[NSlot.FALL_VALUE_MAX]);
    this._fall_r_value = nums[NSlot.FALL_R_VALUE];
    this._defend_value = nums[NSlot.DEFEND_VALUE];
    this._defend_value_max = num_or_null(nums[NSlot.DEFEND_VALUE_MAX]);
    this._defend_r_value = nums[NSlot.DEFEND_R_VALUE];
    this._healing = nums[NSlot.HEALING];
    this._defend_ratio = num_or_null(nums[NSlot.DEFEND_RATIO]);

    this.fallinjury = nums[NSlot.FALLINJURY];
    this.throwinjury = nums[NSlot.THROWINJURY];
    this.facing = nums[NSlot.FACING] as TFace;

    this.position.set(nums[NSlot.POS_X], nums[NSlot.POS_Y], nums[NSlot.POS_Z]);
    this.prev_position.set(nums[NSlot.PREV_POS_X], nums[NSlot.PREV_POS_Y], nums[NSlot.PREV_POS_Z]);
    this.velocity.set(nums[NSlot.VEL_X], nums[NSlot.VEL_Y], nums[NSlot.VEL_Z]);
    this.prev_velocity.set(nums[NSlot.PREV_VEL_X], nums[NSlot.PREV_VEL_Y], nums[NSlot.PREV_VEL_Z]);

    this._mp = nums[NSlot.MP];
    this._mp_max = nums[NSlot.MP_MAX];
    this._hp = nums[NSlot.HP];
    this._hp_r = nums[NSlot.HP_R];
    this._hp_max = nums[NSlot.HP_MAX];

    this._arest = nums[NSlot.AREST];
    this.motionless = nums[NSlot.MOTIONLESS];
    this.shaking = nums[NSlot.SHAKING];

    this._catch_time = nums[NSlot.CATCH_TIME];
    this._catch_time_max = num_or_null(nums[NSlot.CATCH_TIME_MAX]);
    this.dismiss_time = num_or_null(nums[NSlot.DISMISS_TIME]);

    this._invisible_duration = nums[NSlot.INVISIBLE_DURATION];
    this._invulnerable_duration = nums[NSlot.INVULNERABLE_DURATION];
    this._blinking_duration = nums[NSlot.BLINKING_DURATION];

    this.jumping.x = nums[NSlot.JUMP_X];
    this.jumping.y = nums[NSlot.JUMP_Y];
    this.jumping.z = nums[NSlot.JUMP_Z];
    this.jumping.t = nums[NSlot.JUMP_T];

    this._ground_y = nums[NSlot.GROUND_Y];
    this._prev_ground_y = nums[NSlot.PREV_GROUND_Y];

    this.aabb_min_x = nums[NSlot.AABB_MIN_X];
    this.aabb_max_x = nums[NSlot.AABB_MAX_X];
    this.aabb_min_z = nums[NSlot.AABB_MIN_Z];
    this.aabb_max_z = nums[NSlot.AABB_MAX_Z];
    this.l_len = nums[NSlot.L_LEN];
    this.r_len = nums[NSlot.R_LEN];

    const st = nums[NSlot.STAT_BAR_TYPE];
    this._stat_bar_type = Number.isNaN(st) ? null : st as StatBarType;

    this._hp_r_tick.read_nums(nums, NSlot.HP_R_TICK_VALUE);
    this._mp_r_tick.read_nums(nums, NSlot.MP_R_TICK_VALUE);
    this._resting_tick.read_nums(nums, NSlot.RESTING_TICK_VALUE);
    this._toughness_r_tick.read_nums(nums, NSlot.TOUGHNESS_R_TICK_VALUE);
    this._fall_r_tick.read_nums(nums, NSlot.FALL_R_TICK_VALUE);
    this._defend_r_tick.read_nums(nums, NSlot.DEFEND_R_TICK_VALUE);

    this.bounced = nums[NSlot.BOUNCED] !== 0;
    this.lying_a_count = nums[NSlot.LYING_A_COUNT];
    this.lying_d_count = nums[NSlot.LYING_D_COUNT];
    this.lying_c_count = nums[NSlot.LYING_C_COUNT];
    this.drop_hurted = nums[NSlot.DROP_HURTED] !== 0;
    this.is_on_ground = nums[NSlot.IS_ON_GROUND] !== 0;
    this._key_role = from_tri(nums[NSlot.KEY_ROLE]);
    this._name_visible = from_tri(nums[NSlot.NAME_VISIBLE]);
    this._wakeup_invuln = from_tri(nums[NSlot.WAKEUP_INVULN]);
    this._dead_gone = from_tri(nums[NSlot.DEAD_GONE]);
    this._ctrl_visible = from_tri(nums[NSlot.CTRL_VISIBLE]);

    this.id = strs[SSlot.ID];
    const data = this.lfw.datas.find(strs[SSlot.DATA_ID]);
    if (data) this._data = data;
    this.frame = this.find_frame_by_id(strs[SSlot.FRAME_ID]) ?? this.frame;
    this._prev_frame = this.find_frame_by_id(strs[SSlot.PREV_FRAME_ID]) ?? this._prev_frame;
    this._landing_frame = strs[SSlot.LANDING_FRAME_ID]
      ? (this.find_frame_by_id(strs[SSlot.LANDING_FRAME_ID]) ?? null)
      : null;
    this._catching = this.world.entity_map.get(strs[SSlot.CATCHING_ID]) ?? null;
    this._catcher = this.world.entity_map.get(strs[SSlot.CATCHER_ID]) ?? null;
    this._bearer = this.world.entity_map.get(strs[SSlot.BEARER_ID]) ?? null;
    this._holding = this.world.entity_map.get(strs[SSlot.HOLDING_ID]) ?? null;
    this._team = strs[SSlot.TEAM];
    this._name = strs[SSlot.NAME] || null;
    this._after_blink = strs[SSlot.AFTER_BLINK] || null;
    this.dismiss_data = strs[SSlot.DISMISS_DATA_ID]
      ? (this.lfw.datas.find(strs[SSlot.DISMISS_DATA_ID]) ?? null)
      : null;

    const t0 = strs[SSlot.TRANSFORM_0_ID];
    const t1 = strs[SSlot.TRANSFORM_1_ID];
    if (t0 && t1) {
      const d0 = this.lfw.datas.find(t0);
      const d1 = this.lfw.datas.find(t1);
      this.transforms = d0 && d1 ? [d0, d1] : null;
    } else {
      this.transforms = null;
    }
  }

}

const common_creator = (world: World, data: IEntityData, states?: States) => {
  let ret = world.lfw.factory.acquire_entity(data.type)
  if (!ret) ret = new Entity(world, data, states)
  else ret.reset(data, states)
  return ret
}
Factory.register_entity(EntityEnum.Ball, common_creator);
Factory.register_entity(EntityEnum.Weapon, common_creator);
Factory.register_entity(EntityEnum.Entity, common_creator);
Factory.register_entity(EntityEnum.Fighter, common_creator);