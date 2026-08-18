import { AGK, Defines, GK, O_ID, TeamEnum } from "../../../../defines";
import { Entity } from "../../../../entity";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";
import { CMD } from "../../../../defines/CMD";

export class MoonTest extends TestCase {
  override name: string = 'Bg Override Gravity Test, Normal Jump / Jump + Defend / Small Jump';
  louis1?: Entity | null;
  louis2?: Entity | null;
  louis3?: Entity | null;
  director = new ActionDirector()
    .offset(100,
      () => {
        this.louis1?.ctrl.key_down(GK.j).key_down(GK.a);
        this.louis2?.ctrl.key_down(GK.j).key_down(GK.a);
        this.louis3?.ctrl.click(GK.j).key_down(GK.a);
      }
    )
    .offset(500, () => {
      this.louis1?.ctrl.key_up(...AGK);
      this.louis2?.ctrl.key_up(...AGK).key_down(GK.d);
      this.louis3?.ctrl.key_up(...AGK);
    })
    .offset(500, () => {
      this.louis1?.ctrl.key_up(...AGK)
      this.louis2?.ctrl.key_up(...AGK)
      this.louis3?.ctrl.key_up(...AGK)
    })
    .wait(1000)
    .times(999)
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    this.owner.world.clear();
    this.owner.lfw.change_bg('bg_moon');
    this.lfw.push_cmd(CMD.DIST_CAM, `${this.midX - Defines.MODERN_SCREEN_WIDTH / 2}`)
    this.director.reset();
    const louiss = this.hori_3(O_ID.LouisEX, 100)
    louiss.forEach(o => {
      o.team = TeamEnum.Team_1;
      o.key_role = false;
      o.mp = 1000000;
    })
    this.louis1 = louiss[0]
    this.louis2 = louiss[1]
    this.louis3 = louiss[2]
  }
}
