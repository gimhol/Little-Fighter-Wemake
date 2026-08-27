import { FSM } from "../../base/FSM";
import { EntityGroup, GameKey, StageActions, type IStagePhaseInfo } from "../../defines";
import type { Entity } from "../../entity";
import type { IEntityCallbacks } from "../../entity/IEntityCallbacks";
import { is_fighter } from "../../entity/type_check";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import type { Stage } from "../../stage";
import type { IStageCallbacks } from "../../stage/IStageCallbacks";
import { traversal } from "../../utils/container_help/traversal";
import { Times } from "../../utils/Times";
import type { IUIKeyEvent } from "../IUIKeyEvent";
import { ComponentFSMState } from "./ComponentFSMState";
import { ComponentsPlayer } from "./ComponentsPlayer";
import { FighterStatBar } from "./FighterStatBar";
import { Jalousie } from "./Jalousie";
import { UIComponent } from "./UIComponent";
class FSMState extends ComponentFSMState<number, StageModeLogic> {
  override readonly key: number = 0
  get fsm() { return this.owner.fsm }
}
class FSMState_BeforeEnd extends FSMState {
  override readonly key: number = 1;
  override update() {
    if (this.fsm.state_time > 3000)
      return 2;
  }
}
class FSMState_End extends FSMState {
  override readonly key: number = 2;
  override enter(): void {
    this.lfw.sounds.play_preset("end");
    const score_board = this.node.find_child("score_board")
    score_board?.set_visible(true);
  }
  override leave(): void {
    const score_board = this.node.find_child("score_board")
    score_board?.set_visible(false);
  }
}
class FSMState_BeforeWin extends FSMState {
  override readonly key: number = 3;
  override update() {
    if (this.fsm.state_time > 3000)
      return 4;
  }
}
class FSMState_Win extends FSMState {
  override readonly key: number = 4;
  override enter(): void {
    this.lfw.sounds.play_preset("pass");
    const score_board = this.node.find_child("score_board")
    score_board?.set_visible(true);
  }
  override leave(): void {
    const score_board = this.node.find_child("score_board")
    score_board?.set_visible(false);
  }
}
export class StageModeLogic extends UIComponent {
  static override readonly TAGS: string[] = ["StageModeLogic"];
  readonly fsm = new FSM<number, FSMState>().add(
    new FSMState(this),
    new FSMState_BeforeEnd(this),
    new FSMState_End(this),
    new FSMState_BeforeWin(this),
    new FSMState_Win(this)
  )
  jalousie?: Jalousie;
  gogogo?: ComponentsPlayer;
  gogogo_loop?: ComponentsPlayer;
  protected weapon_drop_timer = new Times(0, 1200);
  protected entity_callbacks: IEntityCallbacks = {
    on_dead: () => {
      // 队伍存活计数
      const player_teams: { [x in string]?: number } = {};

      for (const [, f] of this.world.puppets)
        player_teams[f.team] = 0 // 玩家队伍

      for (const e of this.world.entities) {
        if (is_fighter(e) && e.hp > 0 && player_teams[e.team] !== void 0)
          ++player_teams[e.team]!; // 存活计数++
      }

      // 剩余队伍数
      let team_remains = 0;
      traversal(player_teams, (_, v) => {
        if (v) ++team_remains;
      })

      // 大于0队，继续打
      if (team_remains > 0) {
        this.fsm.use(0);
      } else {
        this.fsm.use(1);
      }
    }
  }
  protected world_callbacks: IWorldCallbacks = {
    on_fighter_add: (entity: Entity): void => {
      entity.callbacks.add(this.entity_callbacks)
    },
    on_stage_change: (stage, prev) => {
      prev.callbacks.del(this.stage_callbacks)
      stage.callbacks.add(this.stage_callbacks);
      this.gogogo?.stop();
      this.gogogo?.node.set_visible(false)
      this.gogogo?.node.set_opacity(0)
      this.gogogo_loop?.stop();
      this.gogogo_loop?.node.set_visible(false)
      this.gogogo_loop?.node.set_opacity(0)
      if (this.jalousie) this.jalousie.open = true;
    }
  }

  protected stage_callbacks: IStageCallbacks = {
    on_phase_changed: (
      stage: Stage,
      curr: IStagePhaseInfo | undefined,
      prev: IStagePhaseInfo | undefined,
    ) => {
      this.debug('on_phase_changed', stage, curr, prev)
      if (stage.is_chapter_finish) return;
      if (!prev) {
        this.gogogo?.stop();
        this.gogogo?.node.set_visible(false)
        this.gogogo?.node.set_opacity(0)
        this.gogogo_loop?.stop();
        this.gogogo_loop?.node.set_visible(false)
        this.gogogo_loop?.node.set_opacity(0)
      }
      const { on_end } = prev || {};
      const { on_start } = curr || {};
      if (on_end?.length) this.handle_stage_actions(on_end)
      if (on_start?.length) this.handle_stage_actions(on_start)
    },
    on_chapter_finish: (stage: Stage) => {
      this.debug('on_chapter_finish', stage)
      this.fsm.use(3)
    },
    on_requrie_goto_next_stage: (stage: Stage) => {
      this.debug('on_requrie_goto_next_stage', stage)
      if (this.jalousie) this.jalousie.open = false;
    }
  }
  handle_stage_actions(actions: (string | StageActions)[]) {
    for (const action of actions) {
      switch (action) {
        case StageActions.GoGoGoRight:
          this.gogogo?.start();
          this.gogogo?.node.set_visible(true);
          break
        case StageActions.LoopGoGoGoRight:
          this.gogogo_loop?.start();
          this.gogogo_loop?.node.set_visible(true)
          break;
      }
    }
  }
  override on_start(): void {
    super.on_start?.();
    if (this.world.paused) this.world.paused = false;
    this.jalousie = this.node.search_component(Jalousie)
    this.gogogo = this.node.search_component(ComponentsPlayer, "play_gogogo")
    this.gogogo_loop = this.node.search_component(ComponentsPlayer, "play_gogogo_loop")
    for (const [, f] of this.world.puppets) {
      this.world_callbacks.on_fighter_add?.(f)
    }

    const stat_bars = this.node.search_components(FighterStatBar)
    let player_count = 0;
    let teams = new Set();
    for (const [, f] of this.world.puppets) {
      if (f) {
        teams.add(f.team);
        ++player_count
      }
    }

    for (let i = 0; i < stat_bars.length; i++) {
      const stat_bar = stat_bars[i];
      const enabled = player_count >= Number(stat_bar.node.id?.match(/p(\d)_stat/)?.[1]);
      stat_bar.node.visible = enabled;
      stat_bar.node.disabled = !enabled;
      if (enabled) continue;
      stat_bars.splice(i, 1);
      --i;
    }

    for (const [, fighter] of this.world.puppets) {
      if (!fighter) continue;
      const stat_bar = stat_bars.shift()
      if (!stat_bar) break;
      stat_bar.set_entity(fighter)
    }
    this.fsm.use(0);
    this.world.paused = false;
    this.world.dataset.playrate = 1;
    this.world.dataset.infinity_mp = 0;
    this.lfw.world.stage.callbacks.add(this.stage_callbacks);
    this.lfw.world.callbacks.add(this.world_callbacks);
  }
  override on_stop(): void {
    this.world.clear()
    this.lfw.world.stage.callbacks.del(this.stage_callbacks)
    this.lfw.world.callbacks.del(this.world_callbacks);
  }

  override update(dt: number): void {
    this.lfw.mt.mark = 'stage_mode_weapn_rain';
    if (
      !this.world.paused &&
      !this.lfw.world.stage.weapon_rain_disabled &&
      this.weapon_drop_timer.add() &&
      this.lfw.mt.range(0, 10) <= 2
    ) {
      this.lfw.weapons.add_random(1, true, EntityGroup.StageWeapon)
    }
    if (this.jalousie && !this.jalousie.open && this.jalousie.anim.done) {
      this.lfw.goto_next_stage()
      this.fsm.use(0)
      this.jalousie.open = true;
    }
    this.fsm.update(dt)
  }
  override on_key_down(e: IUIKeyEvent): void {
    switch (e.game_key) {
      case GameKey.a:
      case GameKey.j: {
        if (
          this.fsm.state?.key === 4 &&
          this.fsm.state_time > 1000
        ) {
          this.lfw.goto_next_stage();
          this.fsm.use(0)
        } else if (
          this.fsm.state?.key === 2 &&
          this.fsm.state_time > 1000
        ) {
          this.lfw.pop_ui_safe()
        }
        break;
      }
    }
  }
}
