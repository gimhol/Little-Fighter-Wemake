import type { IStagePhaseInfo } from "../../defines";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import type { IStageCallbacks } from "../../stage/IStageCallbacks";
import { Stage } from "../../stage";
import { UIComponent } from "./UIComponent";

export class StageTitleText extends UIComponent {
  static override readonly TAGS: string[] = ["StageTitleText"];
  private _title: string = '';
  private _stage: Stage | null = null;

  private _world_cbs: IWorldCallbacks = {
    on_stage_change: (stage: Stage) => this.set_stage(stage)
  }
  private _stage_cbs: IStageCallbacks = {
    on_phase_changed: (_, phase) => this.set_phase(phase || null)
  }
  set_stage(stage: Stage | null) {
    if (this._stage == stage) return;
    this._stage?.callbacks.del(this._stage_cbs);
    stage?.callbacks.add(this._stage_cbs);
    this._stage = stage;
    this.set_phase(stage?.phase || null)
  }
  set_phase(phase: IStagePhaseInfo | null) {
    const title = this.lfw.t(phase?.title ?? this._stage?.title ?? '')
    this.set_title(title)
  }
  /** 文字样式由 UI 文件里的 style 决定，这里只负责内容 */
  set_title(title: string) {
    if (this._title == title) return;
    this._title = title;
    this.node.set_text(title);
  }
  override on_start(): void {
    super.on_start?.();
    this._title = '';
    this.world.callbacks.add(this._world_cbs)
    this.set_stage(this.world.stage)
  }
  override on_stop(): void {
    this.world.callbacks.del(this._world_cbs)
    this.set_stage(null)
  }
}
