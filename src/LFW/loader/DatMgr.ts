import { Factory } from "../Factory";
import { LFW } from "../LFW";
import { BotController } from "../bot/BotController";
import { BallController } from "../controller/BallController";
import { xml_to_data_lists } from "../dat_translator/xml/xml_to_data_lists";
import { xml_to_stage_info_list } from "../dat_translator/xml/xml_x_stage_info";
import { xml_2_bg_data, xml_x_bg_data } from "../dat_translator/xml/xml_x_bg_data";
import { xml_2_entity_data } from "../dat_translator/xml/xml_x_entity_data";
import { type IBgData, type IBotData, type IDataLists, type IEntityData, type IStageInfo } from "../defines";
import { EntityEnum } from "../defines/EntityEnum";
import { Defines } from "../defines/defines";
import { Ditto } from "../ditto";
import {
  is_ball_data,
  is_bg_data,
  is_fighter_data,
  is_weapon_data,
} from "../entity/type_check";
import { Randoming } from "../helper/Randoming";
import { is_non_blank_str, is_str } from "../utils/type_check";
import type { IEntityDataContext } from "./IEntityDataContext";
import { check_stage_info } from "./check_stage_info";
import { preprocess_bg_data } from "./preprocess_bg_data";
import { preprocess_bot_data } from "./preprocess_bot_data";
import { preprocess_entity_data } from "./preprocess_entity_data";
import { preprocess_stage } from "./preprocess_stage";

type Data = IEntityData | IBgData;

export interface IDataListMap {
  background: IBgData[];
  [EntityEnum.Entity]: IEntityData[];
  [EntityEnum.Fighter]: IEntityData[];
  [EntityEnum.Weapon]: IEntityData[];
  [EntityEnum.Ball]: IEntityData[]
}

const create_data_list_map = (): IDataListMap => ({
  background: [Defines.VOID_BG],
  [EntityEnum.Entity]: [],
  [EntityEnum.Fighter]: [],
  [EntityEnum.Weapon]: [],
  [EntityEnum.Ball]: []
});

class Inner {
  readonly mgr: DatMgr;
  readonly id: number;
  readonly lfw: LFW;
  get cancelled(): boolean {
    return this.mgr.inner_id !== this.id;
  }
  datas = create_data_list_map();
  data_map = new Map<string, IEntityData>();
  alias_map = new Map<string, IEntityData>();
  stages: IStageInfo[] = [Defines.VOID_STAGE];
  bot_map = new Map<string, IBotData>();
  randomings = new Map<string, Randoming<IEntityData>>();
  bg_randomings = new Map<string, Randoming<IBgData>>();

  constructor(mgr: DatMgr, id: number) {
    this.id = id;
    this.mgr = mgr;
    this.lfw = mgr.lfw;
  }

  private async _cook_data(data: Data): Promise<Data> {
    const jobs: Promise<any>[] = [];
    if (is_bg_data(data)) {
      return preprocess_bg_data(this.lfw, data, jobs);
    }
    // data 收窄为 IEntityData
    if (is_ball_data(data))
      Factory.register_ctrl(data.id, (a, b) => new BallController(a, b));
    else if (is_weapon_data(data))
      Factory.register_ctrl(data.id, (a, b) => new BallController(a, b));
    else if (is_fighter_data(data))
      Factory.register_ctrl(data.id, (a, b) => new BotController(a, b));
    data.base.bot = data.base.bot ?? this.bot_map.get(data.id ?? data.base.bot_id);
    const ctx: IEntityDataContext = { lfw: this.lfw, data, jobs, errors: [] };
    return preprocess_entity_data(ctx).then(r => r as IEntityData);
  }
  private _add_alias(alias: string, data: IEntityData) {
    const prev = this.alias_map.get(alias)
    if (prev) {
      Ditto.warn(
        DatMgr.TAG + "::_add_obj",
        "alias duplicated, old data will be overwritten!",
        "old data:", prev,
        "new data:", data,
      );
    }
    this.alias_map.set(alias, data);
  }
  private _add_obj(id: string, data: IEntityData) {
    const prev = this.data_map.get(id)
    if (prev) {
      Ditto.warn(
        DatMgr.TAG + "::_add_obj",
        "id duplicated, old data will be overwritten!",
        "old data:", prev,
        "new data:", data,
      );
    }
    this.data_map.set(id, data);
    const list = this.datas[data.type]
    const idx = list.findIndex(v => v.id === data.id)
    if (idx < 0) list.push(data); else list[idx] = data;

    {
      const list = this.datas[EntityEnum.Entity]
      const idx = list.findIndex(v => v.id === data.id)
      if (idx < 0) list.push(data); else list[idx] = data;
    }
  }

  private _add_bg(data: IBgData) {
    const list = this.datas[data.type];
    const idx = list.findIndex(v => v.id === data.id);
    if (idx < 0) list.push(data); else list[idx] = data;
    data.base.group?.forEach(v => this.bg_randomings.delete(v));

    Object.defineProperty(data, 'xml', {
      configurable: true,
      get: function () { return xml_x_bg_data(Ditto.XML, this) }
    })
    Object.defineProperty(data, 'xml_roundtrip', {
      configurable: true,
      get: function () { return xml_2_bg_data(this.xml) }
    })
    Object.defineProperty(data, 'xml_roundtrip_ok', {
      configurable: true,
      get: function () {
        return JSON.stringify(this.xml_roundtrip) === JSON.stringify(this)
      }
    })
  }

  async load(index_files: string[]) {
    for (const k of Object.keys(Defines.BuiltIn_Imgs)) {
      const src = (Defines.BuiltIn_Imgs as any)[k];
      if (!is_non_blank_str(src)) continue;
      this.lfw.emit_progress(`${src}`, 0);
      await this.lfw.images.load_img(src, src);
    }
    for (const k of Object.keys(Defines.BuiltIn_Dats)) {
      const src = (Defines.BuiltIn_Dats as any)[k];
      if (!is_non_blank_str(src)) continue;
      this.lfw.emit_progress(`${src}`, 0);
      const raw = await this.lfw.import_json<IEntityData>(src).then(r => r[0])
      const cooked = await this._cook_data(raw) as IEntityData;
      this._add_obj(src, cooked);
    }
    const data: IDataLists = { objects: [], backgrounds: [], stages: [], bots: [] }
    for (const file of index_files) {
      const partial: Partial<IDataLists> = file.endsWith(".xml")
        ? xml_to_data_lists((await this.lfw.import_xml(file, true))[0])
        : await this.lfw.import_json<Partial<IDataLists>>(file, true)
          .then(r => r[0]).catch(e => { Ditto.warn(`FAIL TO LOAD DAT INDEX ${file}, ` + e); return {} as Partial<IDataLists> });
      const { objects = [], backgrounds = [], stages = [], bots = [] } = partial;
      data.objects.push(...objects)
      data.backgrounds.push(...backgrounds)
      data.stages.push(...stages)
      data.bots.push(...bots)
    }

    if (this.cancelled) throw new Error("cancelled");
    for (const { id, file, skipped } of data.bots) {
      if (skipped) continue;
      this.lfw.emit_progress(`${file}`, 0);
      const raw = await this.lfw.import_json<IBotData>(file, true)
        .then(r => {
          return r[0]
        }).catch(e => {
          Ditto.warn(`FAILED TO LOAD BOT DATA: ${file}`);
          return undefined
        });
      if (this.cancelled) throw new Error("cancelled");

      if (!raw) continue;
      const bot_data = preprocess_bot_data(raw);
      this.bot_map.set(id, bot_data);
      if (id != file) this.bot_map.set(file, bot_data);
      if (id != bot_data.id) this.bot_map.set(bot_data.id, bot_data);
    }

    for (const { id, file, alias, skipped } of data.objects) {
      if (skipped) continue;
      if (this.cancelled) throw new Error("cancelled");
      try {
        this.lfw.emit_progress(`${file}`, 0);
        const raw = file.endsWith(".obj.xml") || file.endsWith(".xml")
          ? xml_2_entity_data((await this.lfw.import_xml(file, true))[0])
          : await this.lfw.import_json<IEntityData>(file, true).then(r => r[0]);
        const cooked = await this._cook_data(raw) as IEntityData;
        this._add_obj(id, cooked);
        if (id != file) this._add_obj(file, cooked);
        if (id != cooked.id) this._add_obj(cooked.id, cooked);
        if (alias) this._add_alias(alias, cooked)
      } catch (e) {
        throw new Error(`fail to load obj: ${file}, reason: ${e}`)
      }
    }
    for (const { id, file, skipped } of data.backgrounds) {
      if (skipped) continue;
      if (this.cancelled) throw new Error("cancelled");
      try {
        this.lfw.emit_progress(`${file}`, 0);
        const raw = file.endsWith(".bg.xml")
          ? xml_2_bg_data((await this.lfw.import_xml(file, true))[0])
          : await this.lfw.import_json(file, true).then(r => r[0]);
        const cooked = await this._cook_data(raw) as IBgData;
        this._add_bg(cooked)
      } catch (e) {
        throw new Error(`fail to load bg: ${file}, reason: ${e}`)
      }
    }
    const stages: IStageInfo[] = []
    for (const stage_file of data.stages) {
      if (stage_file.skipped) continue;
      this.lfw.emit_progress(`${stage_file.file}`, 0);
      const stage_datas = stage_file.file.endsWith(".xml") || stage_file.file.endsWith(".stage.xml")
        ? xml_to_stage_info_list((await this.lfw.import_xml(stage_file.file, true))[0])
        : await this.lfw.import_json<IStageInfo[]>(stage_file.file, true)
          .then(r => r[0])
          .catch(e => { Ditto.warn(`FAILED TO LOAD STATE: ${stage_file.file}`); return [] as IStageInfo[] });
      this.lfw.emit_progress(`${stage_file.file}`, 100);
      for (const stage of stage_datas) {
        stages.push(preprocess_stage(stage))
      }
    }

    if (!this.stages.length)
      this.stages.unshift(Defines.VOID_STAGE)
    for (const stage of stages) {
      const idx = this.stages.findIndex(v => v.id === stage.id);
      check_stage_info(stage)
      if (idx < 0) this.stages.push(stage);
      this.stages[idx] = stage;
    }
  }
}

export class DatMgr {
  static readonly TAG: string = "DatMgr";
  readonly lfw: LFW;
  private _inner_id: number = 0;
  private _inner: Inner;

  get inner_id(): number {
    return this._inner_id;
  }

  constructor(lfw: LFW) {
    this.lfw = lfw;
    this._inner = new Inner(this, ++this._inner_id);
  }


  find_group(group: string) {
    const f = (v: IEntityData) => v.base.group?.some(g => g === group)
    return {
      characters: this.fighters.filter(f),
      weapons: this.weapons.filter(f),
      entity: this.entity.filter(f),
      balls: this.balls.filter(f),
    };
  }

  load(index_files: string[]): Promise<void> {
    return this._inner.load(index_files);
  }

  dispose(): void {
    ++this._inner_id;
  }

  clear(): void {
    this._inner = new Inner(this, ++this._inner_id);
  }

  get fighters() {
    return this._inner.datas[EntityEnum.Fighter];
  }
  get weapons() {
    return this._inner.datas[EntityEnum.Weapon];
  }
  get backgrounds() {
    return this._inner.datas.background;
  }
  get balls() {
    return this._inner.datas[EntityEnum.Ball];
  }
  get entity() {
    return this._inner.datas[EntityEnum.Entity];
  }
  get stages(): IStageInfo[] {
    return this._inner.stages;
  }

  find(id: string): IEntityData | undefined {
    return this._inner.alias_map.get(id) ?? this._inner.data_map.get(id);
  }
  find_bot(id: string): IBotData | undefined {
    return this._inner.bot_map.get(id)
  }
  get_randoming_by_group(group: string) {
    let ret = this._inner.randomings.get(group);
    if (ret) return ret
    const { entity } = this.find_group(group);
    this._inner.randomings.set(
      group,
      ret = new Randoming(entity, this.lfw.mt)
    );
    return ret
  }

  find_weapon(id: string): IEntityData | undefined;
  find_weapon(predicate: IFindPredicate<IEntityData>): IEntityData | undefined;
  find_weapon(
    arg_0: string | IFindPredicate<IEntityData>,
  ): IEntityData | undefined {
    return is_str(arg_0)
      ? this.weapons.find((v) => v.id === arg_0)
      : this.weapons.find(arg_0);
  }

  find_entity(id: string): IEntityData | undefined;
  find_entity(predicate: IFindPredicate<IEntityData>): IEntityData | undefined;
  find_entity(
    arg_0: string | IFindPredicate<IEntityData>,
  ): IEntityData | undefined {
    return is_str(arg_0)
      ? this.entity.find((v) => v.id === arg_0)
      : this.entity.find(arg_0);
  }

  find_fighter(id: string): IEntityData | undefined;
  find_fighter(
    predicate: IFindPredicate<IEntityData>,
  ): IEntityData | undefined;
  find_fighter(
    arg_0: string | IFindPredicate<IEntityData>,
  ): IEntityData | undefined {
    return is_str(arg_0)
      ? this.fighters.find((v) => v.id === arg_0)
      : this.fighters.find(arg_0);
  }

  find_background(id: string): IBgData | undefined;
  find_background(predicate: IFindPredicate<IBgData>): IBgData | undefined;
  find_background(
    arg_0: string | IFindPredicate<IBgData>,
  ): IBgData | undefined {
    return is_str(arg_0)
      ? this.backgrounds.find((v) => v.id === arg_0)
      : this.backgrounds.find(arg_0);
  }

  get_fighters_of_group(group: string): IEntityData[] {
    return this.fighters.filter(
      (v) => v.base.group && v.base.group.indexOf(group) >= 0,
    );
  }
  get_weapons_of_group(group: string): IEntityData[] {
    return this.weapons.filter(
      (v) => v.base.group && v.base.group.indexOf(group) >= 0,
    );
  }
  get_fighters_not_in_group(group: string): IEntityData[] {
    return this.fighters.filter(
      (v) => !v.base.group || v.base.group.indexOf(group) < 0,
    );
  }

  get_backgrouds_of_group(group: string): IBgData[] {
    return this.backgrounds.filter(a => a.base.group?.some(b => b === group));
  }

  get_bg_randoming_of_group(groups: string[]) {
    const key = groups.join()
    let ret = this._inner.bg_randomings.get(key);
    if (ret) return ret;
    const bg_set = new Set<IBgData>();
    for (const group of groups) {
      for (const bg of this.get_backgrouds_of_group(group)) {
        bg_set.add(bg)
      }
    }
    this._inner.bg_randomings.set(key, ret = new Randoming(Array.from(bg_set), this.lfw.mt));
    return ret
  }
  /** @deprecated 我突然觉得这玩意不该由DatMgr负责... */
  get_random_bg(groups: string[]) {
    return this.get_bg_randoming_of_group(groups).get();
  }
}
interface IFindPredicate<T> {
  (value: T, index: number, obj: T[]): unknown;
}

