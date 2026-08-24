import { ActionDirector } from '../ActionDirector';
import { GK, O_ID, TeamEnum } from "../../../../defines";
import { Entity } from "../../../../entity/Entity";
import { TestCase } from "../TestCase";

export class Firzen_FUSION extends TestCase {
  override name: string = 'Firzen = Freeze + Firen'
  firen?: Entity | null;
  freze?: Entity | null;
override readonly director = new ActionDirector().offset(1000, () => {
    this.firen?.ctrl.db_hit(GK.R).key_up(GK.R)
    this.freze?.ctrl.db_hit(GK.L).key_up(GK.L)
  }).offset(6000, () => {
    this.firen?.ctrl.click(GK.d, GK.j, GK.a)
    this.freze?.ctrl.click(GK.d, GK.j, GK.a)
  }).times(1)


  override enter(): void {
    this.director.reset();
    const [firen, freze] = this.spawns(O_ID.Firen, O_ID.Freeze);
    if (!firen || !freze) return;
    firen.set_position(this.midX - 300, 0, this.midZ);
    firen.team = TeamEnum.Team_1
    firen.facing = 1;
    firen.hp = 100;
    firen.attach();
    freze.set_position(this.midX + 300, 0, this.midZ);
    freze.team = TeamEnum.Team_1
    freze.facing = -1;
    freze.hp = 100;
    freze.attach();
    this.freze = freze;
    this.firen = firen;
    this.bandits_8().forEach(v => {
      v.team = TeamEnum.Team_2
    })
  }
}

