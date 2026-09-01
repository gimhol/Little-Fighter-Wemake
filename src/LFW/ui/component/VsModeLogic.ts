import { FSM } from "../../base/FSM";
import { EntityGroup, GameKey } from "../../defines";
import { Times } from "../../utils/Times";
import type { IUIKeyEvent } from "../IUIKeyEvent";
import { FighterStatBar } from "./FighterStatBar";
import { GameModeFSMState_BeforeEnd, GameModeFSMState_End, GameModeFSMState_Running, type GameModeFSMState } from "./GameModeFSMState";
import { ModeState } from "./ModeState";
import { UIComponent } from "./UIComponent";
export class VsModeLogic extends UIComponent {
  static override readonly TAGS: string[] = ["VsModeLogic"];
  readonly fsm = new FSM<ModeState, GameModeFSMState>().add(
    new GameModeFSMState_Running(this),
    new GameModeFSMState_BeforeEnd(this),
    new GameModeFSMState_End(this)
  )
  protected weapon_drop_timer = new Times(0, 1200);
  override on_start(): void {
    super.on_start?.();
    this.fsm.use(ModeState.Running)
    this.world.paused = false;
    this.world.dataset.playrate = 1;
    this.world.dataset.infinity_mp = 0;

    const stat_bars = this.node.search_components(FighterStatBar)

    let player_count = 0;
    for (const [, { fighter: f }] of this.lfw.players)
      if (f) ++player_count
    for (let i = 0; i < stat_bars.length; i++) {
      const stat_bar = stat_bars[i];
      let enabled = false;
      if (player_count == 2) { // 1 on 1.
        enabled = !!stat_bar.node.id?.startsWith(`_1v1_fighter_stat_`);
      } else {
        enabled = player_count >= Number(stat_bar.node.id?.match(/p(\d)_stat/)?.[1]);
      }
      stat_bar.node.visible = enabled;
      stat_bar.node.disabled = !enabled;
      if (enabled) continue;
      stat_bars.splice(i, 1);
      --i;
    }

    for (const [, { fighter }] of this.lfw.players) {
      if (!fighter) continue;
      const stat_bar = stat_bars.shift()
      if (!stat_bar) break;
      stat_bar.set_entity(fighter)
    }
  }
  override on_stop(): void {
    this.world.clear()
  }
  override update(dt: number): void {
    this.fsm.update(dt);
    this.lfw.mt.mark = 'vs_mode_weapn_rain';
    if (!this.world.paused && this.weapon_drop_timer.add() && this.lfw.mt.range(0, 10) <= 2) {
      this.lfw.weapons.add_random(1, true, EntityGroup.VsWeapon)
    }
  }
  override on_key_down(e: IUIKeyEvent): void {
    switch (e.game_key) {
      case GameKey.a:
      case GameKey.j: {
        if (
          this.fsm.state?.key == ModeState.End &&
          this.fsm.state_time > 1000
        ) {
          e.stop_immediate_propagation();
          this.lfw.pop_ui()
        }
        break;
      }
    }
  }
}
