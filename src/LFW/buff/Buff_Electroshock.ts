import { SE } from "../defines";
import type { Entity } from "../entity/Entity";
import { is_fighter } from "../entity/type_check";
import { round_float } from "../utils";
import { Buff } from "./Buff";

export class Buff_Electroshock extends Buff {
  static override readonly KIND = "Electroshock";
  override init() {
    this._ticker.max = 3;
  }
  override on_tick(_?: Entity, victim?: Entity): 'keep' | 'del' {
    if (!victim || !is_fighter(victim)) return 'del';
    if (
      victim.state === SE.Falling ||
      victim.state === SE.Injured ||
      victim.state === SE.Lying
    ) return 'keep'
    victim.wait += 1;
    return 'keep'
  }
  override apply(): void {
    for (const vid of this.victims) {
      const victim = this.world.find_entity(vid)
      if (!victim) continue;
      if (victim.state == SE.Injured) continue;
      if (victim.state == SE.Falling) continue;
      this.duration = round_float(this.duration / 2);
    }
  }
}
