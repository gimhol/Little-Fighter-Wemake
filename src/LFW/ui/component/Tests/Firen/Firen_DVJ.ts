import { AGK, GK, O_ID, TeamEnum } from "../../../../defines";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";

export class Firen_DVJ extends TestCase {
  override name: string = 'Firen DvJ';
override readonly director = new ActionDirector()
    .offset(500,
      () => {
        this.entities[0]?.ctrl.key_up(...AGK).click(GK.Defend, GK.Down, GK.Jump)
        this.entities[1]?.ctrl.key_up(...AGK).click(GK.Defend, GK.Down, GK.Jump)
        this.entities[2]?.ctrl.key_up(...AGK).click(GK.Defend, GK.Down, GK.Jump)
      },
      () => {
        this.entities[0]?.ctrl.key_down(GK.Down);
        this.entities[2]?.ctrl.key_down(GK.Up);
      }
    )
    .wait(500)
    .sort();


  override enter(): void {
    this.director.reset();
    this.entities = this.hori_3(O_ID.Firen)
    this.entities.forEach(o => {
      o.team = TeamEnum.Team_1;
      o.key_role = false;
      o.mp = 1000000;
    })
  }
}
