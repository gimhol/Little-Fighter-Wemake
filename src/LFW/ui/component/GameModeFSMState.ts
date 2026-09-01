import type { FSM } from "../../base";
import { ComponentFSMState } from "./ComponentFSMState";
import { ModeState } from "./ModeState";
import type { UIComponent } from "./UIComponent";

export type FSMComponent = UIComponent & {
  readonly fsm: FSM<ModeState, GameModeFSMState>;
}
export class GameModeFSMState<C extends FSMComponent = FSMComponent> extends ComponentFSMState<ModeState, C> {
  override readonly key: ModeState = ModeState.Invalid;
  get fsm() { return this.owner.fsm; }
}
export class GameModeFSMState_Running<C extends FSMComponent = FSMComponent> extends GameModeFSMState<C> {
  override readonly key: ModeState = ModeState.Running;
  override update(): void | ModeState | undefined {
    if (this.world.paused) return;
    if (this.world.game_result())
      return ModeState.BeforeEnd;
  }
}
export class GameModeFSMState_BeforeEnd<C extends FSMComponent = FSMComponent> extends GameModeFSMState<C> {
  override readonly key: ModeState = ModeState.BeforeEnd;
  private _time: number = 0;
  override enter(): void { this._time = 0; }
  override leave(): void { this._time = 0; }
  override update(dt: number) {
    if (this.world.paused) return;
    this._time += dt;
    if (this._time < 3000) return;
    return this.world.game_result() ? ModeState.End : ModeState.Running;
  }
}

export class GameModeFSMState_End<C extends FSMComponent = FSMComponent> extends GameModeFSMState<C> {
  override readonly key: ModeState = ModeState.End;
  override enter(): void {
    if (this.world.game_result() == 'win')
      this.lfw.sounds.play_preset("pass");
    else
      this.lfw.sounds.play_preset("end");
    const score_board = this.node.find_child("score_board");
    score_board?.set_visible(true);
  }
  override leave(): void {
    const score_board = this.node.find_child("score_board");
    score_board?.set_visible(false);
  }
}

