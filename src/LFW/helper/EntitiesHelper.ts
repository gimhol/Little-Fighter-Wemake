import type { IEntityData } from "../defines";
import { TeamEnum } from "../defines/TeamEnum";
import { Entity } from "../entity/Entity";
import { LFW } from "../LFW";
import { Randoming } from "./Randoming";

export class ObjectsHelper {
  readonly lfw: LFW;
  readonly team_randoming: Randoming<TeamEnum>;

  constructor(lfw: LFW) {
    this.lfw = lfw;
    this.team_randoming = new Randoming([
      TeamEnum.Team_1,
      TeamEnum.Team_2,
      TeamEnum.Team_3,
      TeamEnum.Team_4,
    ], this.lfw.mt)
  }

  get all(): Entity[] {
    const ret: Entity[] = [];
    this.lfw.world.entities.forEach((v) => ret.push(v));
    return ret;
  }
  get a(): Entity | undefined { return this.at(0) }
  get b(): Entity | undefined { return this.at(1) }
  at(idx: number): Entity | undefined { return this.all[idx]; }

  add(data: IEntityData, num: number = 1, team?: string): Entity[] {
    const ret: Entity[] = [];
    while (--num >= 0) {
      const entity = this.lfw.factory.create_entity(this.lfw.world, data);
      if (!entity) continue;
      entity.ctrl = this.lfw.factory.create_ctrl(entity.data.id, "", entity)
      entity.team = team === '?' ? this.team_randoming.get() : (team || this.lfw.new_team)
      this.lfw.random_entity_info(entity)
      entity.attach();
      ret.push(entity);
    }
    return ret;
  }
  del_all() {
    this.lfw.world.del_entities(this.all);
  }
}
