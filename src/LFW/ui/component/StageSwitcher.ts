import { CheatEnum, Defines, type IStageInfo, StageGroup as SG } from "../../defines";
import { UIComponent } from "./UIComponent";

export class StageSwitcher extends UIComponent {
  static override readonly TAGS: string[] = ["StageSwitcher"];
  private _stage: IStageInfo = Defines.VOID_STAGE;
  get show_all(): boolean {
    return this.lfw.is_cheat(CheatEnum.GIM_INK);
  }
  get stages(): IStageInfo[] {
    const cheat_0 = this.lfw.is_cheat(CheatEnum.LF2_NET);
    const cheat_1 = this.lfw.is_cheat(CheatEnum.GIM_INK);
    const all = this.lfw.datas.stages;
    if (cheat_0 && cheat_1) return all
    const ret = all.filter(v => {
      if (!cheat_0 && v.group?.some(v => v == SG.Hidden))
        return false;
      if (!cheat_1 && v.group?.some(v => v == SG.Dev))
        return false;
      if (!cheat_1 && !v.is_starting)
        return false
      return true
    })
    return ret.length ? ret : all;
  }
  get stage(): IStageInfo {
    return this._stage;
  }
  get stage_text(): string {
    if (this.show_all) return this._stage.name ?? "";
    return this._stage.starting_name ?? this._stage.name ?? "";
  }
  override on_resume(): void {
    this.lfw.callbacks.add(this)
  }
  override on_pause(): void {
    this.lfw.callbacks.del(this);
  }
  override on_show(): void {
    if (this._stage === Defines.VOID_STAGE) this.on_broadcast(Defines.BuiltIn_Broadcast.SwitchStage);
  }
  on_broadcast(v: string) {
    let dir = 1;
    switch (v) {
      case Defines.BuiltIn_Broadcast.SwitchStage: dir = 1; break;
      case Defines.BuiltIn_Broadcast.SwitchStageR: dir = -1; break;
      default: return;
    }
    const { stages } = this;
    if (!stages.length) {
      this._stage = Defines.VOID_STAGE;
      this.world.stage.change_bg(Defines.VOID_BG)
    } else {
      const state_id = this.stage.id;
      const curr_idx = stages.findIndex((v) => v.id === state_id);
      const next_idx = (curr_idx + stages.length + dir) % stages.length;
      this._stage = stages[next_idx];
      const bdt = this.world.lfw.datas.backgrounds.find(v => v.id === this._stage.bg);
      this.world.stage.change_bg(bdt ?? Defines.VOID_BG)
    }
    this.node.set_text(this.stage_text)
  }
}
