import { ActionDirector } from '../ActionDirector';
import { GK } from '../../../../defines/GameKey';
import { LocalController } from '../../../../controller/LocalController';
import { O_ID } from '../../../../defines/OID';
import { TestCase } from '../TestCase';
import { Entity } from "../../../../entity";

export class MoveStayCome extends TestCase {
  override name: string = 'MOVE(DADA) / STAY(DDDD) / COME(DJDJ) / FOLLOW(DJJJ)';
  figters: Entity[] = [];
override readonly director = new ActionDirector()
    .offset(50, () => {
      this.figters.forEach(v => v.ctrl.click(GK.Defend))
    }).offset(50, () => {
      this.figters[0].ctrl.click(GK.Defend)
      this.figters[1].ctrl.click(GK.Jump)
      this.figters[2].ctrl.click(GK.Attack)
      this.figters[3].ctrl.click(GK.Jump)
    }).offset(50, () => {
      this.figters[0].ctrl.click(GK.Defend)
      this.figters[1].ctrl.click(GK.Defend)
      this.figters[2].ctrl.click(GK.Defend)
      this.figters[3].ctrl.click(GK.Jump)
    }).offset(50, () => {
      this.figters[0].ctrl.click(GK.Defend)
      this.figters[1].ctrl.click(GK.Jump)
      this.figters[2].ctrl.click(GK.Attack)
      this.figters[3].ctrl.click(GK.Jump)
    });

  override enter(): void {
    this.director.reset();
    this.figters = this.hori(O_ID.Template, this.midX, this.midZ, 320, 4)
    this.figters.forEach((v, i) => {
      const player_id = `MoveStayCome_${i}`
      v.ctrl = new LocalController(player_id, v);
    })
  }
}


