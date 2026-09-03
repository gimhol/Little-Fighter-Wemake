import type { Collision } from "../collision/Collision";
import { StateEnum, WT } from "../defines";

export function handle_weapon_hit_other(collision: Collision): void {
  const { attacker } = collision;
  if (attacker.state === StateEnum.Weapon_OnHand) {
    return;
  }
  const is_base_ball =
    attacker.base_type === WT.Baseball ||
    attacker.base_type === WT.Drink;

  switch (attacker.state) {
    case StateEnum.Weapon_Throwing:
      // TODO: 这里是击中的反弹，如何更合适？ -Gim
      if (is_base_ball) {
        const vx = 0;
        const vy = 5;
        attacker.set_velocity(vx, vy, 0)
      } else {
        const vx = -0.3 * attacker.velocity.x;
        const vy = 0.3 * attacker.velocity.y;
        attacker.set_velocity(vx, vy, 0)
      }
      const nf = attacker.find_align_frame(
        attacker.frame.id,
        attacker.data.indexes?.throwings,
        attacker.data.indexes?.in_the_skys
      )
      const { arest } = attacker
      attacker.enter_frame(nf);
      attacker.arest = arest;
      break;
  }
}
