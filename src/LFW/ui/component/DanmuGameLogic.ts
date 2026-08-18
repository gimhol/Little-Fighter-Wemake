import { CMD } from "../../defines/CMD";
import { StatBarType } from "../../entity/StatBarType";
import { FrameId, OID as OID, Defines } from "../../defines";
import { TeamEnum as TE } from "../../defines/TeamEnum";
import { Entity } from "../../entity/Entity";
import { Times } from "../../utils/Times";
import { CameraCtrl } from "./CameraCtrl";
import { SummaryLogic } from "./SummaryLogic";

export class DanmuGameLogic extends SummaryLogic {
  static override readonly TAGS: string[] = ["DanmuGameLogic"];
  static readonly BROADCAST_ON_START = 'DanmuGameLogic_ON_START';
  static readonly BROADCAST_ON_STOP = 'DanmuGameLogic_ON_STOP';

  private _staring_countdown = new Times(0, 60 * 30);
  private _gameover_countdown = new Times(0, 60 * 5);
  private _teams = new Set<string>();
  private _cam_ctrl?: CameraCtrl

  time: number = 0;
  update_teams() {
    const fighters = this.lfw.fighters.all;
    this._teams.clear()
    for (const fighter of fighters)
      this._teams.add(fighter.team);
  }
  override on_fighter_add(e: Entity) {
    super.on_fighter_add(e);
    this.update_teams()
  }
  override on_fighter_del(e: Entity) {
    super.on_fighter_del(e);
    this.update_teams()
    if (!this._cam_ctrl || this._cam_ctrl?.staring !== e) return
    // 聚焦角色被移除后，聚焦下一个角色
    this._staring_countdown.reset();
    this._cam_ctrl.staring = this.lfw.mt.pick(this.lfw.fighters.all)
  }
  override on_start(): void {
    super.on_start?.();
    this.update_bg();
    this.lfw.sounds.play_bgm('?')
    this.lfw.on_component_broadcast(this, DanmuGameLogic.BROADCAST_ON_START)
    this._cam_ctrl = this.node.find_component(CameraCtrl)
  }
  override on_stop(): void {
    super.on_stop?.();
    this.lfw.on_component_broadcast(this, DanmuGameLogic.BROADCAST_ON_STOP);
    this.world.clear()
  }

  update_bg() {
    for (const e of this.world.entities)
      e.enter_frame(Defines.NEXT_FRAME_GONE)
    const fighter_enter = (v: Entity) => {
      v.stat_bar_type = StatBarType.Float;
      v.key_role = true;
      v.dead_gone = true;
      v.name_visible = true;
      v.blinking = 120;
    }
    const way: number = this.lfw.mt.range(0, 6);
    switch (way) {
      case 0: {
        this.lfw.change_bg('?');
        this.lfw.fighters.add(OID.Julian, 2, TE.Team_1).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Jan, 1, TE.Team_1).forEach(fighter_enter)

        this.lfw.fighters.add(OID.Firzen, 3, TE.Team_2).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Jan, 1, TE.Team_2).forEach(fighter_enter)

        this.lfw.fighters.add(OID.LouisEX, 2, TE.Team_3).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Bat, 3, TE.Team_3).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Jan, 1, TE.Team_3).forEach(fighter_enter)

        this.lfw.fighters.add(OID.Deep, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Davis, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Dennis, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Woody, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Firen, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Freeze, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Jack, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Jan, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Mark, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Monk, 1, TE.Team_4).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Knight, 1, TE.Team_4).forEach(fighter_enter)
        break
      }
      case 1: { // 1v1v1v1v1v1
        this.lfw.change_bg('?');
        this.lfw.fighters.add(OID.Deep, 1, '').forEach(fighter_enter)
        this.lfw.fighters.add(OID.Davis, 1, '').forEach(fighter_enter)
        this.lfw.fighters.add(OID.Dennis, 1, '').forEach(fighter_enter)
        this.lfw.fighters.add(OID.Woody, 1, '').forEach(fighter_enter)
        this.lfw.fighters.add(OID.Firen, 1, '').forEach(fighter_enter)
        this.lfw.fighters.add(OID.Freeze, 1, '').forEach(fighter_enter)
        this.lfw.fighters.add(OID.Jack, 1, '').forEach(fighter_enter)
        this.lfw.fighters.add(OID.Louis, 1, '').forEach(fighter_enter)
        break;
      }
      case 2: { // mark vs monk
        this.lfw.change_bg('?');
        this.lfw.fighters.add(OID.Monk, 8, TE.Team_1).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Jan, 2, TE.Team_1).forEach(fighter_enter)

        this.lfw.fighters.add(OID.Mark, 8, TE.Team_2).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Jan, 2, TE.Team_2).forEach(fighter_enter)
        break;
      }
      case 3: {  // Justin vs Julian
        this.lfw.change_bg('?');
        this.lfw.fighters.add(OID.Justin, 4, TE.Team_1).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Justin, 4, TE.Team_2).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Justin, 4, TE.Team_3).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Julian, 1, TE.Team_4).forEach(fighter_enter)
        break;
      }
      case 4: {
        this.lfw.change_bg('?');
        this.lfw.fighters.add(OID.Henry, 4, TE.Team_1).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Hunter, 4, TE.Team_2).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Rudolf, 4, TE.Team_3).forEach(fighter_enter)
        this.lfw.fighters.add(OID.John, 4, TE.Team_4).forEach(fighter_enter)
        break;
      }
      case 5: {
        this.lfw.change_bg('?');
        this.lfw.fighters.add(OID.John, 4, TE.Team_1).forEach(fighter_enter)
        this.lfw.fighters.add(OID.Sorcerer, 6, TE.Team_2).forEach(fighter_enter)
        break;
      }
    }

    this.update_staring();
    this._staring_countdown.reset()

    const staring = this._cam_ctrl?.staring;
    if (staring && this._cam_ctrl?.auto != false) {
      const { left, right } = this.world.stage;
      let cam_x = staring.position.x - this.world.dataset.screen_w / 2
      const max_cam_left = left;
      const max_cam_right = right;
      if (cam_x < max_cam_left) cam_x = max_cam_left;
      if (cam_x > max_cam_right - this.world.dataset.screen_w) cam_x = max_cam_right - this.world.dataset.screen_w;
      this.lfw.push_cmd(CMD.DIST_CAM, `${cam_x}`)
      this.world.camera.jump_x(cam_x);
    }
  }
  update_staring() {
    if (!this._cam_ctrl) return;
    const fighters = this.lfw.fighters.all;
    this._cam_ctrl.staring = this.lfw.mt.pick(fighters)
  }
  override update(dt: number): void {
    this.time += dt;
    super.update?.(dt)
    this._staring_countdown.add();
    if (this._staring_countdown.is_max) this.update_staring()

    const staring = this._cam_ctrl?.staring;
    if (staring && this._cam_ctrl?.auto != false) {
      this.lfw.push_cmd(CMD.DIST_CAM, `${staring.position.x - this.world.dataset.screen_w / 2}`)
    }
    else if (!staring)
      this.update_staring()

    if (this._teams.size <= 1) {
      if (this._gameover_countdown.is_max) {
        if (this._teams.size) {
          for (const [k, v] of this.teams) {
            if (this._teams.has(k)) v.wins += 1
          }
        }
        this._gameover_countdown.reset()
        this.update_bg()
      } else {
        this._gameover_countdown.add()
      }
    } else {
      this._gameover_countdown.reset()
    }

  }

}

