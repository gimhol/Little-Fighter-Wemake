import { AGK, GK, O_ID, TeamEnum } from "../../../../defines";
import { Entity } from "../../../../entity";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";



export class Freeze_DUJ extends TestCase {
  override name: string = 'Freeze D^J';
  freeze1?: Entity | null;
  freeze2?: Entity | null;
  freeze3?: Entity | null;
override readonly director = new ActionDirector()
    .offset(100,
      () => {
        this.freeze1?.ctrl.key_up(...AGK).click(GK.Defend, GK.Up, GK.Jump);
        this.freeze2?.ctrl.key_up(...AGK).click(GK.Defend, GK.Up, GK.Jump);
        this.freeze3?.ctrl.key_up(...AGK).click(GK.Defend, GK.Up, GK.Jump);
      },
      () => {
        this.freeze1?.ctrl.key_up(...AGK).key_down(GK.Down);
        this.freeze3?.ctrl.key_up(...AGK).key_down(GK.Up);
      }
    )
    .wait(500)
    .sort();


  override enter(): void {
    this.director.reset();
    const freezes = this.hori_3(O_ID.Freeze)
    freezes.forEach(o => {
      o.team = TeamEnum.Team_1;
      o.key_role = false;
      o.mp = 1000000;
    })
    this.freeze1 = freezes[0]
    this.freeze2 = freezes[1]
    this.freeze3 = freezes[2]
    this.bandits_mid_8()
  }
}
