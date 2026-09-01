import { EntityEnum, ItrKind, SpeedMode, StateEnum } from "../defines";
import { calc_v, summary_mgr } from "../entity";
import { Entity } from "../entity/Entity";
import { Buff } from "./Buff";

export class Buff_MagicFlute extends Buff {
  static override  readonly KIND: string | number = ItrKind.MagicFlute;
  injury = 1;
  injury_r = 0.5;
  override init(): void {
    this.ticks = 3;
    this.duration = 2;
  }
  override on_tick(attacker?: Entity, victim?: Entity): "keep" | "del" {
    if (!victim) return 'del';
    const prev_hp = victim.hp;
    victim.hp_r -= this.injury_r;
    victim.hp -= this.injury;
    victim.fallinjury = 20;
    victim.toughness = 0;
    if (attacker) summary_mgr.apply_damage(attacker, this.injury, victim, prev_hp);
    return 'keep'
  }
  override on_update(attacker?: Entity, victim?: Entity): "keep" | "del" {
    if (!victim) return 'del';
    const vy = calc_v(victim.velocity.y, 3, SpeedMode.AccTo, 3, 1)
    victim.set_velocity(null, vy)
    victim.handle_velocity_decay(0.25);
    switch (victim.data.type) {
      case EntityEnum.Fighter:
        if (victim.state !== StateEnum.Falling) {
          victim.enter_frame_by_id(victim.data.indexes?.falling?.[-1][0])
        }
        break;
      case EntityEnum.Weapon:
        switch (victim.state) {
          case StateEnum.Weapon_InTheSky:
          case StateEnum.HeavyWeapon_InTheSky:
            break;
          default:
            if (attacker) victim.team = attacker.team;
            victim.enter_frame_by_id(victim.data.indexes?.in_the_skys?.[0]);
            break;
        }
    }
    return 'keep'
  }
}


