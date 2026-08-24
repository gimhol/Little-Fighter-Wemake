import { GK, O_ID } from "../../../../defines";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";

export class Baseball_1_1 extends TestCase {
  override name: string = 'Baseball_1_1';
override readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters.forEach(f => f.ctrl.click(GK.Attack))
    }, () => {
      this.fighters.forEach(f => {
        f.ctrl.key_down(GK.Right)
        f.ctrl.click(GK.Attack)
      })
    }, () => {
      this.fighters.forEach(f => {
        f.ctrl.key_up(GK.Right);
        this.world.camera.dest(700, 0)
      })
    }).repeat(9999, 3000, () => {
      this.world.camera.dest(700, 0)
    }, () => {
      this.world.camera.dest(600, 0)
    })
    .sort();


  override enter(): void {
    this.director.reset()
    this.owner.lfw.change_bg('pixel_ruler');
    const x = 20
    const len = 300
    this.verti(O_ID.Weapon_baseball, x, this.midZ, len, 4);
    this.fighters = this.verti(
      [O_ID.Mark, O_ID.Deep, O_ID.Davis, O_ID.Jan], x, this.midZ, len
    );
  }
}
