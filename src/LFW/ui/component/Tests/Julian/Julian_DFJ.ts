import { AGK, GK, O_ID, TeamEnum } from "../../../../defines";
import { Entity } from "../../../../entity";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";

export class Julian_DFJ extends TestCase {
  override name: string = 'Julian D>J'
  julian?: Entity | null;
override readonly director = new ActionDirector()
    .offset(700,
      () => this.julian?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Jump),
      () => this.julian?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Jump).key_down(GK.Down),
      () => this.julian?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Jump).key_down(GK.Up),
      () => this.julian?.ctrl.key_up(...AGK).click(GK.Defend, GK.Left, GK.Jump),
      () => this.julian?.ctrl.key_up(...AGK).click(GK.Defend, GK.Left, GK.Jump).key_down(GK.Down),
      () => this.julian?.ctrl.key_up(...AGK).click(GK.Defend, GK.Left, GK.Jump).key_down(GK.Up),
      () => this.julian?.ctrl.key_up(...AGK)
    ).sort()


  override enter(): void {
    this.director.reset()
    do {
      const julian = this.julian = this.spawn(O_ID.Julian);
      if (!julian) return;
      julian.set_position(this.midX, 0, this.midZ);
      julian.team = TeamEnum.Team_1;
      julian.key_role = false;
      julian.mp = 1000000;
      julian.attach();
    } while (0);


    this.bandits_8().forEach(bandit => {
      bandit.team = TeamEnum.Team_2;
      bandit.hp = bandit.hp_r = bandit.hp_max = 75
      bandit.attach();
    })
  }
}
