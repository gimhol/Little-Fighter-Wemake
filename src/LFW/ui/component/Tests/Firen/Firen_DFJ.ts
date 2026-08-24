import { AGK, GK, O_ID, TeamEnum } from "../../../../defines";
import { Entity } from "../../../../entity";
import { TestCase } from "../TestCase";
import { ActionDirector } from "../ActionDirector";

export class Firen_DFJ extends TestCase {
  override name: string = 'Firen D>J'
override readonly director = new ActionDirector()
    .offset(500,
      () => this.entities[0]?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Jump),
      () => this.entities[0]?.ctrl.key_up(...AGK).key_down(GK.Up),
      () => this.entities[0]?.ctrl.key_up(...AGK),
      () => this.entities[0]?.ctrl.key_up(...AGK).key_down(GK.Down),
      () => this.entities[0]?.ctrl.key_up(...AGK),
      () => this.entities[0]?.ctrl.key_up(...AGK).key_down(GK.Defend),
      () => this.entities[0]?.ctrl.key_up(...AGK)
    )
    .sort()


  override enter(): void {
    this.director.reset();
    do {
      const firen = this.entities[0] = this.spawn(O_ID.Firen)!;
      if (!firen) return;
      firen.set_position(0, 0, this.midZ);
      firen.team = TeamEnum.Team_1;
      firen.key_role = false;
      firen.mp = 1000000;
      firen.attach();
    } while (0);

    this.bandits_8().forEach(bandit => {
      bandit.team = TeamEnum.Team_2;
      bandit.hp = bandit.hp_r = bandit.hp_max = 75
      bandit.attach();
    })
  }
}
