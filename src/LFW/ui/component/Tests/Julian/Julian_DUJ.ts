import { GK, O_ID, OID, TeamEnum } from "../../../../defines";
import { TestCase } from "../TestCase";
export class Julian_DUJ extends TestCase {
  override name: string = 'Julian D^J'
  override enter(): void {
    const julian = this.spawn(O_ID.Julian);
    if (!julian) return;
    julian.set_position(this.midX, 0, this.midZ);
    julian.team = TeamEnum.Team_1;
    julian.key_role = false
    julian.attach();
    julian.ctrl.click(GK.Defend, GK.Up, GK.Jump)
    this.bandits_mid_8().forEach(v => {
      v.team = TeamEnum.Team_2;
    })
  }
}

export class Henry_DUJ extends TestCase {
  override name: string = 'Henry D^J'

  override enter(): void {

    const henry = this.spawn(O_ID.Henry);
    if (!henry) return;
    henry.set_position(this.midX, 0, this.midZ);
    henry.team = TeamEnum.Team_1;
    henry.key_role = false
    henry.attach();
    henry.ctrl.click(GK.Defend, GK.Up, GK.Jump)

    this.circle(OID.Bandit, this.midX, this.midZ, 100, 50, 8).forEach(v => {
      v.team = TeamEnum.Team_2;
    })
    this.circle(OID.Bandit, this.midX, this.midZ, 200, 75, 16).forEach(v => {
      v.team = TeamEnum.Team_2;
    })
    this.circle(OID.Bandit, this.midX, this.midZ, 300, 100, 32).forEach(v => {
      v.team = TeamEnum.Team_2;
    })
  }
}
