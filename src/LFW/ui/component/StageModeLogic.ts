import { FSM } from "../../base/FSM";
import { EntityGroup, GameKey, StageActions, type IStagePhaseInfo } from "../../defines";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import type { Stage } from "../../stage";
import type { IStageCallbacks } from "../../stage/IStageCallbacks";
import { Times } from "../../utils/Times";
import type { IUIKeyEvent } from "../IUIKeyEvent";
import { ComponentsPlayer } from "./ComponentsPlayer";
import { FighterStatBar } from "./FighterStatBar";
import { GameModeFSMState, GameModeFSMState_BeforeEnd, GameModeFSMState_End, GameModeFSMState_Running } from "./GameModeFSMState";
import { Jalousie } from "./Jalousie";
import { ModeState } from "./ModeState";
import { UIComponent } from "./UIComponent";

export class StageModeLogic extends UIComponent {
  static override readonly TAGS: string[] = ["StageModeLogic"];
  readonly fsm = new FSM<ModeState, GameModeFSMState>().add(
    new GameModeFSMState_Running(this),
    new GameModeFSMState_BeforeEnd(this),
    new GameModeFSMState_End(this)
  )
  jalousie?: Jalousie;
  gogogo?: ComponentsPlayer;
  gogogo_loop?: ComponentsPlayer;
  protected weapon_drop_timer = new Times(0, 1200);
  protected world_callbacks: IWorldCallbacks = {
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
    this.fsm.use(ModeState.Running);
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
      this.fsm.use(ModeState.Running)
      this.jalousie.open = true;
    }
    this.fsm.update(dt)
  }
  override on_key_down(e: IUIKeyEvent): void {
    switch (e.game_key) {
      case GameKey.a:
      case GameKey.j: {
        if (
          this.fsm.state?.key === ModeState.End &&
          this.fsm.state_time > 1000
        ) {
          if (this.world.stage.is_chapter_finish) {
            this.lfw.goto_next_stage();
            this.fsm.use(ModeState.Running)
          } else {
            this.lfw.pop_ui_safe()
          }
        }
        break;
      }
    }
  }
}
