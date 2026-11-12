import { Callbacks } from './base/Callbacks';
import { FPS } from './base/FPS';
import { Ticker } from './base/Ticker';
import { Background } from "./bg/Background";
import { Buff } from "./buff/Buff";
import { Camera } from './Camera';
import { CMDS } from './cmds';
import { type Collision, collision_get } from "./collision/Collision";
import { collisions_keeper } from "./collision/CollisionKeeper";
import {
  BGG,
  CheatEnum,
  Defines,
  FID,
  GK,
  GONE_FRAME_INFO,
  type IBdyInfo, type IBgData, type IBounding, type IEntityData,
  type IFrameInfo, type IItrInfo,
  type ITerrainInfo,
  type IVector3Like,
  O_ID,
  SE,
  WT
} from "./defines";
import { SyncRenderEnum } from "./defines/SyncRenderEnum";
import { Ditto } from './ditto/Instance';
import type { IWorldRenderer } from "./ditto/render/IWorldRenderer";
import {
  Entity,
  is_ball,
  is_ball_ctrl,
  is_bot_ctrl,
  is_fighter,
  is_human_ctrl,
  is_weapon
} from "./entity";
import { TerrainWorld } from "./terrain/TerrainWorld";
import type { IWorldCallbacks } from "./IWorldCallbacks";
import { LFW } from "./LFW";
import { Stage } from "./stage/Stage";
import { Transform } from "./Transform";
import { round_float } from './utils';
import { NestedMultiMap } from './utils/container_help/nested_multi_map';
import { between, floor, max, min, round } from './utils/math/base';
import { clamp } from './utils/math/clamp';
import { Times } from './utils/Times';
import { WorldDataset } from "./WorldDataset";
const LOOKUP_UPDATE_INTERVAL = 2;
const MAX_DEBUG_ENTITIES = 355
const MAX_STEP_ERRORS = 120
const WEAPON_X_SECTION = 750;
const x_sorter = (a: Entity, b: Entity) => {
  const d = a.aabb_min_x - b.aabb_min_x;
  if (d !== 0) return d;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export class World {
  static readonly TAG: string = "World";
  readonly lfw: LFW;
  readonly dataset: WorldDataset = new WorldDataset()
  readonly callbacks = new Callbacks<IWorldCallbacks>();
  private _sleeping: boolean = false;
  private _spark_data?: IEntityData;
  private _etc_data?: IEntityData;
  private _bg: Background;
  private _terrain_world?: TerrainWorld;
  private _stage: Stage;
  private _need_FPS: boolean = true;
  private _need_UPS: boolean = true;
  private _FPS = new FPS(0.9);
  private _lifetime: number = 0;
  private _render_worker_id?: ReturnType<typeof Ditto.Render.add>;
  private _update_worker?: Ticker;
  /** 
   * 临时实体列表
   *  
   * 每次更新前，此map会被清除
   */
  private _entities_map = new Map<string, Entity[]>();
  readonly buffs = new Map<string, Buff>();
  protected readonly _dead_buffs: Buff[] = [];
  private _game_time = new Times();
  private _counts = new Map<string, number>()
  /** 待移除实体 */
  private _gones = new Set<Entity>();
  // private _freshs = new Set<Entity>();
  private _paused: 0 | 1 | 2 = 0;
  private _fn_locked: 0 | 1 = 0;
  readonly camera: Camera;
  /** 这种相机位置控制感觉有点问题 */
  public renderer: IWorldRenderer;

  readonly transform: Transform = new Transform()
  readonly entity_map = new Map<string, Entity>();
  readonly entities: Entity[] = [];
  readonly ghosts: Entity[] = [];
  /** 
   * 被玩家操作的角色 
   * 键: 玩家ID
   * 值: 角色
   */
  readonly puppets = new Map<string, Entity>();
  readonly puppet_teams = new Set<string>();
  readonly collisions = new Map<string, Collision>()
  pairs_compared: number = 0;
  render_cost: number = 0;
  protected readonly _pair_collisions = new NestedMultiMap<string, string, Collision>();
  private _alive_players = new Set<Entity>();
  public has_players_alive: boolean = false;
  public TU: number = 1;
  /** 追帧：每次更新时额外连续推进的最大帧数（网络重连回放用，0 = 关闭） */
  public extra_steps: number = 0;
  /** 追帧：每次额外推进的时间预算(ms)，避免长时间阻塞主线程 */
  public extra_step_budget_ms: number = 16;
  readonly ground_weapon_counts = new Map<number, number>();
  get bg() { return this._bg; }

  get terrain(): TerrainWorld {
    const terrain = this._bg.data.terrain;
    if (!this._terrain_world || this._terrain_world.source !== terrain)
      this._terrain_world = new TerrainWorld(terrain);
    return this._terrain_world;
  }
  set bg(v: Background) {
    if (v === this._bg) return;
    const o = this._bg;
    this._bg = v;
    this.transform.set_scale(
      this._bg.zoom_x,
      this._bg.zoom_y,
      this._bg.zoom_z
    )
    o.dispose();
  }
  get stage() {
    return this._stage;
  }
  set stage(v) {
    if (v === this._stage) return;
    const o = this._stage;
    this._stage = v;
    this.callbacks.call("on_stage_change", v, o);
    o.dispose();
    v.enter_phase(0);
    for (const e of this.entities) {
      const { ctrl } = e;
      if (!is_bot_ctrl(ctrl)) continue;
      if (!ctrl.goingto) continue;
      ctrl.come(e.position.x, e.position.y, e.position.z)
    }
  }
  on_dataset_change(k: string, curr: any, prev: any) {
    if (k === 'render_w' || k === 'render_h')
      this.renderer.set_render_resolution?.(this.dataset.render_w, this.dataset.render_h);
    else if (k === 'screen_w' || k === 'screen_h')
      this.renderer.set_view_size?.(this.dataset.screen_w, this.dataset.screen_h);
    this.callbacks.call('on_dataset_change', k as any, curr, prev, this)
  };
  apply_render_resolution(w: number, h: number): this {
    this.dataset.render_w = w;
    this.dataset.render_h = h;
    const viewport = Defines.resolution_viewport(w, h);
    if (viewport) {
      this.dataset.screen_w = viewport.w;
      this.dataset.screen_h = viewport.h;
    }
    return this;
  }
  get view_w(): number { return this.dataset.screen_w }
  get view_h(): number { return this.dataset.screen_h }
  get design_view_w(): number { return Defines.SAFE_SCREEN_WIDTH / (this.bg.zoom_x || 1) }
  get design_view_h(): number { return Defines.SAFE_SCREEN_HEIGHT / (this.bg.zoom_y || 1) }
  get ui_left(): number { return (this.view_w - Defines.SAFE_SCREEN_WIDTH) / 2 }
  get ui_top(): number { return (this.view_h - Defines.SAFE_SCREEN_HEIGHT) / 2 }
  ui_from_scene(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx + 1) / 2 * this.view_w - this.ui_left,
      y: (1 - sy) / 2 * this.view_h - this.ui_top,
    };
  }
  scene_from_ui(x: number, y: number): { x: number; y: number } {
    return {
      x: this.view_w > 0 ? ((x + this.ui_left) / this.view_w) * 2 - 1 : 0,
      y: this.view_h > 0 ? 1 - ((y + this.ui_top) / this.view_h) * 2 : 0,
    };
  }
  get player_l() { return this.stage.player_l; }
  get player_r() { return this.stage.player_r; }
  get left() { return this.stage.left; }
  get right() { return this.stage.right; }
  get near() { return this.stage.near; }
  get far() { return this.stage.far; }
  get width() { return this.stage.width; }
  get depth() { return this.stage.depth; }
  get middle() { return this.stage.middle; }
  get paused() { return this._paused == 1; }
  set paused(v: boolean) { this.set_paused(v ? 1 : 0); }
  get fn_locked(): boolean { return this._fn_locked == 1; }
  set fn_locked(v: boolean) { this.set_fn_locked(v ? 1 : 0); }
  get counts(): ReadonlyMap<string, number> { return this._counts }
  get game_time() { return this._game_time.value }
  get lifetime() { return this._lifetime }

  constructor(lfw: LFW, screen?: { screen_w?: number; screen_h?: number }) {
    this.lfw = lfw;
    if (screen?.screen_w && screen?.screen_h) {
      this.dataset.screen_w = screen.screen_w;
      this.dataset.screen_h = screen.screen_h;
    }
    this._bg = new Background(this, Defines.VOID_BG);
    this.transform.set_scale(this._bg.zoom_x, this._bg.zoom_y, this._bg.zoom_z)
    this._stage = new Stage(this, Defines.VOID_STAGE);
    this.renderer = new Ditto.WorldRender(this);
    this.camera = new Camera(this);
    this.dataset.on_dataset_change = this.on_dataset_change.bind(this)
  }
  team_come(_team: string, x: number, y: number, z: number) {
    for (const e of this.entities) {
      const { ctrl, team } = e;
      if (_team === team && is_bot_ctrl(ctrl)) {
        ctrl.come(x, y, z)
      }
    }
  }
  team_move(_team: string) {
    for (const e of this.entities) {
      const { ctrl, team } = e;
      if (_team === team && is_bot_ctrl(ctrl)) {
        ctrl.move()
      }
    }
  }
  team_stay(_team: string) {
    for (const e of this.entities) {
      const { ctrl, team } = e;
      if (_team === team && is_bot_ctrl(ctrl)) {
        ctrl.stay()
      }
    }
  }
  team_follow(target: Entity) {
    for (const e of this.entities) {
      const { ctrl, team } = e;
      if (target.team === team && is_bot_ctrl(ctrl)) {
        ctrl.follow(target)
      }
    }
  }
  add_entities(...entities: Entity[]) {
    for (const e of entities) {
      if (this.entity_map.has(e.id)) continue;

      if (is_fighter(e)) {
        this.callbacks.call("on_fighter_add", e);
        const player = this.lfw.players.get(e.ctrl.player_id)
        if (player) { // ugly. -Gim
          player.fighter = e;
          this.puppets.set(e.ctrl.player_id, e);
          e.puppet = true
          this.callbacks.call("on_puppet_add", e.ctrl.player_id);
        }
      }
      if (e.ghosted) this.ghosts.push(e);
      else this.entities.push(e);
      this.entity_map.set(e.id, e)
      this.renderer.add_entity(e);
      this.mark_players_alive(e, is_human_ctrl(e.ctrl) && e.hp > 0);
    }
  }

  list_entities(name: string, predicate: (o: Entity) => boolean): ReadonlyArray<Entity> {
    let ret = this._entities_map.get(name)
    if (ret) return ret;
    this._entities_map.set(name, ret = [])
    for (const o of this.entities) {
      if (predicate(o)) {
        ret.push(o);
      }
    }
    return ret;
  }


  del_entity(entity: Entity): this {
    entity.set_frame(GONE_FRAME_INFO)
    return this
  }

  del_entities(entities: Entity[]): this {
    for (const e of entities)
      this.del_entity(e);
    return this;
  }

  stop_render() {
    if (this._render_worker_id) Ditto.Render.del(this._render_worker_id);
    this._render_worker_id = 0;
  }
  get FPS() {
    switch (this.dataset.sync_render as SyncRenderEnum) {
      case SyncRenderEnum.Unlimited: return 1000
      case SyncRenderEnum.FPS_60: return 60
      case SyncRenderEnum.FPS_120: return 120
      case SyncRenderEnum.Sync: return this.dataset.UPS
      case SyncRenderEnum.Half: return floor(this.dataset.UPS / 2)
    }
  }
  start_render() {
    const { sync_render } = this.dataset
    const { FPS } = this;
    if (this._render_worker_id) Ditto.Render.del(this._render_worker_id);
    if (sync_render == SyncRenderEnum.Sync) return;
    if (sync_render == SyncRenderEnum.Half) return;
    let prev_time = 0;
    let fix_radio = 1;
    const ideally_dt = 1000 / FPS;
    const on_render = (time: number) => {
      if (prev_time == 0) {
        prev_time = time;
        return;
      }
      const real_dt = time - prev_time;
      if (real_dt < fix_radio * ideally_dt) return;
      this.render_once(real_dt);
      this._FPS.update(real_dt);
      if (this._need_FPS) this.callbacks.call("on_fps_update", this._FPS.value);
      fix_radio = 1 - clamp(6 * (FPS - this._FPS.value) / FPS, 0, 1);
      prev_time = time;
    };
    if (this._render_worker_id) Ditto.Render.del(this._render_worker_id);
    this._render_worker_id = Ditto.Render.add(on_render);
  }

  stop_update() {
    this._update_worker?.stop();
    this._update_worker = void 0;
  }
  get ticker(): Ticker | undefined { return this._update_worker }
  before_update?(): void;
  after_update?(): void;
  sleep(): void {
    this._sleeping = true;
    this._update_worker?.pause();
  }
  awake(): void {
    this._sleeping = false;
    this._update_worker?.resume();
  }

  protected base_step_ms(): number {
    let { playrate, UPS, atom_time } = this.dataset;
    if (!between(playrate, 0.01, 1000)) {
      Ditto.warn(`[${World.TAG}::start_update] playrate must be between 0.01 and 1000, but got ${playrate}, now reset to 1.0`);
      playrate = this.dataset.playrate = 1
    }
    if (UPS !== 30 && UPS !== 60) {
      Ditto.warn(`[${World.TAG}::start_update] UPS must be 30 or 60, but got ${UPS}, now reset to 60`);
      UPS = this.dataset.UPS = 60
      atom_time = this.dataset.atom_time = 1;
    }
    if (!(atom_time > 0)) {
      Ditto.warn(`[${World.TAG}::start_update] atom_time must be > 0, but got ${atom_time}, now reset to 1`);
      atom_time = this.dataset.atom_time = 1;
    }
    return 1000 / UPS / playrate;
  }

  protected update_once(dt: number): void {
    if (this._sleeping) return;
    this.before_update?.();
    if (this._sleeping) return;
    this.step();
    this._lifetime++;
    this.lfw.cmds.length = 0;
    this.lfw.lcmds.length = 0;
    this.lfw.broadcasts.length = 0;
    if (this.extra_steps > 0) this.catch_up();

    const { sync_render } = this.dataset;
    if (sync_render == SyncRenderEnum.Sync) {
      this.render_once(dt);
      this._FPS.update(dt);
      if (this._need_FPS) this.callbacks.call("on_fps_update", this._FPS.value);
    } else if (sync_render == SyncRenderEnum.Half && floor(this._lifetime / this.dataset.playrate) % 2) {
      this.render_once(dt * 2);
      this._FPS.update(dt * 2);
      if (this._need_FPS) this.callbacks.call("on_fps_update", this._FPS.value);
    }

    const worker = this._update_worker;
    if (worker) {
      this.TU = (1000 / this.dataset.UPS) * worker.span;
      if (this._need_UPS)
        this.callbacks.call("on_ups_update", worker.rate, 0, 1 / worker.span);
    }
    this.after_update?.();

    if (this.dataset.sync_render !== sync_render)
      this.start_render();
  }

  /**
   * 追帧：在时间预算内连续推进多帧（不渲染），直到驱动说停（world.sleep）或预算用尽
   */
  protected catch_up(): void {
    const t0 = Ditto.Clock.now();
    for (let i = 0; i < this.extra_steps; i++) {
      if (this._sleeping) break;
      this.before_update?.();
      if (this._sleeping) break;
      this.step();
      this._lifetime++;
      this.lfw.cmds.length = 0;
      this.lfw.broadcasts.length = 0;
      this.after_update?.();
      if (Ditto.Clock.now() - t0 >= this.extra_step_budget_ms) break;
    }
  }

  start_update() {
    this.stop_update();
    this.base_step_ms();
    this.TU = 1000 / this.dataset.UPS;
    const worker = new Ticker({
      step_ms: () => this.base_step_ms(),
      on_step: (dt) => {
        try {
          this.update_once(dt);
          this._step_error_count = 0;
        } catch (e: any) {
          this.on_step_error(e);
        }
      },
    });
    this._update_worker = worker;
    worker.start();
  }

  private _step_error_count: number = 0;
  private _step_error_time: number = 0;
  protected on_step_error(e: any): void {
    this._step_error_count++;
    const now = Date.now();
    if (now - this._step_error_time > 1000) {
      this._step_error_time = now;
      Ditto.warn(e);
      if (e?.errors) Ditto.warn(e.errors);
    }
    if (this._step_error_count >= MAX_STEP_ERRORS) {
      Ditto.warn(`[${World.TAG}::start_update] ${this._step_error_count} times update error in a row, stop update loop`);
      this.stop_update();
    }
  }

  private _bound: [number, number, number, number] = [0, 0, 0, 0]
  get_bound(e: Entity): [number, number, number, number] {
    const {
      player_l, player_r, enemy_l, enemy_r, team, near, far,
      drink_l, drink_r
    } = this.stage;
    let l = Number.MIN_SAFE_INTEGER;
    let r = Number.MAX_SAFE_INTEGER;
    if (is_fighter(e)) {
      if (e.team === team) {
        l = enemy_l;
        r = enemy_r;
      } else {
        l = player_l;
        r = player_r;
      }
    } else if (is_weapon(e) && e.base_type == WT.Drink) {
      l = drink_l;
      r = drink_r;
    }
    this._bound[0] = l;
    this._bound[1] = r;
    this._bound[2] = near;
    this._bound[3] = far;
    return this._bound;
  }

  /** TODO: 感觉这不太对 */
  protected apply_cliff(e: Entity, seg: Readonly<ITerrainInfo>, x: number, z: number): void {
    e.terrain = this.terrain.base;
    if (!is_fighter(e)) {
      e.enter_frame(Defines.NEXT_FRAME_GONE);
      return;
    }
    const frame_id = seg.cliff_frame || e.data.indexes?.injured?.[e.facing === 1 ? 1 : -1];
    e.position.x = x;
    e.position.z = z;
    e.position.y = seg.cliff_respawn_y ?? this.bg.height;
    e.velocity.y = 0;
    if (frame_id) e.enter_frame_by_id(frame_id);
  }

  private _ret_restric: IVector3Like & { terrain: Readonly<ITerrainInfo> } = {
    x: 0, y: 0, z: 0,
    terrain: TerrainWorld.horizon
  }
  /**
   * 限制“实体”位置
   *
   * @param {Entity} e
   * @memberof World
   */
  restrict(e: Entity): typeof this._ret_restric {
    let { x, z } = e.position;
    let y = e.position.y;
    const ret = this._ret_restric;
    if (e.bearer || e.catcher || e.ghosted) {
      ret.terrain = this.terrain.base;
      ret.x = x;
      ret.y = y;
      ret.z = z;
      return ret;
    }
    const [left, right, near, far] = this.get_bound(e);
    x = clamp(x, left, right);
    z = clamp(z, far, near);
    if (is_weapon(e)) {
      if (e.is_on_ground && x < left - e.l_len || x > right + e.r_len) {
        e.enter_frame(Defines.NEXT_FRAME_GONE);
        ret.terrain = this.terrain.base;
        ret.x = x;
        ret.y = y;
        ret.z = z;
        return ret;
      }
    } else if (is_ball(e)) {
      if (x < left - 800 - e.l_len || x > right + 800 + e.r_len) {
        e.enter_frame(Defines.NEXT_FRAME_GONE);
        ret.terrain = this.terrain.base;
        ret.x = x;
        ret.y = y;
        ret.z = z;
        return ret;
      }
    }

    const rising = e.velocity.y > 0;
    const prev_y = e.prev_position.y;

    /* TODO: 感觉不太对 */
    let drop_through = false;
    if (
      is_fighter(e) &&
      e.is_on_ground &&
      e.terrain?.through &&
      (e.ctrl.is_hit(GK.D) || e.ctrl.is_hit(GK.Defend)) &&
      y > e.ground_y - 1
    ) {
      y = e.ground_y - 1;
      drop_through = true;
    }

    let seg = this.terrain.segment(x, z, y, rising, prev_y, drop_through);
    if (seg.cliff && y <= this.terrain.y(seg, x, z) + this.terrain.step) {
      this.apply_cliff(e, seg, x, z);
      ret.x = e.position.x;
      ret.y = e.position.y;
      ret.z = e.position.z;
      return ret;
    }

    if (null != this.terrain.enterable(seg, x, y, z)) {
      ret.terrain = seg;
      ret.x = x;
      ret.y = y;
      ret.z = z;
      return ret;
    }

    // 被地形挡住：只处理水平方向。按上一帧在阻挡地形的哪一侧，退回那一侧的面；
    // 上一帧就在地形内部的那一轴不动，竖向穿透交给 update_landable 落地。
    const prev_x = e.prev_position.x;
    const prev_z = e.prev_position.z;
    if (prev_x <= seg.x1) x = seg.x1 - 1;
    else if (prev_x >= seg.x2) x = seg.x2 + 1;
    if (prev_z <= seg.z1) z = seg.z1 - 1;
    else if (prev_z >= seg.z2) z = seg.z2 + 1;
    x = clamp(x, left, right);
    z = clamp(z, far, near);
    seg = this.terrain.segment(x, z, y, rising, prev_y, drop_through);

    ret.terrain = seg;
    ret.x = x;
    ret.y = y;
    ret.z = z;
    return ret;
  }

  protected update_ui() {
    const { layers } = this.lfw;
    const uidt = round_float(16.66666 * this.dataset.atom_time);
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers.at(i);
      if (!layer) continue;
      const n = layer.live_count;
      for (let j = 0; j < n; j++) {
        const ui = layer.live_at(j);
        if (!ui || ui.disabled) continue;
        ui.update(uidt);
      }
    }
    this.lfw.host_node.update(uidt);
  }

  change_bg(bg_id: string | undefined): void {
    if (this.stage.bg.id == bg_id)
      return;

    let bg_data: IBgData | undefined;
    if (bg_id == Defines.RANDOM_BG.id) {
      if (this.dataset.LF2_NET) {
        bg_data = this.lfw.datas.get_random_bg([BGG.Regular, BGG.Hidden])
      } else {
        bg_data = this.lfw.datas.get_random_bg([BGG.Regular])
      }
    } else if (bg_id) {
      bg_data = this.lfw.datas.find_background(bg_id);
    }
    if (!bg_data) bg_data = Defines.VOID_BG;

    const stage = new Stage(this, Defines.VOID_STAGE);
    stage.change_bg(bg_data);
    this.stage = stage
  }

  change_stage(stage_id: string | undefined) {
    const stage_data = this.lfw.datas.stages.find((v) => v.id === stage_id) || Defines.VOID_STAGE;
    if (stage_data == this.stage.data) return;
    this.stage = new Stage(this, stage_data);
  }
  get stage_limit() {
    return this.stage.id !== Defines.VOID_STAGE.id && !this.lfw.is_cheat(CheatEnum.HERO_FT)
  }
  protected handle_cmds() {
    const { cmds, lcmds } = this.lfw;
    if (cmds.length) CMDS.handle(this, cmds);
    if (lcmds.length) CMDS.handle(this, lcmds);
  }

  mark_players_alive(e: Entity, is_alive: boolean) {
    if (is_alive) this._alive_players.add(e);
    else this._alive_players.delete(e);
    this.has_players_alive = this._alive_players.size > 0;
  }

  protected collect_dead_buff(buff: Buff): void {
    buff.update(this.dataset.atom_time);
    if (buff.dead) this._dead_buffs.push(buff);
  }

  step() {
    this._entities_map.clear();
    this.transform.update();
    // this.handle_keys();
    this.update_ui();
    this.handle_cmds();
    this.update_camera();
    this.bg.update();

    if (this._paused == 1) return;
    if (this._paused == 2) this._paused = 1
    this._game_time.add();
    this.team_alive_counts.clear();
    this.puppet_teams.clear()

    if (this.stage.world_pause) return;
    if (Ditto.DEV && this.entities.length > MAX_DEBUG_ENTITIES)
      Ditto.debug(`[World::update_once]entities.size = ${this.entities.length}`)
    this.collisions.clear();
    this._pair_collisions.clear();
    this.pairs_compared = 0;
    this._dead_buffs.length = 0;
    this.buffs.forEach(this.collect_dead_buff, this);
    for (let i = 0; i < this._dead_buffs.length; i++) {
      const buff = this._dead_buffs[i];
      buff.unmount();
      this.buffs.delete(buff.id);
      this.lfw.factory.recycle_buff(buff);
    }

    let offset = 0;
    let puppet_x_sum = 0;
    let puppet_z_sum = 0;
    let puppet_y_sum = 0;
    let puppet_count = 0;
    let local_x_sum = 0;
    let local_z_sum = 0;
    let local_y_sum = 0;
    let human_x_sum = 0;
    let human_z_sum = 0;
    let human_y_sum = 0;
    let fighter_x_sum = 0;
    let fighter_z_sum = 0;
    let fighter_y_sum = 0;
    let local_count = 0;
    let human_count = 0;
    let fighter_count = 0;
    const view_w = this.design_view_w
    // 前瞻量：固定世界距离（不随 zoom 缩放，zoom 越大屏幕上前瞻越明显）
    const lead = Defines.SAFE_SCREEN_WIDTH / 6
    const entities = this.entities;
    const ghosts = this.ghosts;
    for (let i = 0; i < entities.length; i++) {
      const a = entities[i];
      if (offset) entities[i - offset] = a;
      if (a.frame.id === FID.Gone || a.state === SE.Gone) {
        a.hp = a.hp_r = 0;
        this._gones.add(a);
        ++offset
        continue;
      }
      if (this._gones.has(a)) {
        ++offset
        continue;
      }
      a.update();

      if (is_fighter(a)) {
        if (a.hp > 0) {
          const { team } = a;
          const count = this.team_alive_counts.get(team) ?? 0;
          this.team_alive_counts.set(team, count + 1);
        }
        const x = a.position.x - view_w / 2 + a.facing * lead;
        const z = a.position.z;
        const y = a.position.y;
        fighter_x_sum += x;
        fighter_z_sum += z;
        fighter_y_sum += y;
        fighter_count++;
        if (is_human_ctrl(a.ctrl) && a.hp > 0) {
          if (a.ctrl.player.mine) {
            local_x_sum += x;
            local_z_sum += z;
            local_y_sum += y;
            local_count++;
          } else {
            human_x_sum += x;
            human_z_sum += z;
            human_y_sum += y;
            human_count++;
          }
        }
        if (a.puppet == true) {
          this.puppet_teams.add(a.team)
          puppet_x_sum += x;
          puppet_z_sum += z;
          puppet_y_sum += y;
          puppet_count++;
        }
      }
    }
    entities.length -= offset;

    let goffset = 0;
    for (let i = 0; i < ghosts.length; i++) {
      const a = ghosts[i];
      if (goffset) ghosts[i - goffset] = a;
      if (a.frame.id === FID.Gone || a.state === SE.Gone) {
        a.hp = a.hp_r = 0;
        this._gones.add(a);
        ++goffset
        continue;
      }
      if (this._gones.has(a)) {
        ++goffset
        continue;
      }
      a.update_ghost();
    }
    ghosts.length -= goffset;

    const len = entities.length;
    entities.sort(x_sorter);
    this.ground_weapon_counts.clear();

    for (let i = 0; i < len; i++) {
      const a = entities[i];
      if (a.frame.id === FID.Gone) continue;
      if (is_weapon(a) && a.is_on_ground) {
        const section = round(a.position.x / WEAPON_X_SECTION);
        const count = this.ground_weapon_counts.get(section) ?? 0;
        this.ground_weapon_counts.set(section, count + 1)
      }
      const { ctrl, lifetime } = a
      const lookingup = 0 == (lifetime % LOOKUP_UPDATE_INTERVAL);
      if (lookingup && (is_ball_ctrl(ctrl) || is_bot_ctrl(ctrl)))
        ctrl.update_lookup(i, entities)

      const a_max_x = a.aabb_max_x;
      const a_min_z = a.aabb_min_z;
      const a_max_z = a.aabb_max_z;
      for (let j = i + 1; j < len; j++) {
        const b = entities[j];
        if (a_max_x < b.aabb_min_x) break;
        if (b.frame.id === FID.Gone) continue;
        if (a_max_z < b.aabb_min_z || b.aabb_max_z < a_min_z) continue;
        // 细致的碰撞判定
        this.pairs_compared++;
        const c1 = collision_get(a, b);
        const c2 = collision_get(b, a);
        const p1 = c1?.priority ?? Infinity;
        const p2 = c2?.priority ?? Infinity;
        if (c1 && p1 <= p2) this.add_collision(c1)
        if (c2 && p2 <= p1) this.add_collision(c2)
      }
    }

    // 高地图（bg.height 超过经典屏高）用“角色平均高度”驱动镜头 Y，让相机能上下跟；
    // 普通/老地图沿用 z 深度（经典数据里 far 承载了纵向范围，保持原行为）
    const half_h = this.design_view_h / 2
    const use_y = (this.bg.data.dataset?.cam_y_follow ?? 0) > 0;
    let cam_x = NaN;
    let cam_z = 0;
    let cam_y = 0;
    if (local_count) {
      cam_x = local_x_sum / local_count;
      cam_z = local_z_sum / local_count;
      cam_y = local_y_sum / local_count;
    } else if (human_count) {
      cam_x = human_x_sum / human_count;
      cam_z = human_z_sum / human_count;
      cam_y = human_y_sum / human_count;
    } else if (puppet_count) {
      cam_x = puppet_x_sum / puppet_count;
      cam_z = puppet_z_sum / puppet_count;
      cam_y = puppet_y_sum / puppet_count;
    } else if (fighter_count) {
      cam_x = fighter_x_sum / fighter_count;
      cam_z = fighter_z_sum / fighter_count;
      cam_y = fighter_y_sum / fighter_count;
    }
    if (!isNaN(cam_x)) {
      this.camera.destination.x = round(cam_x);
      this.camera.destination.y = use_y
        ? round(cam_y) - half_h
        : -0.5 * round(cam_z) - half_h;
    }

    this.collisions.forEach(c => collisions_keeper.handle(c));

    for (const entity of this._gones) {
      this.entity_map.delete(entity.id)
      this.mark_players_alive(entity, false)
      if (is_fighter(entity))
        this.callbacks.call("on_fighter_del", entity);
      const player = this.lfw.players.get(entity.ctrl.player_id)
      if (player) player.fighter = void 0
      const puppet = this.puppets.get(entity.ctrl.player_id)
      if (puppet === entity) this.puppets.delete(entity.ctrl.player_id);
      entity.puppet = false
      this.callbacks.call("on_puppet_del", entity.ctrl.player_id);
      this.renderer.del_entity(entity);
      entity.release();
      this.lfw.factory.recycle_entity(entity)
    }
    this._gones.clear()
    this.stage.update();
  }

  protected add_collision(collision: Collision) {
    const prev = this.collisions.get(collision.id)
    if (prev && prev.m_distance <= collision.m_distance) return;

    if (prev) this._pair_collisions.delete(prev.aid, prev.vid);
    this.collisions.set(collision.id, collision);
    this._pair_collisions.add(collision.aid, collision.vid, collision);
  }

  render_once(dt: number) {
    const t0 = Ditto.Clock.now();
    this.renderer.render(dt);
    const spent = Ditto.Clock.now() - t0;
    this.render_cost = this.render_cost ? this.render_cost * 0.9 + spent * 0.1 : spent;
  }

  update_camera() {
    const old_cam_x = round(this.camera.position.x);
    const old_cam_y = round(this.camera.position.y);
    this.camera.update();
    const new_cam_x = round(this.camera.position.x);
    const new_cam_y = round(this.camera.position.y);
    if (old_cam_x !== new_cam_x || old_cam_y !== new_cam_y)
      this.callbacks.call("on_cam_move", new_cam_x, new_cam_y);
  }

  /**
   * 火花特效
   *
   * @param {number} x x坐标
   * @param {number} y y坐标
   * @param {number} z z坐标
   * @param {string} f 帧ID
   * @return {void}
   * @memberof World
   */
  spark(x: number, y: number, z: number, f: string): void {
    if (this.entities.length + this.ghosts.length > MAX_DEBUG_ENTITIES) return;
    const oid = Defines.BuiltIn_Dats.Spark
    if (!this._spark_data)
      this._spark_data = this.lfw.datas.find(oid);
    const data = this._spark_data
    if (!data) {
      Ditto.warn(`[${World.TAG}::spark] "${oid}" data not found!`);
      return;
    }
    const e = this.lfw.factory.create_entity(this, data);
    if (!e) {
      Ditto.warn(`[${World.TAG}::spark] failed`);
      return;
    }
    e.outline_alpha = 0;
    e.outline_width = 0;
    e.outline_color = '';
    e.set_position(x, y, z);
    e.enter_frame_by_id(f);
    e.attach(true);
  }
  etc(x: number, y: number, z: number, f: string): void {
    if (!this._etc_data) this._etc_data = this.lfw.datas.find(O_ID.Etc);
    const data = this._etc_data;
    if (!data) {
      Ditto.warn(`[${World.TAG}::etc] oid "${O_ID.Etc}" data not found!`);
      return;
    }
    const e = this.lfw.factory.create_entity(this, data)
    if (!e) {
      Ditto.warn(`[${World.TAG}::etc] failed`);
      return;
    }
    e.position.set(round(x), round(y), round(z));
    e.enter_frame_by_id(f);
    e.attach(false);
  }
  get_bounding(e: Entity, f: IFrameInfo, i: IItrInfo | IBdyInfo): IBounding {
    const {
      x = 0, y = 0, w = 0, h = 0,
      l = Defines.DAFUALT_QUBE_LENGTH,
      z = -Defines.DAFUALT_QUBE_LENGTH / 2
    } = i
    const left =
      e.facing > 0
        ? e.position.x - f.centerx + x
        : e.position.x + f.centerx - x - w;
    const top = e.position.y + f.centery - y;
    const far = e.position.z + z;
    return {
      left: round(left),
      right: round(left + w),
      top: round(top),
      bottom: round(top - h),
      far: round(far),
      near: round(far + l),
    };
  }

  set_paused(v: 0 | 1 | 2) {
    if (this._paused === v) return;
    const changed = (!v) !== (!this._paused)
    this._paused = v;
    if (changed) this.callbacks.call("on_pause_change", !!v);
  }

  set_fn_locked(v: 0 | 1) {
    if (this._fn_locked === v) return;
    this._fn_locked = v;
    this.callbacks.call("on_fn_locked_change", v);
  }

  dispose() {
    this.callbacks.call("on_disposed");
    this.stop_update();
    this.stop_render();
    this.del_entities(Array.from(this.entities));
    this.del_entities(Array.from(this.ghosts));
    this._alive_players.clear();
    this.has_players_alive = false;
    this.renderer.dispose();
    this.callbacks.clear()
  }

  add_count(key: string, o: number) {
    const v = this._counts.get(key) || 0
    this._counts.set(key, v + o);
    this.callbacks.call('on_counts');
  }

  clear() {
    this.set_fn_locked(0);
    this.dataset.infinity_mp = 0;
    this.dataset.playrate = 1;
    this.extra_steps = 0;
    this.entities.forEach(v => v.set_frame(GONE_FRAME_INFO))
    this.ghosts.forEach(v => v.set_frame(GONE_FRAME_INFO))
    this.buffs.forEach(v => v.duration = 0)
    if (this.stage.id !== Defines.VOID_STAGE.id)
      this.stage = new Stage(this, Defines.VOID_STAGE)
    if (this.stage.bg.id !== Defines.VOID_BG.id)
      this.stage.change_bg(Defines.VOID_BG)
    this.paused = false;
    this.camera.reset()
    this._alive_players.clear();
    this.has_players_alive = false;
    this.callbacks.call('on_counts');
    this._counts.clear()
  }

  reset_game_time(): void {
    this._game_time.reset()
  }

  find_entity(id: string) {
    return this.entity_map.get(id);
  }

  get_collision(aid: string, vid: string): Collision | undefined {
    return this._pair_collisions.first(aid, vid);
  }

  has_collision(aid: string, vid: string): boolean {
    return this._pair_collisions.has(aid, vid);
  }

  get_collisions(aid: string, vid: string, out: Collision[] = []): Collision[] {
    return this._pair_collisions.collect(aid, vid, out);
  }

  weapon_section_at(x: number): number {
    return round(x / WEAPON_X_SECTION);
  }

  random_weapon_x(exclude_section?: number): number {
    const { mt } = this.lfw;
    const { left, right } = this;
    const width = right - left;
    let band_x = 0;
    let band_len = 0;
    if (exclude_section != null) {
      const half = WEAPON_X_SECTION / 2;
      const l = max(left, exclude_section * WEAPON_X_SECTION - half);
      const r = min(right, exclude_section * WEAPON_X_SECTION + half);
      if (r - l < width) {
        band_x = l;
        band_len = max(0, r - l);
      }
    }
    let x = mt.range(left, right - band_len);
    if (band_len > 0 && x >= band_x) x += band_len;
    return x;
  }

  weapon_count_at(x: number): number {
    return this.ground_weapon_counts.get(this.weapon_section_at(x)) ?? 0
  }

  /** Map<队伍, 队伍存活人数> */
  private readonly team_alive_counts = new Map<string, number>();


  private calc_alives() {

    this.puppet_teams.clear();
    this.team_alive_counts.clear();
    for (const e of this.entities) {
      if (!is_fighter(e)) continue;
      if (e.hp <= 0) continue;
      const { team, puppet } = e;
      const count = this.team_alive_counts.get(team) ?? 0;
      this.team_alive_counts.set(team, count + 1);
      if (puppet) this.puppet_teams.add(team)
    }
  }


  game_result(refresh: boolean = false): '' | 'drawn' | 'over' | 'win' {
    if (refresh) this.calc_alives();
    const { team_alive_counts } = this;

    /* 大于一队，游戏未结束 */
    if (team_alive_counts.size > 1) return '';
    if (team_alive_counts.size <= 0) return 'drawn';

    /* 非闯关模式下，剩余队伍 <= 1, 游戏结束 */
    if (this.stage.id === Defines.VOID_STAGE.id)
      return 'over';

    /* 玩家队伍是否存活 */
    let puppet_team_alive = false;
    for (const team of this.puppet_teams) {
      if (this.team_alive_counts.has(team)) {
        puppet_team_alive = true;
        break;
      }
    }

    if (!puppet_team_alive)
      return 'over'

    if (!this.stage.is_stage_finish || !this.stage.is_chapter_finish)
      return '';

    return 'win';
  }
}