import { InvalidController } from '../../../../controller';
import { AGK, GK } from '../../../../defines';
import { O_ID, OID } from '../../../../defines/OID';
import { is_bot_ctrl } from '../../../../entity';
import { ActionDirector } from '../ActionDirector';
import { TestCase } from '../TestCase';

export class CriminalSaving1 extends TestCase {
  override name: string = 'CriminalSaving 1';
  director = new ActionDirector().offset(300, () => {
    this.fighters[1].ctrl.click(GK.Attack)
    this.fighters[4].ctrl.click(GK.Attack)
  }).offset(300, () => {
    this.fighters[0].ctrl.key_down(GK.Down, GK.Attack)
    this.fighters[1].ctrl.key_down(GK.Attack)
    this.fighters[2].ctrl.click(GK.Defend, GK.Up, GK.Jump)
    this.fighters[3].ctrl.key_down(GK.Attack)
    this.fighters[4].ctrl.key_down(GK.Right, GK.Attack)
    this.fighters[5].ctrl.key_down(GK.Down, GK.Attack)
  }).offset(300, () => {
    this.fighters.forEach(f => f.ctrl.key_up(...AGK))
  })
  override update(dt: number): number | void | undefined {
    this.director.update(dt)
    for (const c of this.world.entities) {
      if (is_bot_ctrl(c.ctrl)) c.ctrl = new InvalidController("", c)
    }

  }
  override enter(): void {
    this.director.reset();
    this.hori(O_ID.Criminal, this.midX, this.midZ, 700, 6)

    this.fighters = this.hori([
      O_ID.Rudolf, O_ID.Dennis, O_ID.Firen, O_ID.Davis, O_ID.Deep, O_ID.Henry
    ], this.midX - 30, this.midZ, 700)

    this.fighters[0].name = 'Rudolf √'
    this.fighters[1].name = 'Weapon Swing √'
    this.fighters[2].name = '"Ball" ×'
    this.fighters[3].name = 'Punch √'
    this.fighters[4].name = 'Weapon Threw ×'
    this.fighters[5].name = 'Arrow √'

    const w1 = this.spawn(O_ID.Weapon_Stick)
    w1?.set_position(
      this.fighters[1].position.x,
      this.fighters[1].position.y,
      this.fighters[1].position.z
    )
    w1?.attach();

    this.fighters[4].set_position_x(
      this.fighters[4].position.x - 50
    )
    const w2 = this.spawn(O_ID.Weapon_baseball)
    w2?.set_position(
      this.fighters[4].position.x,
      this.fighters[4].position.y,
      this.fighters[4].position.z
    )
    w2?.attach();

    this.fighters.forEach(f => {
      f.team = '1'
    })

    // this.figters = this.hori(O_ID.Template, this.midX, this.midZ, 320, 4)
    // this.figters.forEach((v, i) => {
    //   const player_id = `MoveStayCome_${i}`
    //   v.ctrl = new LocalController(player_id, v);
    // })
  }
}

