import { GK, O_ID } from "../../../../defines";
import { AGK } from '../../../../defines/GameKey';
import { Entity, StatBarType } from "../../../../entity";
import { ActionDirector } from '../ActionDirector';
import { TestCase } from '../TestCase';

export class FasterSlowerStandUp extends TestCase {
  override name: string = 'Press A/D faster or slower to stand up';
  figters: Entity[] = [];
  override readonly director = new ActionDirector()
    .offset(10, () => {
      this.figters.forEach(v => v.ctrl.key_up(...AGK))
    }).offset(500, () => {
      this.figters.forEach(v => {
        v.set_velocity(null, 5)
        v.enter_frame_by_id(v.data.indexes?.falling?.[1][0])
      })
    }).offset(10, () => {
      this.figters[0].ctrl.key_down(GK.Attack)
      this.figters[2].ctrl.key_down(GK.Defend)
    }).wait(15000).times(10000);


  override enter(): void {
    super.enter()
    this.director.reset();
    this.figters = this.hori_3(O_ID.Hunter, 80);
    this.figters.forEach(v => {
      v.stat_bar_type = StatBarType.None
      v.wakeup_invuln = true
      v.ctrl_visible = true
      v.name_visible = true
    })
    this.figters[0].name = `Press "A"`
    this.figters[1].name = `Default`
    this.figters[2].name = `Press "D"`
  }
}
