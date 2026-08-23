import { GK, O_ID, TeamEnum } from "../../../../defines";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";

export class Rudolf_DFJ extends TestCase {
  override name: string = 'Rudolf J + ^|v + D + D>J';
  director = new ActionDirector()
    .offset(100, () => {
      this.entities.forEach(v => v.ctrl.click(GK.j))
    })
    .offset(200, () => {
      this.entities.forEach((v, i) => v.ctrl.key_down(i == 0 ? GK.U : GK.D))
    })
    .offset(200, () => {
      this.entities.forEach((v, i) => v.ctrl.click(GK.d).key_down(i == 0 ? GK.U : GK.D))
    })
    .offset(100, () => {
      this.entities.forEach((v, i) => v.ctrl.click(i == 0 ? GK.R : GK.L, GK.j).key_up(i == 0 ? GK.U : GK.D))
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    this.director.reset()
    this.entities = this.hori_2(O_ID.Rudolf, 100)
    this.entities.forEach((o, i) => {
      o.team = TeamEnum.Team_1;
      o.facing = i == 0 ? -1 : 1
      o.key_role = false;
      o.mp = 1000000;
    })
  }
}
