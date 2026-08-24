import { GK, O_ID } from "../../../../defines";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";

export class Knife_1_1 extends TestCase {
  override name: string = 'Knife_1_1';
  override readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters.forEach(f => f.ctrl.click(GK.Attack))
    }, () => {
      this.fighters.forEach(f => {
        f.ctrl.key_down(GK.Right)
        f.ctrl.click(GK.Attack)
      })
    }, () => {
      this.fighters.forEach(f => {
        f.ctrl.key_up(GK.Right);
        this.world.camera.dest(350, 0)
      })
    })
    .repeat(9999, 3000, () => {
      this.world.camera.dest(0, 0)
    }, () => {
      this.world.camera.dest(350, 0)
    })
    .sort();


  override enter(): void {
    this.director.reset()
    this.owner.lfw.change_bg('pixel_ruler');
    const x = 20
    const len = 300
    this.verti(O_ID.Weapon_Knife, x, this.midZ, len, 4);
    this.fighters = this.verti(
      [O_ID.Mark, O_ID.Deep, O_ID.Davis, O_ID.Jan], x, this.midZ, len
    );
  }
}
export class Stick_1_1 extends TestCase {
  override name: string = 'Stick_1_1';
  override readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters.forEach(f => f.ctrl.click(GK.Attack))
    })
    .offset(100, () => {
      this.fighters.forEach(f => f.ctrl.dbl_click(GK.Right))
    })
    .offset(100, () => {
      this.fighters.forEach(f => f.ctrl.key_down(GK.Right))
    })
    .offset(100, () => {
      this.fighters.forEach(f => f.ctrl.click(GK.Attack))
    })
    .offset(100, () => {
      this.fighters.forEach(f => f.ctrl.key_up(GK.Right))
    })
    .sort();
  override enter(): void {
    this.director.reset()
    this.owner.lfw.change_bg('pixel_ruler');
    this.world.stage.player_r = 10;
    const x = 0
    const len = 300
    this.verti(O_ID.Weapon_Stick, x, this.midZ, len, 4);
    this.fighters = this.verti(
      [O_ID.Mark, O_ID.Deep, O_ID.Davis, O_ID.Jan], x, this.midZ, len
    );
  }
}
export class Hoe_1_1 extends TestCase {
  override name: string = 'Hoe_1_1';
  override readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters.forEach(f => f.ctrl.click(GK.Attack))
    })
    .offset(100, () => {
      this.fighters.forEach(f => f.ctrl.dbl_click(GK.Right))
    })
    .offset(100, () => {
      this.fighters.forEach(f => f.ctrl.key_down(GK.Right))
    })
    .offset(100, () => {
      this.fighters.forEach(f => f.ctrl.click(GK.Attack))
    })
    .offset(100, () => {
      this.fighters.forEach(f => f.ctrl.key_up(GK.Right))
    })
    .sort();
  override enter(): void {
    this.director.reset()
    this.owner.lfw.change_bg('pixel_ruler');
    this.world.stage.player_r = 10;
    const x = 0
    const len = 300
    this.verti(O_ID.Weapon_Hoe, x, this.midZ, len, 4);
    this.fighters = this.verti(
      [O_ID.Mark, O_ID.Deep, O_ID.Davis, O_ID.Jan], x, this.midZ, len
    );
  }
}
export class Stone_1_1 extends TestCase {
  override name: string = 'Stone_1_1';
  override readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters.forEach(f => f.ctrl.click(GK.Attack))
    }, () => {
      this.fighters.forEach(f => {
        f.ctrl.click(GK.Attack)
      })
    }, () => {
      this.fighters.forEach(f => {
        f.ctrl.key_up(GK.Right);
      })
    })
    .sort();


  override enter(): void {
    this.director.reset()
    this.owner.lfw.change_bg('pixel_ruler');
    const x = 20
    const len = 300
    this.verti(O_ID.Weapon_Stone, x, this.midZ, len, 4);
    this.fighters = this.verti(
      [O_ID.Mark, O_ID.Deep, O_ID.Davis, O_ID.Jan], x, this.midZ, len
    );
  }
}

export class Baseball_1_1 extends TestCase {
  override name: string = 'Baseball_1_1';
  override readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters.forEach(f => f.ctrl.click(GK.Attack));
    }, () => {
      this.fighters.forEach(f => {
        f.ctrl.key_down(GK.Right);
        f.ctrl.click(GK.Attack);
      });
    }, () => {
      this.fighters.forEach(f => {
        f.ctrl.key_up(GK.Right);
        this.world.camera.dest(700, 0);
      });
    }).repeat(9999, 3000, () => {
      this.world.camera.dest(600, 0);
    }, () => {
      this.world.camera.dest(700, 0);
    })
    .sort();


  override enter(): void {
    this.director.reset();
    this.owner.lfw.change_bg('pixel_ruler');
    const x = 20;
    const len = 300;
    this.verti(O_ID.Weapon_baseball, x, this.midZ, len, 4);
    this.fighters = this.verti(
      [O_ID.Mark, O_ID.Deep, O_ID.Davis, O_ID.Jan], x, this.midZ, len
    );
  }
}
