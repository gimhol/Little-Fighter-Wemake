import { InvalidController } from '../../../../controller';
import { GK, AGK, O_ID } from '../../../../defines';
import { is_bot_ctrl } from '../../../../entity';
import { ActionDirector } from '../ActionDirector';
import { TestCase } from '../TestCase';

export class ArmorTest1 extends TestCase {
  override name: string = 'Armor Test 1';
  director = new ActionDirector().offset(300).repeat(5, 300, () => {
    for (const f of this.fighters)
      f.ctrl.click(GK.Attack)
  })

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
    for (const c of this.world.entities) {
      if (is_bot_ctrl(c.ctrl)) c.ctrl = new InvalidController("", c);
    }
  }

  override enter(): void {
    this.director.reset();
    this.hori(O_ID.Julian, this.midX, this.far, 600, 2);
    this.hori(O_ID.Julian, this.midX, this.near, 600, 2);

    this.fighters = [
      ...this.hori([O_ID.Rudolf, O_ID.Henry], this.midX - 30, this.far, 600),
      ...this.hori([O_ID.Deep, O_ID.Davis], this.midX - 30, this.near, 600),
    ];

    this.fighters.forEach(f => {
      f.team = '1';
    });

    // this.figters = this.hori(O_ID.Template, this.midX, this.midZ, 320, 4)
    // this.figters.forEach((v, i) => {
    //   const player_id = `MoveStayCome_${i}`
    //   v.ctrl = new LocalController(player_id, v);
    // })
  }
}
