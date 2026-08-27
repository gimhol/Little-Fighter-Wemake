
import type { LFW } from "../LFW";
import type { World } from "../World";
import { Callbacks } from "../base/Callbacks";
import { FSM } from "../base/FSM";
import { Background } from "../bg/Background";
import { Defines, Difficulty, type IBgData, type IStageInfo, type IStageObjectInfo, type IStagePhaseInfo } from "../defines";
import type { IDialogInfo } from "../defines/IDialogInfo";
import { Ditto } from "../ditto";
import type { Entity } from "../entity/Entity";
import { is_bot_ctrl, is_fighter, is_weapon } from "../entity/type_check";
import { floor, max, min, round_float } from "../utils";
import { is_num } from "../utils/type_check";
import { Expressions } from "./Expressions";
import type { IDialogState, IStageCallbacks } from "./IStageCallbacks";
import { Item } from "./Item";
import { Status } from "./Status";

export class Stage {
  static readonly TAG: string = "Stage";
  readonly world: World;
  readonly lfw: LFW;
  readonly data: Readonly<IStageInfo>;
  readonly next_stage?: IStageInfo;
  readonly team: string;
  readonly callbacks = new Callbacks<IStageCallbacks>();
  private _disposers: (() => void)[] = [];
  private _phase_idx: number = 0;
  private _phase: IStagePhaseInfo | undefined;
  readonly items = new Set<Item>();
  private _is_stage_finish: boolean = false;
  private _is_chapter_finish: boolean = false;
  private _released_items: Item[] = []
  private _dialogs: IDialogState = {
    index: -1,
    list: []
  };
  phase_time: number = 0;
  dialog_time: number = 0;
  get title(): string { return this.data.title ?? this.bg.name }
  /** 节是否结束 */
  get is_stage_finish(): boolean { return this._is_stage_finish; }
  /** 章是否结束 */
  get is_chapter_finish(): boolean { return this._is_chapter_finish }

  get bg(): Background { return this.world.bg; }
  get phases() { return this.data.phases }
  get id(): string { return this.data.id || ""; }
  get name(): string { return this.data.name || ""; }

  get time() { return this.fsm.time; }
  set time(v) { this.fsm.time = v; }

  get phase_idx(): number { return this._phase_idx };
  get phase(): IStagePhaseInfo | undefined { return this._phase; };
  get dialog_idx(): number { return this._dialogs.index }
  get dialog(): IDialogInfo | undefined { return this._dialogs.list[this._dialogs.index] }

  dialog_end_tester = new Expressions<Stage>()
  phase_end_tester = new Expressions<Stage>()

  /** 左边界 */
  left: number;
  /** 右边界 */
  right: number;
  near: number;
  far: number;
  width: number;
  depth: number;
  middle: { x: number; z: number; };
  /** 玩家左边界 */
  player_l: number;
  /** 玩家右边界 */
  player_r: number;
  /** 相机左边界 */
  cam_l: number;
  /** 相机右边界 */
  cam_r: number;
  /** 敌人左边界 */
  enemy_l: number;
  /** 敌人右边界 */
  enemy_r: number;
  /** 饮料左边界 */
  drink_l: number;
  /** 饮料右边界 */
  drink_r: number;

  change_bg(data: Readonly<IBgData>): Background {
    // FIXME: so messed up here...
    const prev_bg = this.world.bg;
    if (prev_bg) {
      if (prev_bg.data.id === data.id) return prev_bg;
    }
    prev_bg.dispose();
    const world_stage = this.world.stage;
    if (world_stage && this.world.bg.data.id === data.id)
      return this.world.bg

    const bg = new Background(this.world, data)
    this.left = this.cam_l = this.player_l = this.enemy_l = bg.left
    this.right = this.cam_r = this.player_r = this.enemy_r = bg.right
    this.near = bg.near;
    this.far = bg.far;
    this.width = bg.width;
    this.depth = bg.depth;
    this.middle = bg.middle;
    this.drink_l = Number.MIN_SAFE_INTEGER;
    this.drink_r = Number.MAX_SAFE_INTEGER;
    return this.world.bg = bg;
  }

  constructor(world: World, data: Readonly<IStageInfo>) {
    this.world = world;
    this.lfw = world.lfw
    this.data = data;
    const bid = this.data.bg;
    const bdt = this.world.lfw.datas.backgrounds.find(v => v.id === bid);
    if (!bdt)
      Ditto.warn(Stage.TAG + "::constructor", `bg not found, id: ${bid}`);
    this.change_bg(bdt ?? Defines.VOID_BG);

    const bg = this.world.bg;
    this.left = this.cam_l = this.player_l = this.enemy_l = bg.left
    this.right = this.cam_r = this.player_r = this.enemy_r = bg.right
    this.near = bg.near;
    this.far = bg.far;
    this.width = bg.width;
    this.depth = bg.depth;
    this.middle = bg.middle;
    this.drink_l = -1200;
    this.drink_r = this.bg.width + 1200
    if (this.data.next)
      this.next_stage = this.lfw.datas.stages.find(v => v.id === this.data.next);
    this.team = this.lfw.new_team;
  }

  readonly fsm = new FSM<Status>().add({
    key: Status.Running,
    update: () => {
      if (this._is_stage_finish) return Status.Completed;
    }
  }, {
    key: Status.Completed,
    enter: () => {
      this.callbacks.call('on_stage_finish', this)
      if (this.is_chapter_finish) this.callbacks.call('on_chapter_finish', this)
    },
    update: () => {
      if (this.should_goto_next_stage) {
        this.callbacks.call('on_requrie_goto_next_stage', this)
        return Status.End;
      }
    }
  }, {
    key: Status.End
  }).use(Status.Running)

  private _stop_bgm?: () => void;

  private play_phase_sounds() {
    const { phase } = this
    if (!phase) return;
    const { music, sounds } = phase;
    if (music !== void 0) {
      if (music) {
        this._stop_bgm = this.lfw.sounds.play_bgm(music);
      } else {
        this._stop_bgm = void 0;
        this.lfw.sounds.stop_bgm();
      }
    }
    if (sounds?.length) {
      for (const { path, x, y, z } of sounds) {
        this.lfw.sounds.play(path, x, y, z)
      }
    }
  }

  stop_bgm(): void {
    this._stop_bgm?.();
  }

  private set_phase(phase: IStagePhaseInfo | undefined) {
    if (phase === this.phase) return;
    // Ditto.debug('set_phase', phase)
    this.phase_time = 0;
    this.phase_end_tester.reset(phase?.__end_testers ?? [])

    const prev = this.phase
    this.callbacks.call("on_phase_changed", this, this._phase = phase, prev);
    this.player_l = 0
    this.player_r = this.bg.right
    if (!phase) return;

    const { objects, respawn, respawn_r, health_up, mp_up, respawn_x, dialogs } = phase;
    const hp_recovery = health_up?.[this.world.dataset.difficulty] || 0;
    const hp_recovery_r = health_up?.[this.world.dataset.difficulty] || hp_recovery;
    const hp_respawn = respawn?.[this.world.dataset.difficulty] || 0;
    const hp_respawn_r = respawn_r?.[this.world.dataset.difficulty] || hp_respawn;
    const mp_recovery = mp_up?.[this.world.dataset.difficulty] || 0;

    const _respawn_x = respawn_x?.[this.world.dataset.difficulty];
    const loop_players_fighters = hp_recovery || hp_respawn || mp_recovery
    if (loop_players_fighters) {
      const teams = new Set<string>()
      for (const [, f] of this.world.puppets)
        teams.add(f.team)
      for (const f of this.world.entities) {
        if (!is_fighter(f) || !teams.has(f.team))
          continue;
        if (f.hp <= 0 && hp_respawn) {
          const hp = hp_respawn < 1 ?
            min(f.hp_max * hp_respawn, f.hp_max) :
            min(hp_respawn, f.hp_max)
          f.hp = hp;
          const hp_r = hp_respawn < 1 ?
            min(f.hp_max * hp_respawn_r, f.hp_max) :
            min(hp_respawn_r, f.hp_max)
          f.hp_r = max(hp_r, hp)
          if (typeof _respawn_x === 'number') {
            f.set_position_x(_respawn_x);
          }
        } else if (f.hp > 0 && hp_recovery) {
          const hp = hp_recovery < 1 ?
            min(f.hp_r + (f.hp_max - f.hp_r) * hp_recovery, f.hp_max) :
            min(f.hp_r + hp_recovery, f.hp_max)
          f.hp = hp
          const hp_r = hp_recovery_r < 1 ?
            min(f.hp_r + (f.hp_max - f.hp_r) * hp_recovery, f.hp_max) :
            min(f.hp_r + hp_recovery, f.hp_max)
          f.hp_r = max(hp_r, hp)
        }
        if (mp_recovery) f.mp = min(f.mp + mp_recovery, f.mp_max)
      }
    }
    this.play_phase_sounds();
    const { ce } = this;
    if (objects?.length) for (const object of objects) {
      this.spawn_object(object, ce);
    }
    if (is_num(phase.cam_jump_to_x)) {
      this.world.camera.jump_x(phase.cam_jump_to_x);
    }

    this.player_l = phase.player_l ?? 0
    this.cam_l = phase.camera_l ?? 0
    this.enemy_l = phase.enemy_l ?? -1200
    this.drink_l = phase.drink_l ?? -1200
    this.player_r = phase.player_r ?? phase.bound ?? this.bg.right
    this.cam_r = phase.camera_r ?? phase.bound ?? this.bg.right
    this.enemy_r = phase.enemy_r ?? ((phase.bound ?? this.bg.right) + 1200)
    this.drink_r = phase.drink_r ?? (this.bg.right + 1200)

    const player_x = is_num(phase.player_jump_to_x) ? phase.player_jump_to_x : void 0;
    const player_z = is_num(phase.player_jump_to_z) ? phase.player_jump_to_z : void 0;
    const player_f = is_num(phase.player_facing) ? phase.player_facing : void 0;

    const teams = new Set<string>();
    for (const [, v] of this.lfw.world.puppets)
      teams.add(v.team);
    for (const entity of this.world.entities) {
      if (!is_fighter(entity) || !teams.has(entity.team)) continue;
      if (player_f === 1 || player_f === -1)
        entity.facing = player_f

      this.lfw.mt.mark = `criminal_respawn`
      if (typeof player_x === 'number') {
        const l = max(this.player_l, player_x - 50)
        const r = min(this.player_r, player_x + 50)
        const x = this.lfw.mt.range(l, r)
        entity.set_position_x(x);
      }
      if (typeof player_z === 'number') {
        const f = max(this.far, player_z - 50)
        const n = min(this.near, player_z + 50)
        const z = this.lfw.mt.range(f, n)
        entity.set_position_z(z);
      }
    }
    if (dialogs?.length) this.push_dialogs(dialogs)
  }
  push_dialogs(more: IDialogInfo[]) {
    const prev = this._dialogs;
    const list = [...prev.list, ...more]
    let index = prev.index;
    if (index < 0) {
      index = prev.index + 1;
      this.dialog_time = 0;
      this.dialog_end_tester.reset(list[index]?.__end_testers ?? [])
    }
    const curr = this._dialogs = { ...prev, list, index }
    this.callbacks.call('on_dialogs_changed', curr, prev, this)
  }
  next_dialog() {
    const prev = this._dialogs
    // prev.index == prev.list.length 代表结束，这是允许的。
    if (prev.index >= prev.list.length) return
    const curr = this._dialogs = { ...prev, index: prev.index + 1 }
    this.dialog_end_tester.reset(curr.list[curr.index]?.__end_testers ?? [])
    this.dialog_time = 0;
    this.callbacks.call('on_dialogs_changed', curr, prev, this)
  }
  clear_dialogs() {
    const prev = this._dialogs
    const curr = this._dialogs = { index: -1, list: [] }
    this.callbacks.call('on_dialogs_changed', curr, prev, this)
  }

  enter_phase(idx: number) {
    if (this.world.stage !== this) return;
    this.set_phase(this.data.phases?.[this._phase_idx = idx])
    this._is_stage_finish = !!this.data.phases?.length && this._phase_idx >= this.data.phases.length
    this._is_chapter_finish = this._is_stage_finish && this.next_stage?.chapter !== this.data.chapter
    return
  }
  get ce() {
    let count = 0;
    for (const [, c] of this.world.puppets)
      count += c.data.base.ce ?? 1;
    if (!count) count = 1;
    switch (this.world.dataset.difficulty) {
      case Difficulty.Crazy:
        count *= 2
        break;
      case Difficulty.Easy:
      case Difficulty.Normal:
      case Difficulty.Difficult:
        break;
    }
    return count;
  }
  async spawn_object(obj_info: IStageObjectInfo, count: number) {
    if (this.world.stage !== this) return;
    const { ratio, times = 1 } = obj_info;
    let spawn_count = ratio === void 0 ? 1 : floor(round_float(count * ratio, 10));
    if (spawn_count <= 0 || !times) return;

    while (spawn_count > 0) {
      const item = new Item(this, obj_info);
      item.spawn();
      this.items.add(item);
      --spawn_count;
    }
  }
  kill_all() {
    for (const o of this.items) {
      for (const e of o.objects) {
        if (is_fighter(e) && e.team === this.team) e.hp = 0;
      }
    }
  }
  kill_soliders() {
    for (const o of this.items) {
      if (!o.info.is_soldier) continue;
      for (const e of o.objects) {
        if (is_fighter(e) && e.team === this.team) e.hp = 0;
      }
    }
  }
  kill_boss() {
    for (const o of this.items) {
      if (!o.info.is_boss) continue;
      for (const e of o.objects) {
        if (is_fighter(e) && e.team === this.team) e.hp = 0;
      }
    }
  }
  kill_others() {
    for (const o of this.items) {
      if (o.info.is_boss || o.info.is_soldier) continue;
      for (const e of o.objects) {
        if (is_fighter(e) && e.team === this.team) e.hp = 0;
      }
    }
  }
  dispose() {
    for (const f of this._disposers) f();
    for (const item of this.items) item.release();
    const temp: Entity[] = [];
    const player_teams = new Set<string>();
    for (const [, v] of this.lfw.world.puppets) {
      player_teams.add(v.team);
    }
    for (const e of this.world.entities) {
      if (is_fighter(e) && player_teams.has(e.team))
        continue;
      else if (is_weapon(e) && e.bearer && player_teams.has(e.bearer.team))
        continue;
      temp.push(e);
    }
    this.world.del_entities(temp);
    this.callbacks.clear();
  }

  all_boss_dead(): boolean {
    for (const item of this.items) {
      if (!item.is_fighter) continue;
      if (!item.info.is_boss) continue;
      if (item.objects.size) return false
      if (!item.released) return false
    }
    return true;
  }
  all_fighter_dead(): boolean {
    for (const item of this.items) {
      if (!item.is_fighter) continue;
      if (item.objects.size) return false
      if (!item.released) return false
    }
    return true;
  }
  /** 对话框已完毕 */
  dialog_cleared(): boolean {
    return this._dialogs.list.length <= 0 || this._dialogs.index >= this._dialogs.list.length;
  }
  is_phase_end(): boolean {
    if (this.phase_end_tester.list.length)
      return this.phase_end_tester.flow(this)
    return this.all_fighter_dead() && this.dialog_cleared();
  }

  is_dialog_end(): boolean {
    return this.dialog_end_tester.flow(this)
  }
  check_phase_end(): boolean {
    const ret = this.is_phase_end()
    if (!ret) return ret
    this.enter_phase(this.phase_idx + 1);
    return ret
  }
  check_dialog_end(): boolean {
    const ret = this.is_dialog_end()
    if (!ret) return ret
    this.next_dialog();
    return ret
  }
  /** 是否应该进入下一关 */
  get should_goto_next_stage(): boolean {
    if (this.is_chapter_finish || !this.is_stage_finish)
      return false;

    for (const e of this.world.entities) {
      if (!is_fighter(e)) continue; // 非角色不判断
      if (e.hp <= 0) continue; // 无血，不判断
      if (e.position.x >= this.cam_r) continue; // 已达右侧，不判断
      if (is_bot_ctrl(e.ctrl)) continue; // Bot不判断
      if (this.lfw.players.has(e.ctrl.player_id))
        return false;
    }
    return true;
  }
  get world_pause() {
    return !!this.phase?.world_pause
  }
  get control_disabled() {
    return !!this.phase?.control_disabled
  }
  get weapon_rain_disabled() {
    return !!this.phase?.weapon_rain_disabled
  }
  update() {
    if (this.phase) this.phase_time++
    if (this.dialog) this.dialog_time++
    this.fsm.update(1);
    if (this.id == Defines.VOID_STAGE.id) return;
    this._released_items.length = 0
    for (const item of this.items) {
      if (item.released)
        this._released_items.push(item)
      else
        item.update()
    }
    this._released_items.forEach(v => this.items.delete(v))
    this.check_phase_end();
    this.check_dialog_end();
  }
}
