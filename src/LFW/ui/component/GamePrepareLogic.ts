import { LocalController } from "../../controller/LocalController";
import { Defines, FacingFlag, TeamEnum } from "../../defines";
import type { IPropsMeta } from "../../defines/ISchema";
import { Ditto } from "../../ditto";
import { StatBarType } from "../../entity/StatBarType";
import type { ILFWCallback } from "../../ILFWCallback";
import { BackgroundSwitcher } from "./BackgroundSwitcher";
import { CharMenuLogic } from "./CharMenu/CharMenuLogic";
import { StageSwitcher } from "./StageSwitcher";
import { UIComponent } from "./UIComponent";
export interface IGamePrepareLogicProps {
  stage_switcher: StageSwitcher | null,
  bg_switcher: BackgroundSwitcher | null,
  game_mode: string | null,
}
const GAME_MODE_VS = "vs_mode"
const GAME_MODE_STAGE = "stage_mode"
export class GamePrepareLogic extends UIComponent<IGamePrepareLogicProps> {
  static override readonly TAGS: string[] = ["GamePrepareLogic"];
  static override readonly PROPS: IPropsMeta<IGamePrepareLogicProps> = {
    stage_switcher: StageSwitcher,
    bg_switcher: BackgroundSwitcher,
    game_mode: String
  }

  override on_start(): void {
    super.on_start?.();
    this.lfw.callbacks.add(this._lf2_callbacks)
  }
  override on_resume(): void {
    const background_row = this.node.search_node("background_row")!;
    const stage_row = this.node.search_node("stage_row")!;
    const char_menu_logic = this.node.search_component(CharMenuLogic)
    if (this.props.game_mode === GAME_MODE_STAGE) {
      stage_row.set_visible(true).set_disabled(false);
      background_row.set_visible(false).set_disabled(true);
      if (char_menu_logic) char_menu_logic.teams = [TeamEnum.Team_1]
      if (char_menu_logic) char_menu_logic.min_player = 1;
    } else {
      background_row.set_visible(true).set_disabled(false);
      stage_row.set_visible(false).set_disabled(true);
      if (char_menu_logic) char_menu_logic.min_player = 2;
    }
  }

  protected _lf2_callbacks: ILFWCallback = {
    on_broadcast: (message) => {
      if (message === 'start_game') return this.start_game();
    }
  }
  override on_stop(): void {
    this.lfw.change_stage('')
    this.lfw.change_bg('')
    this.lfw.callbacks.del(this._lf2_callbacks)
  }
  start_game() {
    const char_menu_logic = this.node.search_component(CharMenuLogic)
    if (!char_menu_logic) return;

    const { bg_switcher, stage_switcher } = this.props
    if (stage_switcher?.node.visible && !stage_switcher.node.disabled)
      this.lfw.change_bg(stage_switcher.stage.bg ?? "");
    else if (bg_switcher?.node.visible && !bg_switcher.node.disabled)
      this.lfw.change_bg(bg_switcher.background.id);

    const { far, near, left, right } = this.lfw.world.bg;
    const is_stage_mode = this.props.game_mode === GAME_MODE_STAGE
    const is_vs_mode = this.props.game_mode === GAME_MODE_VS

    this.lfw.mt.mark = 'gpl_start_game_cam_x';
    let cam_x = is_stage_mode ? 0 : this.lfw.mt.range(left, right - Defines.MODERN_SCREEN_WIDTH)

    for (const [player, slot_info] of char_menu_logic.players) {
      const { fighter: fighter_data } = slot_info;
      if (!fighter_data) {
        Ditto.warn(`[${GamePrepareLogic.TAG}::start_game] failed to create fighter. figher data: ${fighter_data}`);
        debugger;
        continue;
      }

      const fighter = this.lfw.factory.create_entity(this.world, fighter_data)
      if (!fighter) {
        Ditto.warn(`[${GamePrepareLogic.TAG}::start_game] failed to create fighter. figher data: ${fighter_data}`);
        debugger;
        continue;
      }
      fighter.team = slot_info.team || this.lfw.new_team;
      fighter.stat_bar_type = StatBarType.UI;
      fighter.facing = is_stage_mode ?
        FacingFlag.Right :
        this.lfw.mt.pick([FacingFlag.Left, FacingFlag.Right])!;
      if (player.is_com) {
        fighter.ctrl = this.lfw.factory.create_ctrl(fighter_data.id, player.id, fighter);
      } else {
        fighter.ctrl = new LocalController(player.id, fighter);
      }
      const xx1 = is_stage_mode ? 40 : 1 * Defines.MODERN_SCREEN_WIDTH / 3;
      const xx2 = is_stage_mode ? 80 : 2 * Defines.MODERN_SCREEN_WIDTH / 3;

      this.lfw.mt.mark = 'gpl_fighter_x';
      const x = this.lfw.mt.range(xx1, xx2) + cam_x;
      this.lfw.mt.mark = 'gpl_fighter_z';
      const z = this.lfw.mt.range(far, near)
      const seg = this.world.ground.segment(x, z)
      const y = this.world.ground.y(seg, x, z);
      fighter.set_position(x, y, z);
      fighter.blinking = this.world.dataset.begin_blink_time;
      if (is_vs_mode) fighter.mp = (fighter.mp_max * 2 / 5)
      fighter.attach();
    }

    if (is_stage_mode) {
      if (stage_switcher)
        this.lfw.change_stage(stage_switcher.stage.id ?? "");
      this.lfw.push_ui({ id: "stage_mode_page" });
    } else {
      this.lfw.push_ui({ id: "vs_mode_page" });
    }
    this.world.camera.jump_x(cam_x);
  }
}

