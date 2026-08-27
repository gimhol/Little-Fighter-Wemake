import { ActionDirector } from './Tests/ActionDirector';
import { EntityGroup } from '../../defines/EntityGroup';
import { CMD, type IEntityData } from "../../defines";
import { Entity, type IEntityCallbacks } from "../../entity";
import { StatBarType } from "../../entity/StatBarType";
import { UIComponent } from "./UIComponent";

interface ITeamInfo {
  boss?: Entity;
  soldiers: Entity[];
}
export class LittleFunnyAutoGame extends UIComponent {
  static override TAGS: string[] = ["LittleFunnyAutoGame"];
  private _datas: IEntityData[] = [];
  private _lr: number = 0 | 1;
  private _ox: number = 0 | 1;
  private _teams: {
    ['1']: ITeamInfo,
    ['2']: ITeamInfo,
  } = {
      1: { soldiers: [] },
      2: { soldiers: [] }
    }

  private _fighter_cbs: IEntityCallbacks = {
    on_dead: (e) => {
      e.callbacks.del(this._fighter_cbs);
      if (this.stopped || this.paused) return;
      const lr = this._lr = (this._lr + 1) % 2;
      const team = e.team
      if (team == '1' || team == '2') {
        if (this._teams[team].boss == e) {
          const fighter = this.add_random_fighter(lr, team);
          if (!fighter) return;
          this._teams[team].boss = fighter;
        } else if (this._teams[team].soldiers.includes(e)) {
          this._teams[team].soldiers = this._teams[team].soldiers.filter(v => v != e);
        }
        this._handle_soldiers();
      } else {
        // 不必管
      }
    }
  }
  private _handle_soldiers = () => {
    /*
    简单的来说就是让敌方士兵数量与我方BOSS的强度匹配
    */
    const boss1 = this._teams[1].boss;
    const boss2 = this._teams[2].boss;
    if (!boss1 || !boss2) return;
    const ce1 = (boss1?.data.base.ce ?? 1) - 1;
    const ce2 = (boss2?.data.base.ce ?? 1) - 1;
    const _3000 = this.lfw.datas.get_fighters_of_group(EntityGroup._3000);
    const freeguys: Entity[] = []
    while (this._teams[1].soldiers.length > ce2) {
      const freeguy = this._teams[1].soldiers.pop();
      if (!freeguy) break;
      freeguys.push(freeguy)
    }
    while (this._teams[2].soldiers.length > ce1) {
      const freeguy = this._teams[2].soldiers.pop();
      if (!freeguy) break;
      freeguys.push(freeguy)
    }
    while (this._teams[1].soldiers.length < ce2) {
      this.lfw.mt.mark = 'lfag_3000_1';
      const newguy = freeguys.pop() ?? this.add_random_fighter(
        this._lr = (this._lr + 1) % 2, '1', this.lfw.mt.pick(_3000)
      )
      if (!newguy) break;
      if (newguy.team !== '1') {
        this.world.etc(newguy.position.x, newguy.position.y, newguy.position.z, '6')
        newguy.team = '1'
      }
      this._teams[1].soldiers.push(newguy)
    }
    while (this._teams[2].soldiers.length < ce1) {
      this.lfw.mt.mark = 'lfag_3000_2';
      const newguy = freeguys.pop() ?? this.add_random_fighter(
        this._lr = (this._lr + 1) % 2, '2', this.lfw.mt.pick(_3000)
      )
      if (!newguy) break;
      if (newguy.team !== '2') {
        this.world.etc(newguy.position.x, newguy.position.y, newguy.position.z, '6')
        newguy.team = '2'
      }
      this._teams[2].soldiers.push(newguy)
    }
    for (const guy of freeguys) {
      guy.team = '3';
    }
  }
  private _director = new ActionDirector().offset(5000, () => {
    this._teams[1].boss = this.add_random_fighter(0, '1')
    this._teams[2].boss = this.add_random_fighter(1, '2')
    this._handle_soldiers();
  })
  override update(dt: number): void {
    this._director.update(dt);
  }
  override on_resume(): void {
    super.on_resume?.()
    this._lr = 0;
    this._teams[1].boss = void 0;
    this._teams[1].soldiers.length = 0
    this._teams[2].boss = void 0;
    this._teams[2].soldiers.length = 0
    this.world.paused = false;
    this.lfw.change_bg('')
    this.lfw.push_cmd(CMD.LOCK_CAM, '0')
    this._director.reset();
  }
  override on_pause(): void {
    super.on_pause?.();
    this.world.clear();
    this._teams[1].boss = void 0;
    this._teams[1].soldiers.length = 0
    this._teams[2].boss = void 0;
    this._teams[2].soldiers.length = 0
    this.lfw.push_cmd(CMD.LOCK_CAM)
  }
  add_random_fighter(lr: number, team: '1' | '2', data?: IEntityData) {
    if (!data) {
      if (!this._datas.length)
        this._datas.push(...this.lfw.datas.fighters)
      this.lfw.mt.mark = 'lfag_random_fighter';
      data = this.lfw.mt.take(this._datas)
    }
    if (!data) return;
    const fighter = this.lfw.factory.create_entity(this.world, data)
    if (!fighter) return;
    fighter.ctrl = this.lfw.factory.create_ctrl(data.id, '', fighter);
    fighter.team = team;
    const facing = fighter.facing = lr ? -1 : 1;
    const x = (this._ox = (this._ox + 1) % 2) * -facing
    fighter.callbacks.add(this._fighter_cbs)
    fighter.set_position_x(lr * this.world.bg.width + x)
    fighter.hp = fighter.hp_r = fighter.hp_max = 150 * (data.base.ce ?? 1);
    fighter.stat_bar_type = StatBarType.None;
    fighter.wakeup_invuln = true;
    fighter.blinking = 64
    fighter.dead_gone = true;
    fighter.name_visible = false;
    fighter.enter_frame_by_id("running_0")
    fighter.attach()
    fighter.greyscale = 0.3;
    fighter.mix_color = '#364791';
    fighter.mix_strength = 0.3;
    fighter.outline_width = 1;
    fighter.outline_alpha = 1;
    fighter.outline_color = '#131C47';
    return fighter;
  }
}