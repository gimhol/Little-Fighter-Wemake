import { GK, O_ID } from '../../../../defines';
import { StatBarType } from '../../../../entity';
import { ActionDirector } from '../ActionDirector';
import { TestCase } from '../TestCase';

export class ArmorTest1 extends TestCase {
  override name: string = 'Armor Test 1';
  director = new ActionDirector().offset(300).repeat(999, 3, () => {
    for (const f of this.fighters)
      f.ctrl.click(GK.Attack)
  })

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }

  override enter(): void {
    this.director.reset();
    [
      ...this.hori(O_ID.Julian, this.midX, this.far, 600, 2),
      ...this.hori(O_ID.Julian, this.midX, this.near, 600, 5)
    ].forEach(f => {
      // f.stat_bar_type = StatBarType.None
      f.name_visible = false;
    })

    this.fighters = [
      ...this.hori([O_ID.Rudolf, O_ID.Henry], this.midX - 30, this.far, 600),
      ...this.hori([O_ID.Deep, O_ID.Dennis, O_ID.Julian, O_ID.Bandit, O_ID.Davis], this.midX - 30, this.near, 600),
    ];
    this.fighters.forEach(f => {
      f.stat_bar_type = StatBarType.None
      f.key_role = true;
    })
    this.fighters[0].name = '3rd atk hit'
    this.fighters[1].name = '3rd atk hit'
    this.fighters[2].name = '2rd atk hit'
    this.fighters[3].name = '2rd atk hit'
    this.fighters[4].name = '2rd atk hit'
    this.fighters[5].name = '3rd atk hit'
    this.fighters[6].name = '3rd atk hit'

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
