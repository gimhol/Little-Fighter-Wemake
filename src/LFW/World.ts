import { Callbacks } from './base/Callbacks';
import { FPS } from './base/FPS';
import { Background } from "./bg/Background";
import { Buff } from "./buff/Buff";
import { type Collision, collision_get } from "./collision/Collision";
import { collisions_keeper } from "./collision/CollisionKeeper";
import { BallController } from "./controller/BallController";
import {
  BFID,
  BGG,
  CheatEnum,
  Defines,
  Difficulty,
  EntityGroup,
  GONE_FRAME_INFO,
  type IBdyInfo, type IBgData, type IBounding, type IEntityData,
  type IFrameInfo, type IItrInfo,
  type IVector2,
  type IVector3Like,
  O_ID,
  SE,
  WeaponEnum
} from "./defines";
import { CMD } from "./defines/CMD";
import { SyncRenderEnum } from "./defines/SyncRenderEnum";
import { Ditto } from './ditto/Instance';
import type { IWorldRenderer } from "./ditto/render/IWorldRenderer";
import {
  Entity,
  is_ball,
  is_bot_ctrl,
  is_fighter,
  is_human_ctrl,
  is_weapon
} from "./entity";
import { Ground } from "./Ground";
import type { IWorldCallbacks } from "./IWorldCallbacks";
import { LFW } from "./LFW";
import { Stage } from "./stage/Stage";
import { Transform } from "./Transform";
import { abs, between, floor, max, min, round, sign } from './utils/math/base';
import { clamp } from './utils/math/clamp';
import { Times } from './utils/Times';
import { is_num } from './utils/type_check/is_num';
import { WorldDataset } from "./WorldDataset";
const CHASING_UPDATE_INTERVAL = 8;
const MAX_DEBUG_ENTITIES = 355
const x_sorter = (a: Entity, b: Entity) => a.aabb_min_x - b.aabb_min_x
const z_sorter = (a: Entity, b: Entity) => a.aabb_min_z - b.aabb_min_z
const pair_key = (a: Entity, b: Entity) => a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;

/**
 * TODO:
 *    这个继承似乎不太好。
 *    后续提取为World::dataset
 *      - Gim
 */
export class World {
  static readonly TAG: string = "World";
  readonly lfw: LFW;
  readonly dataset: WorldDataset = new WorldDataset()
  readonly callbacks = new Callbacks<IWorldCallbacks>();
  private _sleeping: boolean = false;
  private _spark_data?: IEntityData;
  private _etc_data?: IEntityData;
  private _bg: Background;
  private _stage: Stage;
  private _need_FPS: boolean = true;
  private _need_UPS: boolean = true;
  private _FPS = new FPS(0.9);
  private _UPS = new FPS(0.9);
  private _lifetime: number = 0;
  private _render_worker_id?: ReturnType<typeof Ditto.Render.add>;
  private _update_worker_id?: ReturnType<typeof Ditto.Interval.add>;
  /** 
   * 临时实体列表
   *  
   * 每次更新前，此map会被清除
   */
  private _entities_map = new Map<string, Entity[]>();
  readonly buffs = new Map<string, Buff>();
  private _game_time = new Times();
  readonly ground = new Ground(this);
  private _counts = new Map<string, number>()
  /** 待移除实体 */
  private _gones = new Set<Entity>();
  // private _freshs = new Set<Entity>();
  private _chasers = new Set<BallController>();
  private _paused: 0 | 1 | 2 = 0;
  private _fn_locked: 0 | 1 = 0;
  private _cam_v: IVector2;
  readonly target_cam_pos: IVector2;
  readonly current_cam_pos: IVector2;
  /** 这种相机位置控制感觉有点问题 */
  private _dist_cam_pos: IVector2 | null = null
  private _lock_cam_pos: IVector2 | null = null


  public renderer: IWorldRenderer;

  readonly transform: Transform = new Transform()
  readonly entity_map = new Map<string, Entity>();
  readonly entities: Entity[] = [];
  /** 
   * 被玩家操作的角色 
   * 键: 玩家ID
   * 值: 角色
   */
  readonly puppets = new Map<string, Entity>();
  readonly puppet_teams = new Set<string>();
  readonly collisions = new Map<string, Collision>()
  public has_players_alive: boolean = false;
  TU: number = 1;
  private _z_pairs: Set<string> = new Set<string>();
  get bg() { return this._bg; }
  set bg(v: Background) {
    if (v === this._bg) return;
    const o = this._bg;
    this._bg = v;
    this.transform.scale_to(this._bg.zoom_x, this._bg.zoom_y, this._bg.zoom_z)
    o.dispose();
  }
  get stage() {
    return this._stage;
  }
  set stage(v) {
    if (v === this._stage) return;
    const o = this._stage;
    this._stage = v;
    this.callbacks.emit("on_stage_change")(v, o);
    o.dispose();
    v.enter_phase(0);
    for (const e of this.entities) {
      const { ctrl } = e;
      if (is_bot_ctrl(ctrl)) ctrl.cancel_goto()
    }
  }
  on_dataset_change(k: string, curr: any, prev: any) {
    this.callbacks.emit('on_dataset_change')(k as any, curr, prev, this)
    if (
      k === 'sync_render' ||
      k === 'UPS' ||
      k === 'atom_time' ||
      k === 'playrate'
    ) {
      this.start_render();
      this.start_update();
    }
  };
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
  get lock_cam_x() { return this._lock_cam_pos?.x }

  constructor(lfw: LFW) {
    this.lfw = lfw;
    this.target_cam_pos = Ditto.vec2();
    this.current_cam_pos = Ditto.vec2();
    this._cam_v = Ditto.vec2();
    this._bg = new Background(this, Defines.VOID_BG);
    this.transform.scale_to(this._bg.zoom_x, this._bg.zoom_y, this._bg.zoom_z)
    this._stage = new Stage(this, Defines.VOID_STAGE);
    this.renderer = new Ditto.WorldRender(this);
    this.dataset.on_dataset_change = this.on_dataset_change.bind(this)
  }
  team_come(_team: string, x: number, y: number, z: number) {
    for (const e of this.entities) {
      const { ctrl, team } = e;
      if (_team === team && is_bot_ctrl(ctrl)) {
        ctrl.goto(x, y, z)
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
      // this.freshs.add(entity)
      if (is_fighter(e)) {
        this.callbacks.emit("on_fighter_add")(e);
        const player = this.lfw.players.get(e.ctrl.player_id)
        if (player) {
          player.fighter = e;
          this.puppets.set(e.ctrl.player_id, e);
          e.puppet = true
          this.callbacks.emit("on_puppet_add")(e.ctrl.player_id);
        }
      }
      this.entities.push(e);
      this.entity_map.set(e.id, e)
      this.renderer.add_entity(e);
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
    this._gones.add(entity)
    // this._freshs.delete(entity)
    return this
  }

  del_entities(entities: Entity[]): this {
    for (const e of entities)
      this.del_entity(e);
    return this;
  }

  stop_render() {
    this._render_worker_id && Ditto.Render.del(this._render_worker_id);
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
    if (this._render_worker_id) Ditto.Render.del(this._render_worker_id);
    if (this.dataset.sync_render == SyncRenderEnum.Sync) return;
    if (this.dataset.sync_render == SyncRenderEnum.Half) return;


    let prev_time = 0;
    let fix_radio = 1;
    let ideally_dt = 1000 / this.FPS;
    let fps = this.FPS

    const on_render = (time: number) => {
      const real_dt = time - prev_time;
      if (real_dt < fix_radio * ideally_dt) return;
      this.render_once(real_dt);
      this._FPS.update(real_dt);
      if (this._need_FPS) this.callbacks.emit("on_fps_update")(this._FPS.value);
      fix_radio = 1 - clamp(6 * (fps - this._FPS.value) / fps, 0, 1);
      prev_time = time;
    };
    this._render_worker_id && Ditto.Render.del(this._render_worker_id);
    this._render_worker_id = Ditto.Render.add(on_render);
  }

  stop_update() {
    this._update_worker_id && Ditto.Interval.del(this._update_worker_id);
    this._update_worker_id = void 0;
  }
  before_update?(): void;
  after_update?(): void;
  sleep(): void { this._sleeping = true }
  awake(): void { this._sleeping = false }
  start_update() {
    let { playrate, UPS, atom_time, sync_render } = this.dataset;
    if (!between(playrate, 0.01, 1000)) {
      Ditto.warn(`[${World.TAG}::start_update] playrate must be between 0.01 and 1000, but got ${playrate}, now reset to 1.0`);
      playrate = this.dataset.playrate = 1
    }
    if (!between(UPS, 1, 120)) {
      Ditto.warn(`[${World.TAG}::start_update] UPS must be between 1 and 120, but got ${UPS}, now reset to 60`);
      UPS = this.dataset.UPS = 60
    }
    if (!(atom_time > 0)) {
      Ditto.warn(`[${World.TAG}::start_update] atom_time must be > 0, but got ${atom_time}, now reset to 1`);
      atom_time = this.dataset.atom_time = 1;
    }

    if (this._update_worker_id) Ditto.Interval.del(this._update_worker_id);
    let prev_time = Date.now();
    let fix_radio = 1;
    this.TU = 1000 / UPS;
    const ideally_dt = round(this.TU / playrate)
    const on_update = () => {
      try {
        const time = Date.now();
        const real_dt = time - prev_time;
        if (real_dt < fix_radio * ideally_dt) return;
        if (this._sleeping) return;
        this.before_update?.();
        this.step();
        this._lifetime++;
        this.lfw.events.length = 0;
        this.lfw.cmds.length = 0;
        this.lfw.broadcasts.length = 0;

        if (sync_render == SyncRenderEnum.Sync) {
          this.render_once(real_dt);
          this._FPS.update(real_dt);
          if (this._need_FPS) this.callbacks.emit("on_fps_update")(this._FPS.value);
        } else if (sync_render == SyncRenderEnum.Half && floor(this._lifetime / playrate) % 2) {
          this.render_once(real_dt * 2);
          this._FPS.update(real_dt * 2);
          if (this._need_FPS) this.callbacks.emit("on_fps_update")(this._FPS.value);
        }
        if (this._need_UPS) this.callbacks.emit("on_ups_update")(this._UPS.value, 0);
        this.after_update?.();
        this._UPS.update(real_dt);
        fix_radio = 1 - clamp(6 * (UPS - this._UPS.value) / UPS, 0, 1);
        prev_time = time;
      } catch (e: any) {
        Ditto.warn(e)
        if (e.errors) Ditto.warn(e.errors)
        this.stop_update();
      }
    };
    this._update_worker_id = Ditto.Interval.add(on_update, 0);
  }

  private _restrict_result: IVector3Like = { x: 0, y: 0, z: 0 }
  private _bound: [number, number, number, number] = [0, 0, 0, 0]
  get_bound(e: Entity): [number, number, number, number] {
    const { player_l, player_r, enemy_l, enemy_r, team, left, right, near, far } = this.stage;
    if (is_fighter(e)) {
      const is_player = e.team !== team;
      this._bound[0] = is_player ? player_l : enemy_l;
      this._bound[1] = is_player ? player_r : enemy_r;
    } else if (is_ball(e)) {
      this._bound[0] = left - 200;
      this._bound[1] = right + 200;
    } else if (is_weapon(e)) {
      this._bound[0] = left - 100;
      this._bound[1] = right + 100;
    } else {
      this._bound[0] = left;
      this._bound[1] = right;
    }
    this._bound[2] = near;
    this._bound[3] = far;
    return this._bound;
  }

  /**
   * 限制“实体”位置
   *
   * @param {Entity} e
   * @memberof World
   */
  restrict(e: Entity): IVector3Like {
    let { x, z, y } = e.position;
    if (e.bearer || e.catcher) {
      e.terrain = void 0;
      this._restrict_result.x = x;
      this._restrict_result.y = y;
      this._restrict_result.z = z;
      return this._restrict_result;
    }
    const [left, right, near, far] = this.get_bound(e);
    z = clamp(z, far, near)
    if (e.base_type === WeaponEnum.Drink) {
      const { drink_l, drink_r } = this.stage;
      x = clamp(x, drink_l, drink_r);
    } else if (is_fighter(e)) {
      x = clamp(x, left, right);
    } else if (x < left || x > right) {
      e.enter_frame(Defines.NEXT_FRAME_GONE);
      e.terrain = void 0;
      this._restrict_result.x = x;
      this._restrict_result.y = y;
      this._restrict_result.z = z;
      return this._restrict_result;
    }

    const seg = this.ground.segment(x, z);
    if (!seg) {
      e.terrain = void 0;
      this._restrict_result.x = x;
      this._restrict_result.y = y;
      this._restrict_result.z = z;
      return this._restrict_result;
    }
    const pos = this.ground.block(seg, x, y, z);
    if (pos?.length) {
      for (let i = 0; i < pos.length; i++) {
        const p = pos[i];
        const test_seg = this.ground.segment(p.x, p.z);
        if (test_seg && this.ground.block(test_seg, p.x, y, p.z)) {
          if (i == pos.length - 1) {
            // 无法挤出，直接抬上去算了
            e.terrain = seg;
            y = this.ground.y(seg, x, z);

          }
          continue;
        }
        // 成功挤出
        e.terrain = test_seg;
        x = p.x;
        z = p.z;
        break;
      }
    } else {
      e.terrain = seg;
    }
    this._restrict_result.x = x;
    this._restrict_result.y = y;
    this._restrict_result.z = z;
    return this._restrict_result;
  }

  add_chaser(ctrl: BallController) {
    this._chasers.add(ctrl);
  }
  del_chaser(ctrl: BallController) {
    this._chasers.delete(ctrl);
    ctrl.chase_pos.copy(ctrl.entity.position);
    ctrl.chasing = null;
  }

  protected update_ui() {
    const { ui_stacks } = this.lfw;
    const len = ui_stacks.length;
    let flag = true;

    for (let i = len - 1; i >= 0; i--) {
      const ui_stack = ui_stacks[i];
      const { ui } = ui_stack
      if (!ui || ui.disabled) continue;
      if (!flag) continue;
      for (const e of this.lfw.events) {
        if (e.pressed) ui.on_key_down(e)
        else ui.on_key_up(e)
      }
      ui.update(16.66666 * this.dataset.atom_time);
      flag = false
    }
  }

  protected handle_keys() {
    if (!this.lfw.events.length) return;

    for (const e of this.lfw.events) {
      const gk = e.game_key;
      const fn1 = e.pressed ? 'hit' : 'end';
      this.lfw._keys.forEach(keys => keys[gk][fn1]())

      // WTF.
      if (this.stage.control_disabled) continue;
      const fighter = this.puppets.get(e.player)
      if (!fighter) continue;
      const { ctrl } = fighter
      if (!is_human_ctrl(ctrl)) continue;

      const fn2 = e.pressed ? 'start' : 'end';
      ctrl[fn2](gk)
    }
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
  protected handle_cmds() {
    const { cmds } = this.lfw;
    if (!cmds.length) return;
    const stage_limit = () => this.stage.id !== Defines.VOID_STAGE.id && !this.lfw.is_cheat(CheatEnum.HERO_FT)
    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i];
      switch (cmd) {
        case CMD.SET_DIFFICULTY: {
          const d = Number(cmds[i += 1]);
          if (Difficulty[d]) this.dataset.difficulty = d;
          else Ditto.warn(`SET_DIFFICULTY failed, difficulty got ${d}.`)
          continue;
        }
        case CMD.DEL_PUPPET: {
          const player_id = cmds[i += 1];
          const entity = this.puppets.get(player_id);
          if (entity) this.del_entity(entity);
          else Ditto.warn('DEL_PUPPET failed, puppet not found.')
          continue;
        }
        case CheatEnum.LF2_NET: // same as "case CMD.LF2_NET:"
        case CheatEnum.HERO_FT: // same as "case CMD.HERO_FT:"
        case CheatEnum.GIM_INK: // same as "case CMD.GIM_INK:"
          const prev = this.dataset[cmd];
          const enabled = this.dataset[cmd] = Number(cmds[i += 1]) ? 1 : 0;
          if (prev == enabled) continue;
          const cheat = Defines.CheatInfos.get(cmd)
          if (!cheat) continue;
          if (cheat.sound) this.lfw.sounds.play_with_load(cheat.sound);
          this.lfw.callbacks.emit("on_cheat_changed")(cmd, !!enabled);
          continue;
        case CMD.F1: this.paused = !this.paused; continue;
        case CMD.F2: this.set_paused(2); continue;
        case CMD.F3: this.set_fn_locked(1); continue;
        case CMD.F4: this.lfw.pop_ui_safe(); continue;
        case CMD.F5: this.dataset.playrate = this.dataset.playrate === 1 ? 1000 : 1; continue;
        case CMD.F6:
          if (this.fn_locked || stage_limit()) continue;
          this.add_count(CMD.F6, 1)
          this.dataset.infinity_mp = this.dataset.infinity_mp ? 0 : 1;
          continue;
        case CMD.F7:
          if (this.fn_locked || stage_limit()) continue;
          this.add_count(CMD.F7, 1)
          for (const e of this.entities) {
            if (!is_fighter(e)) continue;
            e.hp = e.hp_r = e.hp_max;
            e.mp = e.mp_max;
          }
          continue;
        case CMD.F8:
          if (this.fn_locked || stage_limit()) continue;
          this.add_count(CMD.F8, 1)
          const is_stage = this.stage.id !== Defines.VOID_STAGE.id
          const weapon_datas = this.lfw.datas.get_weapons_of_group(is_stage ? EntityGroup.StageWeapon : EntityGroup.VsWeapon)
          for (const wd of weapon_datas) this.lfw.entities.add(wd, 1);
          continue;
        case CMD.F9:
          if (this.fn_locked || stage_limit()) continue;
          this.add_count(CMD.F9, 1)
          for (const e of this.entities) if (is_weapon(e)) e.hp = 0;
          continue;
        case CMD.F10:
          if (this.fn_locked || stage_limit()) continue;
          this.add_count(CMD.F10, 1)
          this.stage.kill_all()
          continue;
        case CMD.KILL_ENEMIES:
          if (!stage_limit()) this.stage.kill_all()
          continue;
        case CMD.KILL_BOSS:
          if (!stage_limit()) this.stage.kill_boss()
          continue;
        case CMD.KILL_SOLIDERS:
          if (!stage_limit()) this.stage.kill_soliders()
          continue;
        case CMD.KILL_OTHERS:
          if (!stage_limit()) this.stage.kill_others()
          continue;
        case CMD.DIST_CAM: {
          const value = cmds[i += 1]
          if (value === '') {
            this._dist_cam_pos = null;
            continue;
          }
          const [x, y = 0] = value.split(',').map(Number);
          if (isNaN(x) || isNaN(y)) {
            Ditto.warn(`DIST_CAM failed, value got ${value}.`)
            continue;
          }
          this._dist_cam_pos = Ditto.vec2(x, y);
          continue;
        }
        case CMD.LOCK_CAM: {
          const value = cmds[i += 1]
          if (value === '') {
            this._lock_cam_pos = null;
            continue;
          }
          const [x, y = 0] = value.split(',').map(Number);
          if (isNaN(x) || isNaN(y)) {
            Ditto.warn(`LOCK_CAM failed, value got ${value}.`)
            continue;
          }
          if (this.current_cam_pos.x != x)
            this.callbacks.emit("on_cam_move")(x, y);
          this._lock_cam_pos = Ditto.vec2(x, y);
          this.target_cam_pos.x = x;
          this.current_cam_pos.x = x;
          continue;
        }
        case CMD.CHANGE_BG:
          this.change_bg(cmds.at(i += 1))
          continue;

        case CMD.CHANGE_STAGE:
          this.change_stage(cmds.at(i += 1))
          continue;
      }
    }
  }

  step() {
    this._entities_map.clear();
    this.transform.update();
    this.handle_keys();
    this.update_ui();
    this.handle_cmds();
    this.update_camera();
    this.bg.update();

    if (this._paused == 1) return;
    if (this._paused == 2) this._paused = 1
    this._game_time.add();

    if (this.stage.world_pause) return;
    if (Ditto.DEV && this.entities.length > MAX_DEBUG_ENTITIES)
      Ditto.debug(`[World::update_once]entities.size = ${this.entities.length}`)
    this.collisions.clear();
    const temp_entities: Entity[] = [];
    const update_chasing = this._game_time.value % CHASING_UPDATE_INTERVAL === 0;
    const dead_buffs: [string, Buff][] = []
    this.buffs.forEach((buff, key) => {
      buff.update(this.dataset.atom_time)
      if (buff.dead) dead_buffs.push([key, buff])
    })
    for (const [key, buff] of dead_buffs) {
      buff.unmount();
      this.buffs.delete(key);
    }

    this.has_players_alive = false
    let offset = 0;
    let puppet_x_sum = 0;
    let puppet_z_sum = 0;
    let puppet_count = 0;
    let local_x_sum = 0;
    let local_z_sum = 0;
    let human_x_sum = 0;
    let human_z_sum = 0;
    let fighter_x_sum = 0;
    let fighter_z_sum = 0;
    let local_count = 0;
    let human_count = 0;
    let fighter_count = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const a = this.entities[i];
      if (offset) this.entities[i - offset] = a;
      if (a.frame.id === BFID.Gone || a.state === SE.Gone) {
        a.hp = a.hp_r = 0;
        this._gones.add(a);
        ++offset
        continue;
      }
      if (this._gones.has(a)) {
        ++offset
        continue;
      }

      if (!this.has_players_alive && a.hp > 0 && is_human_ctrl(a.ctrl))
        this.has_players_alive = true;

      a.update();
      const { __aabb_x1: bx1 = 0, __aabb_x2: fx1 = 0, __aabb_z1: bz1 = -12, __aabb_z2: bz2 = 12 } = a.frame;
      a.aabb_min_x = round(a.position.x + (a.facing > 0 ? bx1 : -fx1))
      a.aabb_max_x = round(a.position.x + (a.facing > 0 ? fx1 : -bx1))
      a.aabb_min_z = round(a.position.z + bz1)
      a.aabb_max_z = round(a.position.z + bz2)

      if (a.ghosted) continue;

      if (is_fighter(a)) {
        const x = a.position.x - this.dataset.screen_w / 2 + (a.facing * this.dataset.screen_w) / 6;
        const z = a.position.z;
        fighter_x_sum += x;
        fighter_z_sum += x;
        fighter_count++;
        if (is_human_ctrl(a.ctrl) && a.hp > 0) {
          if (a.ctrl.player.mine) {
            local_x_sum += x;
            local_z_sum += z;
            local_count++;
          } else {
            human_x_sum += x;
            human_z_sum += z;
            human_count++;
          }
        }
        if (a.puppet == true) {
          puppet_x_sum += x;
          puppet_z_sum += z;
          puppet_count++;
        }
      }

      if (update_chasing) {
        for (const c of this._chasers)
          c.lookup(a)

        const a_ctrl = a.ctrl
        for (let j = 0; j < temp_entities.length; j++) {
          const b = temp_entities[j];
          const b_ctrl = b.ctrl;
          if (is_bot_ctrl(b_ctrl)) b_ctrl.look_other(a)
          if (is_bot_ctrl(a_ctrl)) a_ctrl.look_other(b)
        }
        temp_entities.push(a);
      }
    }
    this.entities.length = this.entities.length - offset

    let divider = 0;
    this._z_pairs.clear();
    this.entities.sort(z_sorter);
    temp_entities.length = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const a = this.entities[i];
      if (a.ghosted) continue;
      for (let j = divider; j < temp_entities.length; j++) {
        const b = temp_entities[j];
        if (a.aabb_max_z < b.aabb_min_z) { divider = j + 1; continue; }
        this._z_pairs.add(pair_key(a, b));
      }
      temp_entities.push(a);
    }
    divider = 0;

    this.entities.sort(x_sorter);
    temp_entities.length = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const a = this.entities[i];
      if (a.ghosted) continue;
      for (let j = divider; j < temp_entities.length; j++) {
        const b = temp_entities[j];
        if (a.aabb_max_x < b.aabb_min_x) { divider = j + 1; continue; }
        if (!this._z_pairs.has(pair_key(a, b))) continue;
        // 细致的碰撞判定
        const c1 = collision_get(a, b);
        const c2 = collision_get(b, a);
        const p1 = c1?.priority ?? Infinity;
        const p2 = c2?.priority ?? Infinity;
        if (c1 && p1 <= p2) this.add_collision(c1)
        if (c2 && p2 <= p1) this.add_collision(c2)
      }
      temp_entities.push(a);
    }

    if (local_count) {
      this.target_cam_pos.x = round(local_x_sum / local_count);
      this.target_cam_pos.y = -0.5 * round(local_z_sum / local_count) - this.dataset.screen_h / 2;
    } else if (human_count) {
      this.target_cam_pos.x = round(human_x_sum / human_count);
      this.target_cam_pos.y = -0.5 * round(human_z_sum / human_count) - this.dataset.screen_h / 2;
    } else if (puppet_count) {
      this.target_cam_pos.x = round(puppet_x_sum / puppet_count);
      this.target_cam_pos.y = -0.5 * round(puppet_z_sum / puppet_count) - this.dataset.screen_h / 2;
    } else if (fighter_count) {
      this.target_cam_pos.x = round(fighter_x_sum / fighter_count);
      this.target_cam_pos.y = -0.5 * round(fighter_z_sum / fighter_count) - this.dataset.screen_h / 2;
    }

    this.collisions.forEach(c => collisions_keeper.handle(c));

    for (const entity of this._gones) {
      this.entity_map.delete(entity.id)
      if (is_fighter(entity))
        this.callbacks.emit("on_fighter_del")(entity);
      const player = this.lfw.players.get(entity.ctrl.player_id)
      if (player) player.fighter = void 0
      const puppet = this.puppets.get(entity.ctrl.player_id)
      if (puppet === entity) this.puppets.delete(entity.ctrl.player_id);
      entity.puppet = false
      this.callbacks.emit("on_puppet_del")(entity.ctrl.player_id);
      this.renderer.del_entity(entity);
      entity.release();
      this.lfw.factory.recycle_entity(entity)
    }
    this._gones.clear()
    this.stage.update();
  }

  protected add_collision(collision: Collision) {
    const prev = this.collisions.get(collision.id)
    if (!prev || prev.m_distance > collision.m_distance) {
      this.collisions.set(collision.id, collision);
    }
  }

  render_once(dt: number) {
    this.renderer.render(dt);
  }

  update_camera() {
    const old_cam_x = round(this.current_cam_pos.x);
    const old_cam_y = round(this.current_cam_pos.y);
    do {
      const { cam_l, left, cam_r, right } = this.stage;
      const min_cam_l = is_num(this._lock_cam_pos?.x) ? left : cam_l;
      const max_cam_r = is_num(this._lock_cam_pos?.x) ? right : cam_r;
      let max_vx_ratio = 50;
      let acc_x_ratio = 1;
      this.target_cam_pos.x = clamp(this._lock_cam_pos?.x ?? this._dist_cam_pos?.x ?? this.target_cam_pos.x,
        min_cam_l,
        max_cam_r - this.dataset.screen_w
      );
      if (round(this.current_cam_pos.x) == round(this.target_cam_pos.x)) break

      const acc_x = min(
        this.dataset.atom_time * acc_x_ratio,
        this.dataset.atom_time * 0.7 * (acc_x_ratio * abs(this.current_cam_pos.x - this.target_cam_pos.x)) / this.dataset.screen_w,
      );
      const direction_x = this.current_cam_pos.x > this.target_cam_pos.x ? -1 : 1;
      const max_vx = direction_x * max_vx_ratio * acc_x;
      if (sign(this._cam_v.x) !== direction_x)
        this._cam_v.x = 0;
      if (abs(this._cam_v.x) < abs(max_vx))
        this._cam_v.x += acc_x * direction_x;
      else
        this._cam_v.x = max_vx;
      if (direction_x < 0)
        this.current_cam_pos.x = max(this.target_cam_pos.x, this.current_cam_pos.x + this._cam_v.x)
      else
        this.current_cam_pos.x = min(this.target_cam_pos.x, this.current_cam_pos.x + this._cam_v.x);
    } while (0)

    do {
      const { height } = this.bg;
      if (height <= Defines.MODERN_SCREEN_HEIGHT) {
        this.current_cam_pos.y = this.target_cam_pos.y = 0;
        break;
      }
      const { far } = this.stage;
      let max_vy_ratio = 50;
      let acc_y_ratio = 1;
      const cam_y = this._lock_cam_pos?.y ?? this._dist_cam_pos?.y ?? this.target_cam_pos.y
      const cam_max_y = min(-0.5 * far, height - Defines.MODERN_SCREEN_HEIGHT)
      this.target_cam_pos.y = clamp(cam_y, 0, cam_max_y);
      const acc_y = min(
        this.dataset.atom_time * acc_y_ratio,
        this.dataset.atom_time * 0.7 * (acc_y_ratio * abs(this.current_cam_pos.y - this.target_cam_pos.y)) / this.dataset.screen_h,
      );
      if (round(this.current_cam_pos.y) == round(this.target_cam_pos.y)) break
      const direction_y = this.current_cam_pos.y > this.target_cam_pos.y ? -1 : 1;
      const max_vy = direction_y * max_vy_ratio * acc_y;
      if (sign(this._cam_v.y) !== direction_y)
        this._cam_v.y = 0;
      if (abs(this._cam_v.y) < abs(max_vy))
        this._cam_v.y += acc_y * direction_y;
      else
        this._cam_v.y = max_vy;
      if (direction_y < 0)
        this.current_cam_pos.y = max(this.target_cam_pos.y, this.current_cam_pos.y + this._cam_v.y)
      else
        this.current_cam_pos.y = min(this.target_cam_pos.y, this.current_cam_pos.y + this._cam_v.y);
    } while (0)

    const new_cam_x = round(this.current_cam_pos.x);
    const new_cam_y = round(this.current_cam_pos.y);
    if (old_cam_x !== new_cam_x || old_cam_y !== new_cam_y)
      this.callbacks.emit("on_cam_move")(new_cam_x, new_cam_y);
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
    if (this.entities.length > MAX_DEBUG_ENTITIES) return;
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
    e.attach(false);
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

  protected set_paused(v: 0 | 1 | 2) {
    if (this._paused === v) return;
    const changed = (!v) !== (!this._paused)
    this._paused = v;
    if (changed) this.callbacks.emit("on_pause_change")(!!v);
  }

  set_fn_locked(v: 0 | 1) {
    if (this._fn_locked === v) return;
    this._fn_locked = v;
    this.callbacks.emit("on_fn_locked_change")(v);
  }

  dispose() {
    this.callbacks.emit("on_disposed")();
    this.stop_update();
    this.stop_render();
    this.del_entities(Array.from(this.entities));
    this.renderer.dispose();
    this.callbacks.clear()
  }

  add_count(key: string, o: number) {
    const v = this._counts.get(key) || 0
    this._counts.set(key, v + o);
    this.callbacks.emit('on_counts')();
  }

  clear() {
    this.set_fn_locked(0);
    this.dataset.infinity_mp = 0;
    this.dataset.playrate = 1;
    this.entities.forEach(v => v.set_frame(GONE_FRAME_INFO))
    this.buffs.forEach(v => v.duration = 0)
    if (this.stage.id !== Defines.VOID_STAGE.id)
      this.stage = new Stage(this, Defines.VOID_STAGE)
    if (this.stage.bg.id !== Defines.VOID_BG.id)
      this.stage.change_bg(Defines.VOID_BG)
    this.paused = false;
    this._lock_cam_pos = null;
    this._dist_cam_pos = null;
    this.callbacks.emit('on_counts')();
    this._counts.clear()
  }

  reset_game_time(): void {
    this._game_time.reset()
  }

  find_entity(id: string) {
    return this.entity_map.get(id);
  }
}