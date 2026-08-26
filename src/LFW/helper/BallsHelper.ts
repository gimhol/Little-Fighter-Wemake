
import { Entity } from "../entity/Entity";
import { is_ball } from "../entity/type_check";
import { ObjectsHelper } from "./EntitiesHelper";

export class BallsHelper extends ObjectsHelper {

  /**
   * 列出场地上类型为Ball的实体
   *
   * @return {Entity[]}
   * @memberof BallsHelper
   */
  override get all(): Entity[] {
    const ret: Entity[] = [];
    this.lfw.world.entities.forEach((v) => is_ball(v) && ret.push(v));
    return ret;
  }
}
