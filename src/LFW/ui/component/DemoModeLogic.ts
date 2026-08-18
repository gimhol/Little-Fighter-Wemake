import { FSM } from "../../base/FSM";
import { Defines, EntityGroup, GameKey } from "../../defines";
import { FacingFlag } from "../../defines/FacingFlag";
import type { IPropsMeta } from "../../defines/ISchema";
import type { IStageInfo } from "../../defines/IStageInfo";
import type { IStagePhaseInfo } from "../../defines/IStagePhaseInfo";
import { StageActions } from "../../defines/StageActions";
import { StageGroup } from "../../defines/StageGroup";
import { Entity } from "../../entity";
import type { IEntityCallbacks } from "../../entity/IEntityCallbacks";
import { StatBarType } from "../../entity/StatBarType";
import { is_fighter } from "../../entity/type_check";
import { Randoming } from "../../helper/Randoming";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import { LFW } from "../../LFW";
import type { IStageCallbacks } from "../../stage/IStageCallbacks";
import { Stage } from "../../stage/Stage";
import { traversal } from '../../utils/container_help/traversal';
import { range } from "../../utils/math/range";
import { Times } from "../../utils/Times";
import type { IUIKeyEvent } from "../IUIKeyEvent";
import { UINode } from "../UINode";
import { CameraCtrl } from "./CameraCtrl";
import { ComponentFSMState } from "./ComponentFSMState";
import { ComponentsPlayer } from "./ComponentsPlayer";
import { FighterStatBar } from "./FighterStatBar";
import { Jalousie } from "./Jalousie";
import { Label } from "./Label";
import { UIComponent } from "./UIComponent";


enum StateKey {
  Base = 'Base',
  BeforeEnd = 'BeforeEnd',
  End = 'End',
  BeforeWin = 'BeforeWin',
  Win = 'Win',
  Restart = "Restart",
}
class DemoFSMState_Base extends ComponentFSMState<StateKey, DemoModeLogic> {
  override readonly key: StateKey = StateKey.Base;
  get fsm(): FSM<StateKey, DemoFSMState_Base> { return this.owner.fsm }
}
class DemoFSMState_BeforeEnd extends DemoFSMState_Base {
  override readonly key: StateKey = StateKey.BeforeEnd;
  override update() {
    if (this.fsm.state_time > 3000)
      return StateKey.End;
  }
}
class DemoFSMState_End extends DemoFSMState_Base {
  override readonly key: StateKey = StateKey.End;
  override update() {
    if (this.fsm.state_time > 5000)
      return StateKey.Restart;
  }
  override enter(): void {
    this.lfw.sounds.play_preset("end");
    this.owner.props.score_board?.set_visible(true);
  }
  override leave(): void {
    this.owner.props.score_board?.set_visible(false);
  }
}
class DemoFSMState_BeforeWin extends DemoFSMState_Base {
  override readonly key: StateKey = StateKey.BeforeWin;
  override update() {
    if (this.fsm.state_time > 3000)
      return StateKey.Win;
  }
}
class DemoFSMState_Win extends DemoFSMState_Base {
  override readonly key: StateKey = StateKey.Win;
  override update() {
    if (this.fsm.state_time > 5000)
      return StateKey.Restart;
  }
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
class DemoFSMState_Restart extends DemoFSMState_Base {
  override readonly key: StateKey = StateKey.Restart;
  override update() {
    this.owner.clearup()
    this.owner.startup()
    return StateKey.Base;
  }
}
export interface IDemoModeLogicProps {
  focus_prefix?: Label;
  focus_on?: Label;
  cam_ctrl?: CameraCtrl;
  score_board?: UINode;
  situation_name?: Label,
  focus_text_node?: UINode,
  jalousie?: Jalousie,
  gogogo?: ComponentsPlayer,
  gogogo_loop?: ComponentsPlayer,
}
interface DemoSituation {
  title: string;
  stage_mode: boolean;
  teams: ReadonlyArray<string>,
}
export class DemoModeLogic extends UIComponent<IDemoModeLogicProps> {
  static override readonly TAGS: string[] = ["DemoModeLogic"];
  static override readonly PROPS: IPropsMeta<IDemoModeLogicProps> = {
    focus_prefix: Label,
    focus_on: Label,
    cam_ctrl: CameraCtrl,
    score_board: UINode,
    situation_name: Label,
    focus_text_node: UINode,
    jalousie: Jalousie,
    gogogo: ComponentsPlayer,
    gogogo_loop: ComponentsPlayer,
  };
  readonly fsm = new FSM<StateKey, DemoFSMState_Base>(`DemoFSM`).add(
    new DemoFSMState_Base(this),
    new DemoFSMState_BeforeEnd(this),
    new DemoFSMState_End(this),
    new DemoFSMState_BeforeWin(this),
    new DemoFSMState_Win(this),
    new DemoFSMState_Restart(this)
  )

  protected _staring?: Entity | undefined;
  protected _free?: boolean
  protected weapon_drop_timer = new Times(0, 1200);
  protected static _situations: Randoming<DemoSituation> | null = null
  protected static _situation: DemoSituation | null = null
  protected static _stages: Randoming<IStageInfo> | null = null
  protected static get_situations(lfw: LFW) {
    if (this._situations) return this._situations;
    return this._situations = new Randoming<DemoSituation>([
      /* 闯关 */
      { title: '1 Players Stage Mode', stage_mode: true, teams: new Array(1).fill('1') },
      { title: '2 Players Stage Mode', stage_mode: true, teams: new Array(2).fill('1') },
      { title: '3 Players Stage Mode', stage_mode: true, teams: new Array(3).fill('1') },
      { title: '4 Players Stage Mode', stage_mode: true, teams: new Array(4).fill('1') },
      { title: '5 Players Stage Mode', stage_mode: true, teams: new Array(5).fill('1') },
      { title: '6 Players Stage Mode', stage_mode: true, teams: new Array(6).fill('1') },
      { title: '7 Players Stage Mode', stage_mode: true, teams: new Array(7).fill('1') },
      { title: '8 Players Stage Mode', stage_mode: true, teams: new Array(8).fill('1') },

      /* 各自为战 */
      { title: '2 Players, VS Mode', stage_mode: false, teams: range(1, 2).map(v => '' + v) },
      { title: '3 Players, VS Mode', stage_mode: false, teams: range(1, 3).map(v => '' + v) },
      { title: '4 Players, VS Mode', stage_mode: false, teams: range(1, 4).map(v => '' + v) },
      { title: '5 Players, VS Mode', stage_mode: false, teams: range(1, 5).map(v => '' + v) },
      { title: '6 Players, VS Mode', stage_mode: false, teams: range(1, 6).map(v => '' + v) },
      { title: '7 Players, VS Mode', stage_mode: false, teams: range(1, 7).map(v => '' + v) },
      { title: '8 Players, VS Mode', stage_mode: false, teams: range(1, 8).map(v => '' + v) },

      /* 两队交战 */
      { title: "2 Teams, 4 Players, VS Mode", stage_mode: false, teams: ['1', '1', '2', '2'] },
      { title: "3 Teams, 4 Players, VS Mode", stage_mode: false, teams: ['1', '1', '1', '2', '2', '2'] },
      { title: "4 Teams, 4 Players, VS Mode", stage_mode: false, teams: ['1', '1', '1', '1', '2', '2', '2', '2'] },

      /* 三队交战 */
      { title: "3 Teams, 6 Players, VS Mode", stage_mode: false, teams: ['1', '1', '2', '2', '3', '3'] },

      /* 四队交战 */
      { title: "4 Teams, 6 Players, VS Mode", stage_mode: false, teams: ['1', '1', '2', '2', '3', '3', '4', '4'] },
    ], lfw.mt)
  }
  protected static get_situation(lfw: LFW) {
    if (this._situation) return this._situation;
    return this._situation = this.get_situations(lfw).get();
  }
  protected static clear_situation() {
    this._situation = null
  }
  protected static get_stages(lfw: LFW): Randoming<IStageInfo> {
    if (this._stages) return this._stages
    return this._stages = new Randoming(
      lfw.datas.stages.filter(v => {
        return (
          false != v.group?.some(v => v != StageGroup.Hidden) &&
          false != v.group?.some(v => v != StageGroup.Dev) &&
          v.is_starting
        )
      }),
      lfw.mt
    )
  }
  get is_stage_mode(): boolean { return DemoModeLogic.get_situation(this.lfw).stage_mode }
  get is_vs_mode(): boolean { return !DemoModeLogic.get_situation(this.lfw).stage_mode }
  handle_stage_actions(actions: (string | StageActions)[]) {
    for (const action of actions) {
      switch (action) {
        case StageActions.GoGoGoRight:
          this.props.gogogo?.start();
          this.props.gogogo?.node.set_visible(true);
          break
        case StageActions.LoopGoGoGoRight:
          this.props.gogogo_loop?.start();
          this.props.gogogo_loop?.node.set_visible(true)
          break;
      }
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
        this.props.gogogo?.stop();
        this.props.gogogo?.node.set_visible(false)
        this.props.gogogo?.node.set_opacity(0)
        this.props.gogogo_loop?.stop();
        this.props.gogogo_loop?.node.set_visible(false)
        this.props.gogogo_loop?.node.set_opacity(0)
      }
      const { on_end } = prev || {};
      const { on_start } = curr || {};
      if (on_end?.length) this.handle_stage_actions(on_end)
      if (on_start?.length) this.handle_stage_actions(on_start)
    },
    on_chapter_finish: (stage: Stage) => {
      this.debug('on_chapter_finish', stage)
      this.fsm.use(StateKey.BeforeWin)
    },
    on_requrie_goto_next_stage: (stage: Stage) => {
      this.debug('on_requrie_goto_next_stage', stage)
      if (this.props.jalousie) this.props.jalousie.open = false;
    }
  }
  startup() {
    this.fsm.use(StateKey.Base)
    this.props.focus_text_node?.set_visible(false)
    let stage: IStageInfo | undefined
    if (this.is_stage_mode) {
      stage = DemoModeLogic.get_stages(this.lfw).get()
      this.lfw.change_bg(stage?.bg ?? '?');
    } else {
      const bg = this.lfw.mt.pick(this.lfw.datas.backgrounds)
      this.lfw.change_bg(bg?.id || '?')
    }
    const fighters_datas = this.lfw.datas.get_fighters_of_group(
      EntityGroup.Regular,
    );
    const boss_datas = this.lfw.datas.get_fighters_of_group(
      EntityGroup.Boss,
    );

    this.world.paused = false;
    const { far, near, left, right } = this.lfw.world.bg;
    const { is_stage_mode, is_vs_mode } = this;
    if (is_vs_mode) this.lfw.sounds.play_bgm('?');
    else fighters_datas.push(...boss_datas)

    let cam_x = is_stage_mode ? 0 : this.lfw.mt.range(left, right - Defines.MODERN_SCREEN_WIDTH)
    const min_x = is_stage_mode ? (cam_x + 40) : (cam_x + 1 * Defines.MODERN_SCREEN_WIDTH / 3)
    const max_x = is_stage_mode ? (80) : (cam_x + 2 * Defines.MODERN_SCREEN_WIDTH / 3)

    const situation = DemoModeLogic.get_situation(this.lfw);
    this.props.situation_name?.set_text(situation.title)
    const { teams } = situation
    const players = Array.from(this.lfw.players.values());
    for (let i = 0; i < teams.length; i++) {
      const player = players[i]!;
      const team = teams[i]!;
      if (!player) continue;

      const fighter_data = this.lfw.mt.take(fighters_datas);
      if (!fighter_data) continue;

      const fighter = this.lfw.factory.create_entity(this.world, fighter_data);
      if (!fighter) return;
      fighter.team = team ?? this.lfw.new_team;
      fighter.facing = is_stage_mode ?
        FacingFlag.Right :
        this.lfw.mt.pick([FacingFlag.Left, FacingFlag.Right])!;

      fighter.ctrl = this.lfw.factory.create_ctrl(fighter_data.id, player.id, fighter);
      fighter.key_role = true;
      fighter.name_visible = true;
      fighter.stat_bar_type = StatBarType.UI;
      fighter.ctrl = this.lfw.factory.create_ctrl(
        fighter_data.id,
        player.id,
        fighter,
      );

      const x = this.lfw.mt.range(min_x, max_x)
      fighter.set_position(x, void 0, this.lfw.mt.range(far, near))
      fighter.blinking = this.world.dataset.begin_blink_time;
      if (is_vs_mode) fighter.mp = (fighter.mp_max * 2 / 5)
      fighter.attach();
    }

    const stat_bars = this.node.search_components(FighterStatBar)
    for (let i = 0; i < stat_bars.length; i++) {
      const stat_bar = stat_bars[i];
      const enabled = teams.length >= Number(stat_bar.node.id?.match(/p(\d)_stat/)?.[1]);
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

    for (const [, f] of this.world.puppets) {
      this.world_callbacks.on_fighter_add?.(f)
    }
    if (is_stage_mode && stage) {
      this.lfw.change_stage(stage.id ?? "");
      this.lfw.world.stage.callbacks.add(this.stage_callbacks);
    }
    this.lfw.world.callbacks.add(this.world_callbacks);
    this.props.cam_ctrl?.focus_lr(1);
    this.world.camera.destination.x = cam_x;
    this.world.camera.position.x = cam_x;
  }
  clearup() {
    this.lfw.world.stage.callbacks.del(this.stage_callbacks)
    this.lfw.world.callbacks.del(this.world_callbacks);
    this.world.clear();
    DemoModeLogic.clear_situation()
  }
  override on_start(): void {
    super.on_start?.();
    if (this.lfw.first_ui !== 'init_demo')
      this.node.search_node("demo_play_link")?.set_visible(false)
    this.startup();
  }
  override on_stop(): void {
    super.on_stop?.();
    this.clearup()
  }
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
      let plater_team_remains = 0;
      traversal(player_teams, (_, v) => {
        if (v) ++plater_team_remains;
      })
      const { is_stage_mode, is_vs_mode } = this;
      if (is_stage_mode) {
        // 大于0队，继续打
        if (plater_team_remains > 0) {
          this.fsm.use(StateKey.Base)
        } else {
          this.fsm.use(StateKey.BeforeEnd)
        }
      } else if (is_vs_mode) {
        // 大于一队，继续打
        if (plater_team_remains > 1) {
          this.fsm.use(StateKey.Base)
        } else {
          this.fsm.use(StateKey.BeforeEnd)
        }
      }

    }
  }
  protected world_callbacks: IWorldCallbacks = {
    on_fighter_add: (entity: Entity): void => {
      entity.callbacks.add(this.entity_callbacks)
    },
    on_stage_change: (stage, prev) => {
      if (!this.is_stage_mode) return;
      prev.callbacks.del(this.stage_callbacks)
      stage.callbacks.add(this.stage_callbacks);
      this.props.gogogo?.stop();
      this.props.gogogo?.node.set_visible(false)
      this.props.gogogo?.node.set_opacity(0)
      this.props.gogogo_loop?.stop();
      this.props.gogogo_loop?.node.set_visible(false)
      this.props.gogogo_loop?.node.set_opacity(0)
      if (this.props.jalousie) this.props.jalousie.open = true;
    }
  }
  override update(dt: number): void {
    if (
      !this.world.paused &&
      !this.lfw.world.stage.weapon_rain_disabled &&
      this.weapon_drop_timer.add() &&
      this.lfw.mt.range(0, 10) <= 2
    ) {
      this.lfw.weapons.add_random(1, true,
        this.is_stage_mode ?
          EntityGroup.StageWeapon :
          EntityGroup.VsWeapon
      )
    }
    const { cam_ctrl } = this.props;
    do {
      if (!cam_ctrl) break;
      const { staring, auto: free } = cam_ctrl
      if (this._staring == staring && this._free == free)
        break;
      this._staring = staring
      this._free = free
      if (!free) {
        this.props.focus_prefix?.set_text("cam_controlling");
        this.props.focus_on?.node.set_visible(false)
      }
      const txt = staring ? `[${staring.team}] ${staring.name}` : '-'
      this.props.focus_prefix?.set_text("curr_focus")
      this.props.focus_on?.node.set_visible(true)
      this.props.focus_on?.set_text(txt)

    } while (0)
    if (this.is_stage_mode) {
      if (this.props.jalousie && !this.props.jalousie.open && this.props.jalousie.anim.done) {
        this.lfw.goto_next_stage()
        this.fsm.use(StateKey.Base)
        this.props.jalousie.open = true;
      }
    }
    this.fsm.update(dt)
  }

  override on_key_down(e: IUIKeyEvent): void {
    switch (e.game_key) {
      case GameKey.a: {
        this.clearup()
        this.startup()
        break;
      }
    }
  }
}
