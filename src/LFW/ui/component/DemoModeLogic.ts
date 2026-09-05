import { FSM } from "../../base/FSM";
import { Defines, EntityGroup, GameKey, OID, type IEntityData } from "../../defines";
import { FacingFlag } from "../../defines/FacingFlag";
import type { IPropsMeta } from "../../defines/ISchema";
import type { IStageInfo } from "../../defines/IStageInfo";
import type { IStagePhaseInfo } from "../../defines/IStagePhaseInfo";
import { StageActions } from "../../defines/StageActions";
import { StageGroup } from "../../defines/StageGroup";
import { Entity } from "../../entity";
import { StatBarType } from "../../entity/StatBarType";
import { Randoming } from "../../helper/Randoming";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import { LFW } from "../../LFW";
import type { IStageCallbacks } from "../../stage/IStageCallbacks";
import { Stage } from "../../stage/Stage";
import { max } from "../../utils";
import { range } from "../../utils/math/range";
import { Times } from "../../utils/Times";
import type { IUIKeyEvent } from "../IUIKeyEvent";
import { UINode } from "../UINode";
import { CameraCtrl } from "./CameraCtrl";
import { ComponentsPlayer } from "./ComponentsPlayer";
import { FighterStatBar } from "./FighterStatBar";
import { GameModeFSMState_BeforeEnd, GameModeFSMState_End, GameModeFSMState_Running, type GameModeFSMState } from "./GameModeFSMState";
import { Jalousie } from "./Jalousie";
import { ModeState } from "./ModeState";
import { UIComponent } from "./UIComponent";

export interface IDemoModeLogicProps {
  focus_prefix?: UINode;
  focus_on?: UINode;
  cam_ctrl?: CameraCtrl;
  score_board?: UINode;
  situation_name?: UINode,
  focus_text_node?: UINode,
  jalousie?: Jalousie,
  gogogo?: ComponentsPlayer,
  gogogo_loop?: ComponentsPlayer,
}
interface DemoSituation {
  title: string;
  stage_mode: boolean;
  bg?: string;
  stage?: string;
  teams?: ReadonlyArray<string>,
  oids?: ReadonlyArray<string>,
}
export class DemoModeLogic extends UIComponent<IDemoModeLogicProps> {
  static override readonly TAGS: string[] = ["DemoModeLogic"];
  static override readonly PROPS: IPropsMeta<IDemoModeLogicProps> = {
    focus_prefix: UINode,
    focus_on: UINode,
    cam_ctrl: CameraCtrl,
    score_board: UINode,
    situation_name: UINode,
    focus_text_node: UINode,
    jalousie: Jalousie,
    gogogo: ComponentsPlayer,
    gogogo_loop: ComponentsPlayer,
  };
  readonly fsm = new FSM<ModeState, GameModeFSMState>(`DemoFSM`).add(
    new GameModeFSMState_Running(this),
    new GameModeFSMState_BeforeEnd(this),
    new GameModeFSMState_End(this),
  )

  protected _staring?: Entity | undefined;
  protected _free?: boolean
  protected weapon_drop_timer = new Times(0, 1200);
  protected static _situations: Randoming<DemoSituation> | null = null
  protected static _situation: DemoSituation | null = null
  protected static _stages: Randoming<IStageInfo> | null = null
  protected static get_situations(lfw: LFW) {
    if (this._situations) return this._situations;
    return this._situations = new Randoming<DemoSituation>('demo_situation_randoming', [
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
      { title: "3 Teams, 6 Players, VS Mode", stage_mode: false, teams: ['1', '1', '1', '2', '2', '2'] },
      { title: "4 Teams, 8 Players, VS Mode", stage_mode: false, teams: ['1', '1', '1', '1', '2', '2', '2', '2'] },

      /* 三队交战 */
      { title: "3 Teams, 6 Players, VS Mode", stage_mode: false, teams: ['1', '1', '2', '2', '3', '3'] },

      /* 四队交战 */
      { title: "4 Teams, 8 Players, VS Mode", stage_mode: false, teams: ['1', '1', '2', '2', '3', '3', '4', '4'] },

      /* Julian VS 10 Fighters */
      {
        title: "Julian VS 10 Fighters",
        stage_mode: false,
        teams: ['2', '2', '2', '2', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'],
        oids: [
          OID.Julian, OID.Justin, OID.Justin, OID.Justin,
          OID.Deep, OID.John, OID.Henry, OID.Rudolf, OID.Louis,
          OID.Firen, OID.Freeze, OID.Dennis, OID.Woody, OID.Davis,
        ]
      },

      /* Firzen VS 8 Fighters */
      {
        title: " VS 10 Fighters",
        stage_mode: false,
        teams: ['2', '2', '2', '2', '1', '1', '1', '1', '1', '1', '1', '1'],
        oids: [
          OID.Firzen, OID.Jan, OID.Sorcerer, OID.Sorcerer,
          OID.Deep, OID.John, OID.Henry, OID.Rudolf,
          OID.Louis, OID.Dennis, OID.Woody, OID.Davis,
        ]
      },

      /* LouisEX VS 9 Fighters */
      {
        title: "LouisEX VS 10 Fighters",
        stage_mode: false,
        teams: ['2', '2', '2', '2', '1', '1', '1', '1', '1', '1', '1'],
        oids: [
          OID.LouisEX, OID.Monk, OID.Monk, OID.Monk,
          OID.Deep, OID.John, OID.Henry, OID.Rudolf,
          OID.Firen, OID.Freeze, OID.Dennis, OID.Woody, OID.Davis,
        ]
      },

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
      'stage_randoming',
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
    on_requrie_goto_next_stage: (stage: Stage) => {
      this.debug('on_requrie_goto_next_stage', stage)
      if (this.props.jalousie) this.props.jalousie.open = false;
    }
  }
  startup() {
    this.fsm.use(ModeState.Running)
    this.props.focus_text_node?.set_visible(false)
    let stage: IStageInfo | undefined
    if (this.is_stage_mode) {
      stage = DemoModeLogic.get_stages(this.lfw).get()
      this.lfw.change_bg(stage?.bg ?? '?');
    } else {
      this.lfw.mt.mark = 'dmg_startup_bg';
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

    this.lfw.mt.mark = 'demo_startup_cam_x'
    let cam_x = is_stage_mode ? 0 : this.lfw.mt.range(left, right - Defines.MODERN_SCREEN_WIDTH)
    const min_x = is_stage_mode ? (cam_x + 40) : (cam_x + 1 * Defines.MODERN_SCREEN_WIDTH / 3)
    const max_x = is_stage_mode ? (80) : (cam_x + 2 * Defines.MODERN_SCREEN_WIDTH / 3)

    const situation = DemoModeLogic.get_situation(this.lfw);
    this.props.situation_name?.set_text(situation.title)
    const { teams, oids } = situation

    const len = max(teams?.length ?? 0, oids?.length ?? 0)
    const fighters: Entity[] = []
    for (let i = 0; i < len; i++) {
      const team = teams?.[i];
      const oid = oids?.[i]
      let fighter_data: IEntityData | undefined
      if (oid) {
        fighter_data = this.lfw.datas.find(oid);
      } else {
        this.lfw.mt.mark = `demo_startup_fighter_${i}`
        fighter_data = this.lfw.mt.take(fighters_datas);
      }
      if (!fighter_data) continue;

      const fighter = this.lfw.factory.create_entity(this.world, fighter_data);
      if (!fighter) continue;
      fighter.team = team ?? this.lfw.new_team;
      this.lfw.mt.mark = 'demo_startup_fighter_facing'
      fighter.facing = is_stage_mode ?
        FacingFlag.Right :
        this.lfw.mt.pick([FacingFlag.Left, FacingFlag.Right])!;

      fighter.key_role = true;
      fighter.name_visible = true;
      fighter.stat_bar_type = StatBarType.UI;

      const player = this.lfw.player('' + i)
      fighter.ctrl = this.lfw.factory.create_ctrl(fighter_data.id, player.id, fighter);

      this.lfw.mt.mark = 'demo_startup_fighter_x'
      const x = this.lfw.mt.range(min_x, max_x)
      this.lfw.mt.mark = 'demo_startup_fighter_z'
      const z = this.lfw.mt.range(far, near);
      fighter.set_position(x, void 0, z)
      fighter.blinking = this.world.dataset.begin_blink_time;
      if (is_vs_mode) fighter.mp = (fighter.mp_max * 2 / 5)
      fighter.attach();
      fighters.push(fighter)
    }

    const stat_bars = this.node.search_components(FighterStatBar)
    for (let i = 0; i < stat_bars.length; i++) {
      const stat_bar = stat_bars[i];
      const fighter = fighters[i]
      stat_bar.node.visible = !!fighter;
      stat_bar.node.disabled = !fighter;
      stat_bar.set_entity(fighter)
      if (fighter) continue;
      stat_bars.splice(i, 1);
      --i;
    }

    if (is_stage_mode && stage) {
      this.lfw.change_stage(stage.id ?? "");
      this.lfw.world.stage.callbacks.add(this.stage_callbacks);
    }
    this.lfw.world.callbacks.add(this.world_callbacks);
    const { cam_ctrl } = this.props;
    if (cam_ctrl) cam_ctrl.staring = fighters[0];
    this.world.camera.jump_x(cam_x);

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
  protected world_callbacks: IWorldCallbacks = {
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

    this.lfw.mt.mark = 'demo_update_weapon_rain';
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
        this.props.focus_on?.set_visible(false)
      }
      const txt = staring ? `[${staring.team}] ${staring.name}` : '-'
      this.props.focus_prefix?.set_text("curr_focus")
      this.props.focus_on?.set_visible(true)
      this.props.focus_on?.set_text(txt)

    } while (0)
    if (this.is_stage_mode) {
      if (this.props.jalousie && !this.props.jalousie.open && this.props.jalousie.anim.done) {
        this.lfw.goto_next_stage()
        this.fsm.use(ModeState.Running)
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
