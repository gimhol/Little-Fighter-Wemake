import { GK, O_ID, TeamEnum } from "../../../../defines";
import { TestCase } from "../TestCase";

export class Jan_DUA_2 extends TestCase {
  override name: string = 'Jan D^A 2'
  override enter(): void {

    const jan = this.spawn(O_ID.Jan)
    if (!jan) return;
    jan.set_position(this.midX, 0, this.midZ);
    jan.team = TeamEnum.Team_1;
    jan.attach();
    jan.ctrl.click(GK.d, GK.U, GK.a);
  }
}

export class Jan_DUA extends Jan_DUA_2 {
  override name: string = 'Jan D^A 1'
  override enter(): void {
    super.enter();
    this.bandits_8().forEach(v => {
      v.team = TeamEnum.Team_2;
    })
  }
}



