import { TestCase } from '../TestCase';
import { ActionDirector } from '../ActionDirector';
import { TeamEnum } from '../../../../defines/TeamEnum';
import { LocalController } from "../../../../controller";
import { GK, O_ID } from "../../../../defines";
import { Entity } from "../../../../entity";


export class BotFollow extends TestCase {
  override name: string = 'Bot Response FOLLOW(DJJJ)';
  figters: Entity[] = [];
override readonly director = new ActionDirector()
    .offset(50,
      () => this.figters[0].ctrl.click(GK.Defend),
      () => this.figters[0].ctrl.click(GK.Jump),
      () => this.figters[0].ctrl.click(GK.Jump),
      () => this.figters[0].ctrl.click(GK.Jump),
      () => this.figters[0].ctrl.key_down(GK.R).key_up(GK.L)
    ).wait(6000).offset(50,
      () => this.figters[0].ctrl.key_down(GK.L).key_up(GK.R)
    ).wait(6000).times(10000);


  override enter(): void {
    this.director.reset();
    this.figters = this.hori_2(O_ID.Mark, 350);
    this.figters.forEach((v, i) => {
      const player_id = `MoveStayCome_${i}`;
      v.ctrl = new LocalController(player_id, v);
      v.team = '' + (i + 1);
      v.hp = v.hp_r = v.hp_max = 999999;
    });

    this.bandits_8().forEach(v => {
      v.team = TeamEnum.Team_1
      v.ctrl = this.owner.lfw.factory.create_ctrl(O_ID.Bandit, '', v)
    })
  }
}
