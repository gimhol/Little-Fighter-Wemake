import { TE } from '../../../../defines/TeamEnum';
import { StatBarType } from '../../../../entity/StatBarType';
import { round } from '../../../../utils/math/base';
import { ActionDirector } from '../ActionDirector';
import { TestCase } from '../TestCase';

export class AllFighters extends TestCase {
  override name: string = 'All Fighters';
  readonly director = new ActionDirector().offset(2000, () => {
    this.fighters.forEach(v => {
      if (!v.team) v.team = '1';
      else if (v.team == TE.Max) v.team = '';
      else v.team = String((Number(v.team) % Number(TE.Max)) + 1);
    })
  }).times(9999);

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();

    const all_ids = this.lfw.datas.fighters.map(v => v.id);
    const half_len = round(all_ids.length / 2);
    const ids_1 = all_ids.slice(0, half_len);
    const ids_2 = all_ids.slice(half_len);
    this.fighters = [
      ...this.hori(ids_1, this.midX, this.midZ - 50, this.bg.width - 120),
      ...this.hori(ids_2, this.midX, this.near, this.bg.width - 120)
    ]
    this.fighters.map(v => {
      v.key_role = false;
      v.stat_bar_type = StatBarType.None;
      v.name_visible = true;
      v.team = '';
      v.attach();
      return v
    });

  }
}
