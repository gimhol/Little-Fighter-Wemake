import { EntityGroup, type IEntityData, type IPropsMeta } from "../../defines";
import { Ditto } from "../../ditto/Instance";
import type { Entity } from "../../entity/Entity";
import { floor, max, pow, Times } from "../../utils";
import { UIComponent } from "./UIComponent";

const DEFAULT_CHANCE = 0.08;
const DEFAULT_INTERVAL = 1200;
const DEFAULT_POWER = 1.5;
const DEFAULT_LIMIT = 3;
const ROLL_SCALE = 20000;

export interface IWeaponRainProps {
  oids?: string;
  groups?: string;
  chance?: number;
  interval?: number;
  power?: number;
  limit?: number;
}
export class WeaponRain extends UIComponent<IWeaponRainProps> {
  static override readonly TAGS: string[] = ["WeaponRain"];
  static override readonly PROPS: IPropsMeta<IWeaponRainProps> = {
    oids: { type: String, nullable: true },
    groups: { type: String, nullable: true },
    chance: { type: Number, nullable: true },
    interval: { type: Number, nullable: true },
    power: { type: Number, nullable: true },
    limit: { type: Number, nullable: true },
  };
  protected timer = new Times(0, DEFAULT_INTERVAL);
  protected last_section?: number;
  protected _using_oids?: string;
  protected readonly _oid_datas: IEntityData[] = [];
  protected readonly _warned_oids = new Set<string>();
  override on_start(): void {
    super.on_start?.();
    const { interval } = this.props;
    if (interval != null) this.timer.set_range(0, interval);
  }
  override update(dt: number): void {
    if (this.world.paused) return;
    if (this.world.stage.weapon_rain_disabled) return;
    if (!this.timer.add(dt)) return;
    this.try_drop_weapon();
  }

  protected try_drop_weapon(): void {
    const { world } = this;
    const groups = this.map_groups() ?? this.props.groups ?? EntityGroup.VsWeapon;
    const chance = this.props.chance ?? DEFAULT_CHANCE;
    const power = this.props.power ?? DEFAULT_POWER;
    const { mt } = this.lfw;
    const limit = this.props.limit ?? DEFAULT_LIMIT;
    mt.mark = 'weapon_rain_range';
    const x = world.random_weapon_x(this.last_section);
    this.last_section = world.weapon_section_at(x);
    const count = world.weapon_count_at(x);
    mt.mark = 'weapon_rain_chance';
    const left = limit > 0 ? max(0, 1 - count / limit) : 0;
    const threshold = floor(chance * pow(left, power) * ROLL_SCALE);
    if (mt.range(0, ROLL_SCALE) >= threshold) return;
    const entity = this.drop_weapon(groups);
    if (!entity) return;
    entity.set_position(x);
  }

  protected drop_weapon(groups: string): Entity | undefined {
    const datas = this.resolve_oid_datas();
    if (datas.length) {
      const { mt, weapons } = this.lfw;
      mt.mark = 'weapon_rain_oids';
      return weapons.add(datas[mt.range(0, datas.length)], 1)[0];
    }
    return this.lfw.weapons.add_random(1, true, groups)[0];
  }

  protected map_oids(): string | undefined {
    const v = this.world.bg.data.dataset?.weapon_rain_oids;
    return v ? v : void 0;
  }
  protected map_groups(): string | undefined {
    const v = this.world.bg.data.dataset?.weapon_rain_groups;
    return v ? v : void 0;
  }
  protected resolve_oid_datas(): IEntityData[] {
    const oids = this.map_oids() ?? this.props.oids;
    if (this._using_oids === oids) return this._oid_datas;
    this._using_oids = oids;
    const { datas } = this.lfw;
    const ret = this._oid_datas;
    ret.length = 0;
    if (oids) {
      for (const raw of oids.split(',')) {
        const oid = raw.trim();
        if (!oid) continue;
        const data = datas.find_weapon(oid);
        if (data) {
          ret.push(data);
          continue;
        }
        if (!this._warned_oids.has(oid)) {
          this._warned_oids.add(oid);
          Ditto.warn(`[${WeaponRain.name}] oid not found: ${oid}`);
        }
      }
    }
    return ret;
  }
}
