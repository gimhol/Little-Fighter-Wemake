import { Defines, Difficulty, type IEntityData, type IStageObjectInfo, type IStagePhaseInfo } from "../defines";
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
  readonly phase: IStagePhaseInfo;
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

  constructor(stage: Stage, phase: IStagePhaseInfo, info: IStageObjectInfo) {
    this.stage = stage;
    this.phase = phase;
    this.info = info;
    this.lfw = stage.lfw;
    this.world = stage.world;

    this.times = info.times ? round(info.times) : void 0;

    const data_list: IEntityData[] = [];
    const randoming_list: Randoming<IEntityData>[] = [];
    let ids: string[] = []
    const id = this.info.id;
    if (typeof id === 'string') ids = [id];
    else if (Array.isArray(id)) ids = id;

    do {
      if (!ids.length) break;
      for (const oid of ids) {
        const data = this.lfw.datas.find(oid);
        this._is_fighter ||= is_fighter_data(data);
        if (data) data_list.push(data);
        if (data) continue;
        const rd = this.lfw.datas.get_randoming_by_group(oid);
        if (!rd.src.length) continue;
        this._is_fighter ||= rd.src.some(is_fighter_data);
        randoming_list.push(rd);
      }
      if (data_list.length === 1 && !randoming_list.length) {
        this.data = data_list[0];
        break;
      }
      if (!data_list.length) break;
      const randoming = new Randoming(`stage_item_oid_randoming`, data_list, this.lfw.mt)
      randoming_list.push(randoming);
    } while (0)

    if (randoming_list.length)
      this.randoming = new Randoming(`stage_item_oids_randoming`, randoming_list, this.lfw.mt);




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

  spawn(): boolean {
    const data = this.data || this.randoming?.get().get();
    if (!data) { debugger; return false; }
    const e = this.lfw.factory.create_entity(this.world, data);
    if (!e) { debugger; return false; }
    let {
      hp, act, facing, x, y, z, reserve, hp_map, mp, mp_map,
      outline_color,
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

    const { enemy_l = 0, enemy_r = 0 } = this.phase;
    const { range_x = 200, range_y = 0, range_z = 0 } = this.info;
    if (x == void 0) x = this.lfw.mt.float() < 0.5 ? enemy_l : enemy_r;


    const min_x = x
    const max_x = x + range_x
    const min_z = is_num(z) ? z : this.stage.far;
    const max_z = is_num(z) ? z + range_z : this.stage.near;
    const min_y = is_num(y) ? y : is_weapon(e) ? 300 : 0;
    const max_y = is_num(y) ? (y + range_y) : is_weapon(e) ? 300 : 0;
    const px = this.lfw.mt.range(min_x, max_x)
    const py = this.lfw.mt.range(min_y, max_y)
    const pz = this.lfw.mt.range(min_z, max_z)

    e.set_position(px, py, pz)
    if (this.info.join)
      e.dead_join = {
        hp: this.info.join,
        team: this.info.join_team ?? TeamEnum.Team_1,
        reserve: this.info.join_reserve
      }

    let _hp = hp_map?.[this.world.dataset.difficulty];

    if (!is_num(_hp) && is_num(hp)) {
      switch (this.world.dataset.difficulty) {
        case Difficulty.Easy: _hp = round(hp * 3 / 4); break;
        case Difficulty.Crazy: _hp = round(hp * 3 / 2); break;
        default: _hp = hp;
      }
    }
    if (is_num(_hp)) e.hp = e.hp_r = e.hp_max = _hp;


    mp ??= mp_map?.[this.world.dataset.difficulty]
    if (is_num(mp)) e.mp = e.mp_max = mp;

    if (is_fighter(e))
      e.name = e.data.base.name;

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
