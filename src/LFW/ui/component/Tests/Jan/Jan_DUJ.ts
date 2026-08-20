import { GK, O_ID, TeamEnum } from "../../../../defines";
import { StatBarType } from "../../../../entity";
import { TestCase } from "../TestCase";


export class Jan_DUJ_2 extends TestCase {
  override name: string = 'Jan D^J 2'
  override enter(): void {
    do {
      const jan = this.spawn(O_ID.Jan)
      if (!jan) return;
      jan.set_position(this.midX, 0, this.midZ);
      jan.team = TeamEnum.Team_1;
      jan.key_role = true;
      jan.hp = 1;
      jan.attach();
      jan.ctrl.click(GK.d, GK.U, GK.j);
    } while (0);
  }
}
export class Jan_DUJ extends Jan_DUJ_2 {
  override name: string = 'Jan D^J 1'
  override enter(): void {
    super.enter();
    this.bandits_8().forEach(v => {
      v.team = TeamEnum.Team_1;
      v.key_role = true;
      v.hp = 1;
    })
  }
}