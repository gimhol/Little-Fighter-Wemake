import { CMD } from "../../defines/CMD";
import { StatBarType } from "../../entity/StatBarType";
import { Defines, EntityGroup, OID, type IEntityData } from "../../defines";
import { TeamEnum as TE } from "../../defines/TeamEnum";
import { is_fighter, type IEntityCallbacks } from "../../entity";
import { Entity } from "../../entity/Entity";
import type { ISummaryCallbacks } from "../../entity/Summary";
import { summary_mgr } from "../../entity/SummaryMgr";
import { JoinQueue, pick_join_team, type IEntrant } from "../../helper/JoinQueue";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import type { IStageCallbacks } from "../../stage/IStageCallbacks";
import { Times } from "../../utils/Times";
import type { IPropsMeta } from "../..";
import { CameraCtrl } from "./CameraCtrl";
import { SummaryLogic } from "./SummaryLogic";

export type DanmuGameMode = "ffa" | "teams8" | "coop";

export interface IDanmuGameLogicProps {
  mode?: DanmuGameMode;
}

export interface IDanmuViewerStat {
  uid: string;
  name: string;
  spawns: number;
  kills: number;
  deads: number;
  damages: number;
  cheers: number;
  alive: boolean;
}

export interface IDanmuCheerEvent {
  uid: string;
  name: string;
  time: number;
}

const TEAMS8: readonly string[] = [
  TE.Team_1, TE.Team_2, TE.Team_3, TE.Team_4,
  TE.Team_5, TE.Team_6, TE.Team_7, TE.Team_8,
];

export class DanmuGameLogic extends SummaryLogic {
  static override readonly TAGS: string[] = ["DanmuGameLogic"];
  static readonly BROADCAST_ON_START = 'DanmuGameLogic_ON_START';
  static readonly BROADCAST_ON_STOP = 'DanmuGameLogic_ON_STOP';
  static override readonly PROPS: IPropsMeta<IDanmuGameLogicProps> = {
    mode: { type: String, nullable: true },
  };
  static readonly MAX_FIGHTERS = 32;
  static readonly COOP_TEMPLATES = 4;
  static readonly TEAMS8_TEAM_CAP = 4;
  static readonly STAGE_SWITCH_DELAY = 60 * 3;
  static readonly FFA_SEEDS = 8;
  static readonly CHEER_CD = 60 * 3;
  static readonly CHEER_HP_RATIO = 0.15;
  static readonly QUEUE_IDLE_TIMEOUT = 60 * 300;

  private _staring_countdown = new Times(0, 60 * 30);
  private _gameover_countdown = new Times(0, 60 * 5);
  private _teams = new Set<string>();
  readonly join_queue = new JoinQueue(50);
  private _team_caps = new Map<string, number>();
  private _join_fallen: string | null = null;
  private _survivors: IEntrant[] | null = null;
  private _waiting_respawn = false;
  private _waiting_next_stage = false;
  private _coop_stage_ready = false;
  private readonly _next_stage_delay = new Times(0, DanmuGameLogic.STAGE_SWITCH_DELAY);
  private readonly _queue_seen = new Map<string, number>();
  private readonly _queue_sweep_timer = new Times(0, 60);
  private _regular_datas?: IEntityData[];
  private _cam_ctrl?: CameraCtrl
  private readonly _viewers = new Map<string, IDanmuViewerStat>();
  private readonly _viewer_tracks = new Map<string, { stat: IDanmuViewerStat; sum: ISummaryCallbacks; ent: IEntityCallbacks }>();
  private readonly _cheer_cd = new Map<string, number>();
  private readonly _cheer_feed: IDanmuCheerEvent[] = [];

  get mode(): DanmuGameMode {
    const v = (this.props as IDanmuGameLogicProps | undefined)?.mode;
    return v === "teams8" || v === "coop" ? v : "ffa";
  }
  get cheer_feed(): readonly IDanmuCheerEvent[] { return this._cheer_feed; }
  get stage_name(): string { return this.world.stage.name; }
  get waiting_next_stage(): boolean { return this._waiting_next_stage; }

  time: number = 0;
  update_teams() {
    const fighters = this.lfw.fighters.all;
    this._teams.clear()
    for (const fighter of fighters)
      this._teams.add(fighter.team);
  }
  override on_fighter_add(e: Entity) {
    super.on_fighter_add(e);
    this.update_teams()
  }
  override on_fighter_del(e: Entity) {
    super.on_fighter_del(e);
    this._untrack_viewer(e);
    this._join_fallen = e.team;
    this.update_teams()
    if (!this._cam_ctrl || this._cam_ctrl?.staring !== e) return
    // 聚焦角色被移除后，聚焦下一个角色
    this._staring_countdown.reset();
    this.lfw.mt.mark = 'dmg_staring';
    this._cam_ctrl.staring = this.lfw.mt.pick(this._staring_candidates())
  }
  override on_start(): void {
    super.on_start?.();
    this.world.callbacks.add(this._world_callbacks);
    this.update_bg();
    if (this.mode !== "coop") this.lfw.sounds.play_bgm('?')
    this.lfw.on_component_broadcast(this, DanmuGameLogic.BROADCAST_ON_START)
    this._cam_ctrl = this.node.find_component(CameraCtrl)
    if (this._cam_ctrl) this._cam_ctrl.candidates = () => this._staring_candidates();
  }
  override on_stop(): void {
    super.on_stop?.();
    this.world.callbacks.del(this._world_callbacks);
    this.join_queue.clear();
    this._queue_seen.clear();
    this._survivors = null;
    this._viewers.clear();
    this._viewer_tracks.clear();
    this._cheer_cd.clear();
    this._cheer_feed.length = 0;
    this.lfw.on_component_broadcast(this, DanmuGameLogic.BROADCAST_ON_STOP);
    this.world.clear()
  }

  update_bg() {
    for (const e of this.world.entities)
      e.enter_frame(Defines.NEXT_FRAME_GONE)
    const fighter_enter = (v: Entity) => this._fighter_enter(v);
    this.lfw.mt.mark = 'dmglogic'
    this._team_caps.clear();
    this._survivors = null;
    this._waiting_respawn = false;
    this._waiting_next_stage = false;
    switch (this.mode) {
      case "teams8": {
        this.lfw.change_bg('?');
        for (const team of TEAMS8) {
          this._team_caps.set(team, DanmuGameLogic.TEAMS8_TEAM_CAP);
          this.lfw.fighters.add_random(1, team).forEach(fighter_enter)
        }
        break;
      }
      case "coop": {
        this._coop_stage_ready = this._start_coop_stage();
        break;
      }
      default: {
        this.lfw.change_bg('?');
        const pool = this.lfw.datas.fighters.slice();
        for (let i = 0; i < DanmuGameLogic.FFA_SEEDS && pool.length; ++i) {
          const data = this.lfw.mt.take(pool);
          if (!data) break;
          this.lfw.fighters.add(data, 1, '').forEach(fighter_enter)
        }
        break;
      }
    }

    this.update_staring();
    this._staring_countdown.reset()

    const staring = this._cam_ctrl?.staring;
    if (staring && this._cam_ctrl?.auto != false) {
      const { left, right } = this.world.stage;
      const view_w = this.world.dataset.screen_w / (this.world.bg.zoom_x || 1)
      let cam_x = staring.position.x - view_w / 2
      const max_cam_left = left;
      const max_cam_right = right;
      if (cam_x < max_cam_left) cam_x = max_cam_left;
      if (cam_x > max_cam_right - view_w) cam_x = max_cam_right - view_w;
      this.lfw.push_cmd(CMD.DIST_CAM, `${cam_x}`)
      this.world.camera.jump_x(cam_x);
    }
  }
  join(entrant: IEntrant): boolean {
    if (this._find_viewer_fighter(entrant.uid)) return false;
    if (this.join_queue.has(entrant.uid)) return false;
    if (this._claim_template(entrant)) {
      if (entrant.oid) this.switch(entrant.uid, entrant.oid);
      return true;
    }
    const ret = this.join_queue.enqueue(entrant);
    if (ret) this._queue_seen.set(entrant.uid, this.time);
    return ret;
  }
  leave(uid: string): boolean {
    const removed = this.join_queue.remove(uid);
    this._queue_seen.delete(uid);
    const fighter = this._find_viewer_fighter(uid);
    if (fighter) fighter.release();
    return removed || !!fighter;
  }
  touch(uid: string): void {
    this._queue_seen.set(uid, this.time);
  }
  enter(entrant: IEntrant): boolean {
    if (this.join_queue.has(entrant.uid)) return false;
    if (this._find_viewer_fighter(entrant.uid)) return false;
    if (this.mode !== "coop" && this._teams.size <= 1) return false;
    if (this._claim_template(entrant)) return true;
    const team = this._find_join_team();
    if (team === void 0) return false;
    return !!this._spawn_entrant(entrant, team, this._template_data());
  }
  switch(uid: string, oid?: string): boolean {
    const fighter = this._find_viewer_fighter(uid);
    if (!fighter) return false;
    const template = this._template_data();
    if (template && fighter.data.id !== template.id) return false;
    const data = this._regular_data(oid);
    if (!data) return false;
    const { x, y, z } = fighter.position;
    const facing = fighter.facing;
    const team = fighter.team;
    const name = fighter.name;
    const hp_ratio = fighter.hp_max > 0 ? fighter.hp / fighter.hp_max : 1;
    fighter.release();
    const next = this._spawn_entrant({ uid, name, oid: data.id }, team, data);
    if (!next) return false;
    next.set_position(x, y, z);
    next.facing = facing;
    next.hp = Math.max(1, Math.round(next.hp_max * hp_ratio));
    return true;
  }
  protected _sweep_queue() {
    const now = this.time;
    const queued = new Set<string>();
    for (const entrant of [...this.join_queue.all]) {
      queued.add(entrant.uid);
      const seen = this._queue_seen.get(entrant.uid);
      if (seen === void 0) {
        this._queue_seen.set(entrant.uid, now);
        continue;
      }
      if (now - seen >= DanmuGameLogic.QUEUE_IDLE_TIMEOUT)
        this.join_queue.remove(entrant.uid);
    }
    for (const uid of [...this._queue_seen.keys()])
      if (!queued.has(uid)) this._queue_seen.delete(uid);
  }
  cheer(uid: string): boolean {
    const stat = this._viewers.get(uid);
    if (!stat) return false;
    const last = this._cheer_cd.get(uid);
    if (last != void 0 && this.time - last < DanmuGameLogic.CHEER_CD) return false;
    const fighter = this._find_viewer_fighter(uid);
    if (!fighter) return false;
    const hp_max = fighter.hp_max;
    fighter.hp = Math.min(fighter.hp + hp_max * DanmuGameLogic.CHEER_HP_RATIO, hp_max);
    ++stat.cheers;
    this._cheer_cd.set(uid, this.time);
    this._cheer_feed.push({ uid, name: stat.name, time: this.time });
    if (this._cheer_feed.length > 20) this._cheer_feed.splice(0, this._cheer_feed.length - 20);
    return true;
  }
  viewer_stats(): IDanmuViewerStat[] {
    const alive = new Set<string>();
    for (const e of this.world.entities) {
      if (!is_fighter(e) || e.hp <= 0) continue;
      const uid = e.marks.get(Defines.DANMU_UID_MARK);
      if (uid) alive.add(uid);
    }
    return Array.from(this._viewers.values(), (v) => ({ ...v, alive: alive.has(v.uid) }))
      .sort((a, b) => (b.kills - a.kills) || (b.spawns - a.spawns) || a.name.localeCompare(b.name));
  }
  protected _fighter_enter(v: Entity) {
    v.stat_bar_type = StatBarType.None;
    v.key_role = true;
    v.dead_gone = true;
    v.name_visible = true;
    v.blinking = 120;
    v.invulnerable = 120;
  }
  protected _find_join_team(): string | undefined {
    const fighters = this.lfw.fighters.all;
    const mode = this.mode;
    if (mode === "ffa")
      return fighters.length < DanmuGameLogic.MAX_FIGHTERS ? '' : void 0;
    if (mode === "teams8") {
      const counts = new Map<string, number>();
      for (const f of fighters)
        counts.set(f.team, (counts.get(f.team) ?? 0) + 1);
      return pick_join_team(counts, this._team_caps, this._join_fallen, TEAMS8);
    }
    const viewers = fighters.filter((f) => f.team === TE.Team_1).length;
    return viewers < DanmuGameLogic.MAX_FIGHTERS ? TE.Team_1 : void 0;
  }
  protected _try_join() {
    while (this.join_queue.size) {
      if (this._claim_queued()) continue;
      const team = this._find_join_team();
      if (team === void 0) return;
      const entrant = this.join_queue.dequeue();
      if (!entrant) return;
      if (!this._find_viewer_fighter(entrant.uid)) this._spawn_entrant(entrant, team);
      this._join_fallen = null;
    }
  }
  protected _claim_queued(): boolean {
    if (this.mode !== "coop") return false;
    const entrant = this.join_queue.all[0];
    if (!entrant) return false;
    if (!this._find_viewer_fighter(entrant.uid) && !this._claim_template(entrant)) return false;
    this.join_queue.remove(entrant.uid);
    this._queue_seen.delete(entrant.uid);
    if (entrant.oid) this.switch(entrant.uid, entrant.oid);
    return true;
  }
  protected _regular_fighter_datas(): IEntityData[] {
    return this._regular_datas ??= this.lfw.datas.get_fighters_of_group(EntityGroup.Regular);
  }
  protected _template_data(): IEntityData | undefined {
    return this.lfw.datas.find_fighter(OID.Template);
  }
  protected _find_claimable_template(): Entity | undefined {
    if (this.mode !== "coop") return void 0;
    const template = this._template_data();
    if (!template) return void 0;
    for (const e of this.world.entities) {
      if (!e.mounted || !is_fighter(e) || e.hp <= 0) continue;
      if (e.data.id !== template.id) continue;
      if (e.marks.has(Defines.DANMU_UID_MARK)) continue;
      return e;
    }
    return void 0;
  }
  protected _claim_template(entrant: IEntrant): boolean {
    const fighter = this._find_claimable_template();
    if (!fighter) return false;
    fighter.name = entrant.name;
    fighter.set_mark(Defines.DANMU_UID_MARK, entrant.uid);
    this._track_viewer(fighter);
    return true;
  }
  protected _place_coop_spawn(e: Entity) {
    if (this.mode !== "coop") return;
    const x = this.lfw.mt.range(this.world.player_l + 40, this.world.player_l + 80);
    const z = this.lfw.mt.range(this.world.far, this.world.near);
    e.set_position(x, 550, z);
  }
  protected _fill_templates() {
    if (this.mode !== "coop") return;
    const data = this._template_data();
    if (!data) return;
    for (let i = 0; i < DanmuGameLogic.COOP_TEMPLATES; ++i) {
      if (this._find_join_team() === void 0) return;
      const [fighter] = this.lfw.fighters.add(data, 1, TE.Team_1);
      if (!fighter) return;
      fighter.name = "";
      this._fighter_enter(fighter);
      this._place_coop_spawn(fighter);
    }
  }
  protected _regular_data(oid?: string): IEntityData | undefined {
    const datas = this._regular_fighter_datas();
    if (!datas.length) return void 0;
    if (!oid) {
      this.lfw.mt.mark = "danmu_viewer";
      return this.lfw.mt.pick(datas);
    }
    const key = oid.trim();
    const lower = key.toLowerCase();
    return datas.find((v) => v.id === key || v.base.name?.toLowerCase() === lower);
  }
  protected _spawn_entrant(entrant: IEntrant, team: string, data?: IEntityData): Entity | undefined {
    const fighter_data = data ?? this._regular_data(entrant.oid) ?? this._regular_data();
    const fighters = fighter_data
      ? this.lfw.fighters.add(fighter_data, 1, team)
      : this.lfw.fighters.add_random(1, team);
    const fighter = fighters[0];
    if (!fighter) return void 0;
    this._fighter_enter(fighter);
    this._place_coop_spawn(fighter);
    fighter.name = entrant.name;
    fighter.set_mark(Defines.DANMU_UID_MARK, entrant.uid);
    this._track_viewer(fighter);
    return fighter;
  }
  protected _track_viewer(e: Entity) {
    if (this._viewer_tracks.has(e.id)) return;
    const uid = e.marks.get(Defines.DANMU_UID_MARK);
    if (!uid) return;
    let stat = this._viewers.get(uid);
    if (!stat) {
      stat = { uid, name: e.name, spawns: 0, kills: 0, deads: 0, damages: 0, cheers: 0, alive: false };
      this._viewers.set(uid, stat);
    }
    if (e.name) stat.name = e.name;
    ++stat.spawns;
    const s = stat;
    const sum: ISummaryCallbacks = {
      on_damage_sum_changed: (value, prev) => { s.damages += value - prev; },
      on_kill_sum_changed: (value, prev) => { s.kills += value - prev; },
    };
    const ent: IEntityCallbacks = {
      on_dead: () => { ++s.deads; },
    };
    summary_mgr.get(e.id).callbacks.add(sum);
    e.callbacks.add(ent);
    this._viewer_tracks.set(e.id, { stat, sum, ent });
  }
  protected _untrack_viewer(e: Entity) {
    const track = this._viewer_tracks.get(e.id);
    if (!track) return;
    summary_mgr.get(e.id).callbacks.del(track.sum);
    e.callbacks.del(track.ent);
    this._viewer_tracks.delete(e.id);
  }
  protected _find_viewer_fighter(uid: string): Entity | undefined {
    for (const e of this.world.entities)
      if (is_fighter(e) && e.hp > 0 && e.marks.get(Defines.DANMU_UID_MARK) === uid) return e;
    return void 0;
  }
  protected _start_coop_stage(): boolean {
    const stages = this.lfw.datas.stages.filter(
      (v) => !v.group?.some((g) => g === EntityGroup.Dev || g === EntityGroup.Hidden),
    );
    const stage =
      stages.find((v) => v.name === "1-1") ??
      stages.find((v) => v.is_starting && v.chapter !== "survival");
    if (!stage) return false;
    this.lfw.change_stage(stage.id ?? "");
    return true;
  }
  protected _collect_survivors(): IEntrant[] {
    const ret = new Map<string, IEntrant>();
    for (const e of this.world.entities) {
      if (!is_fighter(e) || e.hp <= 0) continue;
      const uid = e.marks.get(Defines.DANMU_UID_MARK);
      if (!uid) continue;
      ret.set(uid, { uid, name: e.name });
    }
    return Array.from(ret.values());
  }
  protected _respawn_viewers() {
    const survivors = this._survivors;
    this._survivors = null;
    if (!survivors?.length) return;
    for (const entrant of survivors)
      this._spawn_entrant(entrant, TE.Team_1);
  }
  protected readonly _world_callbacks: IWorldCallbacks = {
    on_stage_change: (stage, prev) => {
      if (this.mode !== "coop") return;
      prev.callbacks.del(this._stage_callbacks);
      stage.callbacks.add(this._stage_callbacks);
      this._waiting_respawn = true;
    },
  };
  protected readonly _stage_callbacks: IStageCallbacks = {
    on_stage_finish: () => {
      if (this.mode !== "coop") return;
      this._waiting_next_stage = true;
      this._next_stage_delay.reset();
    },
  };
  update_staring() {
    if (!this._cam_ctrl) return;
    this.lfw.mt.mark = 'dmg_staring_2';
    this._cam_ctrl.staring = this.lfw.mt.pick(this._staring_candidates())
  }
  protected _staring_candidates(): Entity[] {
    const fighters = this.lfw.fighters.all;
    if (this.mode !== "coop") return fighters;
    const viewers = fighters.filter((v) => v.team === TE.Team_1 && v.marks.get(Defines.DANMU_UID_MARK));
    if (viewers.length) return viewers;
    return fighters.filter((v) => v.team === TE.Team_1);
  }
  override update(dt: number): void {
    this.time += dt;
    super.update?.(dt)
    if (this.mode === "coop") {
      if (!this._coop_stage_ready) this._coop_stage_ready = this._start_coop_stage();
      if (this._waiting_respawn) {
        this._waiting_respawn = false;
        this._respawn_viewers();
        this._fill_templates();
      }
      if (this._waiting_next_stage) {
        if (this._next_stage_delay.is_max) {
          this._waiting_next_stage = false;
          this._survivors = this._collect_survivors();
          this.lfw.goto_next_stage();
        } else {
          this._next_stage_delay.add();
        }
      }
    }
    if (this.join_queue.size && (this.mode === "coop" || this._teams.size > 1)) this._try_join();
    if (this._queue_sweep_timer.add()) this._sweep_queue();
    this._staring_countdown.add();
    if (this._staring_countdown.is_max) this.update_staring()

    const staring = this._cam_ctrl?.staring;
    if (staring && this._cam_ctrl?.auto != false) {
      const view_w = this.world.dataset.screen_w / (this.world.bg.zoom_x || 1)
      this.lfw.push_cmd(CMD.DIST_CAM, `${staring.position.x - view_w / 2}`)
    }
    else if (!staring)
      this.update_staring()

    const finished = this.mode !== "coop" && this._teams.size <= 1;
    if (finished) {
      if (this._gameover_countdown.is_max) {
        if (this._teams.size) {
          for (const [k, v] of this.teams) {
            if (this._teams.has(k)) v.wins += 1
          }
        }
        this._gameover_countdown.reset()
        this.update_bg()
      } else {
        this._gameover_countdown.add()
      }
    } else {
      this._gameover_countdown.reset()
    }

  }

}

