import { get_team_text_color } from "../../base/get_team_text_color";
import { TeamEnum } from "../../defines/TeamEnum";
import { Stage } from "../../stage";
import { floor, max } from '../../utils/math/base';
import type { ITeamSumInfo } from "./ITeamSumInfo";
import { SummaryLogic } from "./SummaryLogic";
import { UIComponent } from "./UIComponent";

export class TeamSituationText extends UIComponent {
  static override readonly TAGS: string[] = ["TeamSituationText"]

  private _team: string | null = null;
  /** 队伍色随数据变化；字号、描边等静态样式在 UI 文件里 */
  private _team_color: string = 'white';
  private _sum: ITeamSumInfo | undefined;
  private _text: string = ' ';
  private _color?: string;
  override on_start(): void {
    super.on_start?.();
    this._team = this.str(0);
    if (this._team) {
      this.set_team(this._team)
    } else {
      this.world.callbacks.add(this)
      this.on_stage_change(this.world.stage)
    }
  }
  override on_stop(): void {
    if (!this._team) {
      this.world.callbacks.del(this)
    }
  }
  set_team(team: string) {
    this._team_color = get_team_text_color(team, get_team_text_color(TeamEnum.Team_2))
    this._sum = this.node.root.search_component(SummaryLogic)?.team_sum(team)
    this.rr();
  }
  on_stage_change(curr: Stage) {
    this.set_team(curr.team)
  }

  override on_resume(): void {
    this.rr();
  }

  override update(dt: number): void {
    if (this.world.game_time % 30 === 0) this.rr();
  }

  private rr() {
    if (!this._sum) return;
    let text = `Man: ${this._sum.lives}　HP: ${max(0, floor(this._sum.hp))}`;
    if (this._sum.reserve) text += `　Reserve: ${this._sum.reserve}`;
    if (this._text == text && this._color === this._team_color) return;
    this._text = text;
    this._color = this._team_color;
    const style = this.node.style;
    style.fill_style = this._team_color;
    this.node.set_text(text, style);
  }
}
