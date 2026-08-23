import { GK, O_ID, TeamEnum } from "../../../../defines";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";

export class Boomerang_1_1 extends TestCase {
  override name: string = 'Boomerang_1_1';
  director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Attack)
    }, () => {
      this.fighters[0].ctrl.key_down(GK.Right)
      this.fighters[0].ctrl.click(GK.Attack)
    }, () => {
      this.fighters[0].ctrl.key_up(GK.Right)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    this.director.reset()
    const b = this.spawn(O_ID.Weapon_Boomerang)
    if (b) {
      b.ctrl = this.lfw.factory.create_ctrl(O_ID.Weapon_Boomerang, '', b)
      b.set_position(50, 0, this.far + 1);
      b.attach()
    }

    const f1 = this.spawn(O_ID.Knight)
    if (f1) {
      f1.team = TeamEnum.Team_1
      f1.set_position(50, 0, this.far);
      f1.attach()
      this.fighters = [f1]
    }
  }
}

export class Boomerang_1_2 extends Boomerang_1_1 {
  override name: string = 'Boomerang_1_2';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(50, 0, this.far);
      f1.attach()
    }
  }
}

export class Boomerang_1_3 extends Boomerang_1_1 {
  override name: string = 'Boomerang_1_3';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(this.right - 50, 0, this.far);
      f1.attach()
    }
  }
}

export class Boomerang_1_4 extends Boomerang_1_1 {
  override name: string = 'Boomerang_1_4';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(50, 0, this.near);
      f1.attach()
    }
  }
}

export class Boomerang_1_5 extends Boomerang_1_1 {
  override name: string = 'Boomerang_1_5';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(this.right - 50, 0, this.near);
      f1.attach()
    }
  }
}

export class Boomerang_1_6 extends Boomerang_1_1 {
  override name: string = 'Boomerang_1_6';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(this.midX, 0, this.midZ);
      f1.attach()
    }
  }
}

export class Boomerang_2_1 extends TestCase {
  override name: string = 'Boomerang_2_1';
  director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Attack)
    }, () => {
      this.fighters[0].ctrl.key_down(GK.Right)
      this.fighters[0].ctrl.click(GK.Attack)
    }, () => {
      this.fighters[0].ctrl.key_up(GK.Right)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    this.director.reset()
    const b = this.spawn(O_ID.Weapon_Boomerang)
    if (b) {
      b.ctrl = this.lfw.factory.create_ctrl(O_ID.Weapon_Boomerang, '', b)
      b.set_position(50, 0, this.far + 1);
      b.attach()
    }

    const f1 = this.spawn(O_ID.Jan)
    if (f1) {
      f1.team = TeamEnum.Team_1
      f1.set_position(50, 0, this.far);
      f1.attach()
      this.fighters = [f1]
    }
  }
}

export class Boomerang_2_2 extends Boomerang_2_1 {
  override name: string = 'Boomerang_2_2';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(50, 0, this.far);
      f1.attach()
    }
  }
}

export class Boomerang_2_3 extends Boomerang_2_1 {
  override name: string = 'Boomerang_2_3';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(this.right - 50, 0, this.far);
      f1.attach()
    }
  }
}

export class Boomerang_2_4 extends Boomerang_2_1 {
  override name: string = 'Boomerang_2_4';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(50, 0, this.near);
      f1.attach()
    }
  }
}

export class Boomerang_2_5 extends Boomerang_2_1 {
  override name: string = 'Boomerang_2_5';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(this.right - 50, 0, this.near);
      f1.attach()
    }
  }
}

export class Boomerang_2_6 extends Boomerang_2_1 {
  override name: string = 'Boomerang_2_6';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(this.midX, 0, this.midZ);
      f1.attach()
    }
  }
}

export class Boomerang_3_1 extends TestCase {
  override name: string = 'Boomerang_3_1';
  director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Attack)
    }, () => {
      this.fighters[0].ctrl.key_down(GK.Right)
      this.fighters[0].ctrl.click(GK.Attack)
    }, () => {
      this.fighters[0].ctrl.key_up(GK.Right)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    this.director.reset()
    const b = this.spawn(O_ID.Weapon_Boomerang)
    if (b) {
      b.ctrl = this.lfw.factory.create_ctrl(O_ID.Weapon_Boomerang, '', b)
      b.set_position(50, 0, this.far + 1);
      b.attach()
    }

    const f1 = this.spawn(O_ID.Davis)
    if (f1) {
      f1.team = TeamEnum.Team_1
      f1.set_position(50, 0, this.far);
      f1.attach()
      this.fighters = [f1]
    }
  }
}

export class Boomerang_3_2 extends Boomerang_3_1 {
  override name: string = 'Boomerang_3_2';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(50, 0, this.far);
      f1.attach()
    }
  }
}

export class Boomerang_3_3 extends Boomerang_3_1 {
  override name: string = 'Boomerang_3_3';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(this.right - 50, 0, this.far);
      f1.attach()
    }
  }
}

export class Boomerang_3_4 extends Boomerang_3_1 {
  override name: string = 'Boomerang_3_4';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(50, 0, this.near);
      f1.attach()
    }
  }
}

export class Boomerang_3_5 extends Boomerang_3_1 {
  override name: string = 'Boomerang_3_5';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(this.right - 50, 0, this.near);
      f1.attach()
    }
  }
}

export class Boomerang_3_6 extends Boomerang_3_1 {
  override name: string = 'Boomerang_3_6';
  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter()

    const f1 = this.spawn(O_ID.Bandit)
    if (f1) {
      f1.team = TeamEnum.Team_2
      f1.set_position(this.midX, 0, this.midZ);
      f1.attach()
    }
  }
}