import { Callbacks } from './base/Callbacks';
import { FPS } from './base/FPS';
import { Background } from "./bg/Background";
import { Buff } from "./buff/Buff";
import { Camera } from './Camera';
import { CMDS } from './cmds/CMDS';
import { type Collision, collision_get } from "./collision/Collision";
import { collisions_keeper } from "./collision/CollisionKeeper";
import { BallController } from "./controller/BallController";
import {
  BGG,
  CheatEnum,
  Defines,
  FID,
  GONE_FRAME_INFO,
  type IBdyInfo, type IBgData, type IBounding, type IEntityData,
  type IFrameInfo, type IItrInfo,
  type IVector3Like,
  O_ID,
  SE,
  WeaponEnum
} from "./defines";
import { SyncRenderEnum } from "./defines/SyncRenderEnum";
import { Ditto } from './ditto/Instance';
import type { IWorldRenderer } from "./ditto/render/IWorldRenderer";
import {
  Entity,
  is_bot_ctrl,
  is_fighter,
  is_human_ctrl
} from "./entity";
import { Ground } from "./Ground";
import type { IWorldCallbacks } from "./IWorldCallbacks";
import { LFW } from "./LFW";
import { Stage } from "./stage/Stage";
import { Transform } from "./Transform";
import { between, floor, round } from './utils/math/base';
import { clamp } from './utils/math/clamp';
import { Times } from './utils/Times';
import { WorldDataset } from "./WorldDataset";
const CHASING_UPDATE_INTERVAL = 8;
const MAX_DEBUG_ENTITIES = 355
const x_sorter = (a: Entity, b: Entity) => a.aabb_min_x - b.aabb_min_x

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
  readonly camera: Camera;
  /** 这种相机位置控制感觉有点问题 */
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
  private _alive_players = new Set<Entity>();
  public has_players_alive: boolean = false;
  TU: number = 1;
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
    this.callbacks.call("on_stage_change", v, o);
    o.dispose();
    v.enter_phase(0);
    for (const e of this.entities) {
      const { ctrl } = e;
      if (!is_bot_ctrl(ctrl)) continue;
      if (!ctrl.goingto) continue;
      ctrl.goto(e.position.x, e.position.y, e.position.z)
    }
  }
  on_dataset_change(k: string, curr: any, prev: any) {
    this.callbacks.call('on_dataset_change', k as any, curr, prev, this)
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

  constructor(lfw: LFW) {
    this.lfw = lfw;
    this._bg = new Background(this, Defines.VOID_BG);
    this.transform.scale_to(this._bg.zoom_x, this._bg.zoom_y, this._bg.zoom_z)
    this._stage = new Stage(this, Defines.VOID_STAGE);
    this.renderer = new Ditto.WorldRender(this);
    this.camera = new Camera(this);
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
        this.callbacks.call("on_fighter_add", e);
        const player = this.lfw.players.get(e.ctrl.player_id)
        if (player) {
          player.fighter = e;
          this.puppets.set(e.ctrl.player_id, e);
          e.puppet = true
          this.callbacks.call("on_puppet_add", e.ctrl.player_id);
        }
      }
      this.entities.push(e);
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
      if (this._need_FPS) this.callbacks.call("on_fps_update", this._FPS.value);
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
          if (this._need_FPS) this.callbacks.call("on_fps_update", this._FPS.value);
        } else if (sync_render == SyncRenderEnum.Half && floor(this._lifetime / playrate) % 2) {
          this.render_once(real_dt * 2);
          this._FPS.update(real_dt * 2);
          if (this._need_FPS) this.callbacks.call("on_fps_update", this._FPS.value);
        }
        if (this._need_UPS) this.callbacks.call("on_ups_update", this._UPS.value, 0);
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
    if (e.bearer || e.catcher || e.ghosted) {
      e.terrain = this.ground.base;
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
    } else if (x < left - e.l_len || x > right + e.r_len) {
      e.enter_frame(Defines.NEXT_FRAME_GONE);
      e.terrain = this.ground.base;
      this._restrict_result.x = x;
      this._restrict_result.y = y;
      this._restrict_result.z = z;
      return this._restrict_result;
    }

    // 检查路径是否穿过阻挡地形（处理超快速移动穿墙）
    // const wall_hit = this.ground.intersect_wall(
    //   e.prev_position.x, e.prev_position.y, e.prev_position.z,
    //   x, y, z,
    // );
    // if (wall_hit) {
    //   e.terrain = this.ground.segment(wall_hit.x, wall_hit.z);
    //   this._restrict_result.x = wall_hit.x;
    //   this._restrict_result.y = y;
    //   this._restrict_result.z = wall_hit.z;
    //   return this._restrict_result;
    // }

    const seg = this.ground.segment(x, z);

    // 可进入，直接进入
    if (null != this.ground.enterable(seg, x, y, z)) {
      e.terrain = seg;
      this._restrict_result.x = x;
      this._restrict_result.y = y;
      this._restrict_result.z = z;
      return this._restrict_result;
    }

    // 被挡了，需要放到可能的新位置;
    const pushs = this.ground.block(
      seg, x, y, z, e.prev_position.x, e.prev_position.y, e.prev_position.y
    );

    for (const push of pushs) {
      // 不能挤出地图外
      if (push.z < far || push.z > near || push.x < left || push.x > right)
        continue;

      const seg2 = this.ground.segment(push.x, push.z);
      // 不能挤到其他地形中
      if (null == this.ground.enterable(seg2, push.x, y, push.z))
        continue;

      // 成功挤出
      e.terrain = seg2;
      this._restrict_result.x = push.x;
      this._restrict_result.y = y;
      this._restrict_result.z = push.z;
      return this._restrict_result;
    }

    // 无法挤出，直接抬上去
    e.terrain = seg;
    this._restrict_result.x = x;
    this._restrict_result.y = this.ground.y(seg, x, z);
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
  get stage_limit() {
    return this.stage.id !== Defines.VOID_STAGE.id && !this.lfw.is_cheat(CheatEnum.HERO_FT)
  }
  protected handle_cmds() {
    const { cmds } = this.lfw;
    if (!cmds.length) return;
    CMDS.handle(this, cmds);
  }

  mark_players_alive(e: Entity, is_alive: boolean) {
    if (is_alive) this._alive_players.add(e);
    else this._alive_players.delete(e);
    this.has_players_alive = this._alive_players.size > 0;
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
      const {
        __aabb_x1: bx1 = 0, __aabb_x2: fx1 = 0,
        __aabb_z1: bz1 = -12, __aabb_z2: bz2 = 12,
        width, centerx
      } = a.frame;
      a.aabb_min_x = round(a.position.x + (a.facing > 0 ? bx1 : -fx1))
      a.aabb_max_x = round(a.position.x + (a.facing > 0 ? fx1 : -bx1))
      a.aabb_min_z = round(a.position.z + bz1)
      a.aabb_max_z = round(a.position.z + bz2)
      a.l_len = a.facing > 0 ? centerx : width - centerx;
      a.r_len = a.facing > 0 ? width - centerx : centerx;
      if (a.ghosted) continue;

      if (is_fighter(a)) {
        const x = a.position.x - this.dataset.screen_w / 2 + (a.facing * this.dataset.screen_w) / 6;
        const z = a.position.z;
        fighter_x_sum += x;
        fighter_z_sum += z;
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
    this.entities.sort(x_sorter);
    temp_entities.length = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const a = this.entities[i];
      if (a.ghosted) continue;
      for (let j = divider; j < temp_entities.length; j++) {
        const b = temp_entities[j];
        if (b.aabb_max_x < a.aabb_min_x) { divider = j + 1; continue; }
        if (a.aabb_max_z < b.aabb_min_z || b.aabb_max_z < a.aabb_min_z) continue;
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
      this.camera.destination.x = round(local_x_sum / local_count);
      this.camera.destination.y = -0.5 * round(local_z_sum / local_count) - this.dataset.screen_h / 2;
    } else if (human_count) {
      this.camera.destination.x = round(human_x_sum / human_count);
      this.camera.destination.y = -0.5 * round(human_z_sum / human_count) - this.dataset.screen_h / 2;
    } else if (puppet_count) {
      this.camera.destination.x = round(puppet_x_sum / puppet_count);
      this.camera.destination.y = -0.5 * round(puppet_z_sum / puppet_count) - this.dataset.screen_h / 2;
    } else if (fighter_count) {
      this.camera.destination.x = round(fighter_x_sum / fighter_count);
      this.camera.destination.y = -0.5 * round(fighter_z_sum / fighter_count) - this.dataset.screen_h / 2;
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
    if (!prev || prev.m_distance > collision.m_distance) {
      this.collisions.set(collision.id, collision);
    }
  }

  render_once(dt: number) {
    this.renderer.render(dt);
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
    this.entities.forEach(v => v.set_frame(GONE_FRAME_INFO))
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
}