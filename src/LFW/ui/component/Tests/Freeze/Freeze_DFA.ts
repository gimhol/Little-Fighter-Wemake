import { AGK, GK, O_ID, TeamEnum } from "../../../../defines";
import { Entity } from "../../../../entity";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";


export class Freeze_DFA extends TestCase {
  override name: string = 'Freeze D>A+A+A';
  freeze1?: Entity | null;
  freeze2?: Entity | null;
  freeze3?: Entity | null;
override readonly director = new ActionDirector()
    .insert(50, () => {
      this.freeze1?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Attack).key_down(GK.Down);
      this.freeze2?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Attack);
      this.freeze3?.ctrl.key_up(...AGK).click(GK.Defend, GK.Right, GK.Attack).key_down(GK.Up);
    }).repeat(10, 50, () => {
      this.freeze1?.ctrl.click(GK.Attack);
      this.freeze2?.ctrl.click(GK.Attack);
      this.freeze3?.ctrl.click(GK.Attack);
    })
    .wait(500)
    .sort();


  override enter(): void {
    this.director.reset();
    const freezes = this.verti_3(O_ID.Freeze, 50);
    freezes.forEach(o => {
      o.team = TeamEnum.Team_1;
      o.key_role = false;
      o.mp = 1000000;
    });
    this.freeze1 = freezes[0];
    this.freeze2 = freezes[1];
    this.freeze3 = freezes[2];
    this.bandits_mid_8();
  }
}
