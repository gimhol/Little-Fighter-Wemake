import { FSM } from "../../base/FSM";
import { EntityGroup, GameKey } from "../../defines";
import type { IEntityCallbacks } from "../../entity/IEntityCallbacks";
import { is_fighter } from "../../entity/type_check";
import { traversal } from "../../utils/container_help/traversal";
import { Times } from "../../utils/Times";
import type { IUIKeyEvent } from "../IUIKeyEvent";
import { ComponentFSMState } from "./ComponentFSMState";
import { FighterStatBar } from "./FighterStatBar";
import { UIComponent } from "./UIComponent";

class FSMState extends ComponentFSMState<number, VsModeLogic> {
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

export class VsModeLogic extends UIComponent {
  static override readonly TAGS: string[] = ["VsModeLogic"];
  readonly fsm = new FSM<number, FSMState>().add(
    new FSMState(this),
    new FSMState_BeforeEnd(this),
    new FSMState_End(this)
  )

  protected weapon_drop_timer = new Times(0, 1200);
  protected fighter_callbacks: IEntityCallbacks = {
    on_dead: () => {
      // 各队伍存活计数
      const player_teams: { [x in string]?: number } = {};

      for (const [, { fighter }] of this.lfw.players)
        if (fighter)
          player_teams[fighter.team] = 0 // 玩家队伍

      for (const e of this.world.entities) {
        if (is_fighter(e) && e.hp > 0 && player_teams[e.team] !== void 0)
          ++player_teams[e.team]!; // 存活计数++
      }

      // 剩余队伍数
      let team_remains = 0;
      traversal(player_teams, (_, v) => {
        if (v) ++team_remains;
      })

      // 大于一队，继续打
      if (team_remains > 1) return;
      this.fsm.use(1)
    }
  }

  override on_start(): void {
    super.on_start?.();
    this.fsm.use(0)

    for (const [, { fighter: f }] of this.lfw.players)
      if (f) f.callbacks.add(this.fighter_callbacks)
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
          this.fsm.state?.key == 2 &&
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
