import { AGK, GK, O_ID, TeamEnum } from "../../../../defines";
import { Entity } from "../../../../entity";
import { TestCase } from "../TestCase";
import { ActionDirector } from "../ActionDirector";

export class Freeze_DFJ extends TestCase {
  override name: string = 'Freeze D>J'
  freeze1?: Entity | null;
  freeze2?: Entity | null;
  freeze3?: Entity | null;
override readonly director = new ActionDirector()
    .offset(500,
      () => {
        this.freeze1?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Jump).key_down(GK.Down)
        this.freeze2?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Jump)
        this.freeze3?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Jump).key_down(GK.Up)
      }
    )
    .wait(500)
    .times(100)
    .sort()


  override enter(): void {
    this.director.reset();
    const figters = this.hori_3(O_ID.Freeze)
    figters.forEach(o => {
      o.team = TeamEnum.Team_1;
      o.key_role = false;
      o.mp = 1000000;
    })
    this.freeze1 = figters[0]
    this.freeze2 = figters[1]
    this.freeze3 = figters[2]

    this.bandits_mid_8()
    this.bandits_8()
  }
}
