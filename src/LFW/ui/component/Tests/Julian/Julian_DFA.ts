import { AGK, GK, O_ID, StateEnum, TeamEnum } from "../../../../defines";
import { Entity } from "../../../../entity";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";

export class Julian_DFA extends TestCase {
  override name: string = 'Julian D>A'
  julian?: Entity | null;
override readonly director = new ActionDirector()
    .offset(100, () => {
      this.julian?.ctrl.click(GK.Defend, GK.Right, GK.Attack)
    })
    .repeat(1000, 50, () => {
      this.julian?.ctrl.click(GK.Attack)
    })
    .times(9999)
    .sort()


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
