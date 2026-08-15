import { GK, OID, TE } from '../../../../defines';
import { ActionDirector } from '../ActionDirector';
import { TestCase } from '../TestCase';

export class WeaponPicking2 extends TestCase {
  override name: string = 'Weapon Picking 2 (Fighter Spawn Earlier)';
  readonly director = new ActionDirector().offset(1000, () => {
    this.fighters.forEach(v => v.ctrl.ck(GK.a));
  }).repeat(9999, 1500, () => {
    this.fighters.forEach(v => v.ctrl.kd(GK.L).ku(GK.R));
  }, () => {
    this.fighters.forEach(v => v.ctrl.kd(GK.R).ku(GK.L));
  });
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }

  override enter(): void {
    this.director.reset();
    this.owner.lfw.change_bg('bg_1');
    const woids: string[] = [
      OID.Weapon0, OID.Weapon1, OID.Weapon2, OID.Weapon3, OID.Weapon4,
      OID.Weapon5, OID.Weapon6, OID.Weapon7, OID.Weapon8, OID.Weapon9,
      OID.Weapon10, OID.Weapon11
    ];

    this.fighters = this.circle(OID.Jack, this.midX, this.midZ, 100, 100, woids.length);
    this.fighters.forEach(v => {
      v.team = TE.Team_2;
      v.attach();
    });

    this.circle(woids, this.midX, this.midZ, 100, 100).forEach(v => {
      v.enter_frame_by_id(v.data.indexes?.on_ground);
      v.attach();
    });

  }
}
