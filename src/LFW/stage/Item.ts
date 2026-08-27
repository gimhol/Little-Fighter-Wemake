import { Defines, Difficulty, type IEntityData, type IStageObjectInfo } from "../defines";
import { TeamEnum } from "../defines/TeamEnum";
import type { Entity } from "../entity/Entity";
import type { IEntityCallbacks } from "../entity/IEntityCallbacks";
import { StatBarType } from "../entity/StatBarType";
import { is_fighter, is_fighter_data, is_weapon } from "../entity/type_check";
import { Randoming } from "../helper/Randoming";
import type { LFW } from "../LFW";
import { round, Times } from "../utils";
import { is_num, is_str } from "../utils/type_check";
import type { World } from "../World";
import type { Stage } from "./Stage";

export class Item {
  readonly lfw: LFW;
  readonly world: World;
  times: number | undefined;
  data?: IEntityData | undefined;
  randoming?: Randoming<Randoming<IEntityData>>;
  private _released: boolean = false;
  private _is_fighter: boolean = false;

  get released() { return this._released }
  get is_fighter() { return this._is_fighter }
  readonly info: Readonly<IStageObjectInfo>;
  readonly objects = new Set<Entity>();
  readonly stage: Stage;
  readonly end_delay = new Times(0, 120)
  readonly entity_callback: IEntityCallbacks = {
    on_team_changed: (e) => {
      this.objects.delete(e);
      e.callbacks.del(this.entity_callback);
    },
    on_dead: (e) => {
      this.objects.delete(e);
      e.callbacks.del(this.entity_callback);
    }
  };

  constructor(stage: Stage, info: IStageObjectInfo) {
    this.stage = stage;
    this.info = info;
    this.lfw = stage.lfw;
    this.world = stage.world;

    this.times = info.times ? round(info.times) : void 0;
    const data_list: IEntityData[] = [];
    const randoming_list: Randoming<IEntityData>[] = []
    if (this.info.id?.length) {
      for (const oid of this.info.id) {
        const data = this.lfw.datas.find(oid);
        if (data) {
          if (is_fighter_data(data))
            this._is_fighter = true;
          data_list.push(data);
          continue;
        }
        const randoming = this.lfw.datas.get_randoming_by_group(oid)
        if (randoming.src.some(data => is_fighter_data(data)))
          this._is_fighter = true;
        if (randoming.src.length) randoming_list.push(randoming);
      }
    }
    if (data_list.length === 1 && !randoming_list.length) {
      this.data = data_list[0]
    } else if (data_list.length && !randoming_list.length) {
      randoming_list.push(new Randoming(data_list, this.lfw.mt))
    } else if (!data_list.length && randoming_list.length) {
      this.randoming = new Randoming(randoming_list, this.lfw.mt)
    } else if (data_list.length && randoming_list.length) {
      randoming_list.push(new Randoming(data_list, this.lfw.mt))
      this.randoming = new Randoming(randoming_list, this.lfw.mt)
    } else {
      debugger;
    }
  }
  update() {
    if (this._released) return;

    if (this.objects.size > 0) {
      this.end_delay.reset()
      return;
    }
    if (!this.end_delay.add())
      return;
    const { times = -1 } = this
    if (this.info.is_soldier) {
      if (this.stage.all_boss_dead() || times == 0) {
        this.release();
        return
      }
      this.spawn();
    } else if (times >= 1) {
      this.spawn();
    } else {
      this.release();
    }
  }

  spawn(
    range_x: number = 100,
    range_y: number = 0,
    range_z: number = 0,
  ): boolean {
    const data = this.data || this.randoming?.get().get();
    if (!data) { debugger; return false; }
    const e = this.lfw.factory.create_entity(this.world, data);
    if (!e) { debugger; return false; }
    let {
      hp, act, facing, x = 0, y, z, reserve, hp_map, mp, mp_map,
      outline_color
    } = this.info;
    if (this.times) this.times--;
    e.outline_color = outline_color ?? ''
    if (is_fighter(e)) {
      e.outline_color = outline_color ?? '#FF0000'
      e.stat_bar_type = StatBarType.None;
      e.wakeup_invuln = false;
    }
    e.ctrl = this.lfw.factory.create_ctrl(e.data.id, "", e);
    e.dead_gone = true;
    e.reserve = reserve ?? 0;
    this.lfw.mt.mark = `stage_item_spawn`
    const px = this.lfw.mt.range(x, x + range_x)
    const pz = is_num(z)
      ? this.lfw.mt.range(z - range_z, z + range_z)
      : this.lfw.mt.range(this.stage.near, this.stage.far)
    e.set_position(px, null, pz)
    if (this.info.join)
      e.dead_join = {
        hp: this.info.join,
        team: this.info.join_team ?? TeamEnum.Team_1
      }

    let _hp = hp_map?.[this.world.dataset.difficulty]
    if (!is_num(_hp) && is_num(hp)) {
      switch (this.world.dataset.difficulty) {
        case Difficulty.Easy: _hp = round(hp * 3 / 4); break;
        case Difficulty.Crazy: _hp = round(hp * 3 / 2); break;
        default: _hp = hp;
      }
    }
    if (is_num(_hp)) e.hp = e.hp_r = e.hp_max = _hp;

    let _mp = mp_map?.[this.world.dataset.difficulty]
    if (is_num(mp) && !is_num(_mp)) _mp = mp;
    if (is_num(_mp)) e.mp = e.mp_max = _mp;

    if (is_num(y)) e.set_position_y(y);

    if (is_fighter(e)) {
      e.name = e.data.base.name;
    } else if (is_weapon(e) && !is_num(y)) {
      e.set_position_y(450);
    }
    e.team = this.stage.team;
    e.attach();
    if (facing == 1 || facing == -1) e.facing = facing;
    if (is_str(act)) e.enter_frame_by_id(act);
    else if (is_fighter(e)) e.enter_frame_by_id("running_0")
    else e.enter_frame(Defines.NEXT_FRAME_AUTO);

    e.callbacks.add(this.entity_callback);
    this.objects.add(e);
    return true;
  }

  release(): void {
    this._released = true;
  }
}
