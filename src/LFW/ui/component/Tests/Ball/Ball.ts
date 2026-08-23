import { GK, OID, T_E } from "../../../../defines";
import { StatBarType } from "../../../../entity";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";

export class Ball_3000_vs_Ball_3000 extends TestCase {
  override name: string = 'Ball_3000_vs_Ball_3000'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Attack)
      this.fighters[1].ctrl.click(GK.Defend, GK.Left, GK.Attack)
    })
    .repeat(99999, 10, () => {
      this.fighters[0].ctrl.click(GK.Attack)
      this.fighters[1].ctrl.click(GK.Attack)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Davis, OID.Davis], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}

export class Ball_3000_vs_Ball_3005 extends TestCase {
  override name: string = 'Ball_3000_vs_Ball_3005'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Attack)
      this.fighters[1].ctrl.click(GK.Defend, GK.Left, GK.Attack)
    })
    .repeat(99999, 10, () => {
      this.fighters[0].ctrl.click(GK.Attack)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Davis, OID.Henry], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}

export class Ball_3000_vs_Ball_3006 extends TestCase {
  override name: string = 'Ball_3000_vs_Ball_3006'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Attack)
      this.fighters[1].ctrl.click(GK.Defend, GK.Left, GK.Jump)
    })
    .repeat(99999, 10, () => {
      this.fighters[0].ctrl.click(GK.Attack)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Davis, OID.Henry], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}

export class Ball_3005_vs_Ball_3005 extends TestCase {
  override name: string = 'Ball_3005_vs_Ball_3005'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Attack)
      this.fighters[1].ctrl.click(GK.Defend, GK.Left, GK.Attack)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Henry, OID.Henry], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}

export class Ball_3005_vs_Ball_3006 extends TestCase {
  override name: string = 'Ball_3005_vs_Ball_3006'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Attack)
      this.fighters[1].ctrl.click(GK.Defend, GK.Left, GK.Jump)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Henry, OID.Henry], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}

export class Ball_3006_vs_Ball_3006 extends TestCase {
  override name: string = 'Ball_3006_vs_Ball_3006'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Jump)
      this.fighters[1].ctrl.click(GK.Defend, GK.Left, GK.Jump)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Henry, OID.Henry], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}

export class Ball_3000_vs_JohnShield extends TestCase {
  override name: string = 'Ball_3000_vs_JohnShield'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Attack)
      this.fighters[1].ctrl.click(GK.Defend, GK.Left, GK.Jump)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Davis, OID.John], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}

export class Ball_3005_vs_JohnShield extends TestCase {
  override name: string = 'Ball_3005_vs_JohnShield'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Attack)
      this.fighters[1].ctrl.click(GK.Defend, GK.Left, GK.Jump)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Henry, OID.John], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}

export class Ball_3006_vs_JohnShield extends TestCase {
  override name: string = 'Ball_3006_vs_JohnShield'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Jump)
      this.fighters[1].ctrl.click(GK.Defend, GK.Left, GK.Jump)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Henry, OID.John], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}
export class Ball_3000_vs_Many_Punch extends TestCase {
  override name: string = 'Ball_3000_vs_Many_Punch'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Attack)
    })
    .offset(500, () => {
      this.fighters[1].ctrl.click(GK.Defend, GK.Down, GK.Attack)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Davis, OID.Davis], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}
export class Ball_3005_vs_Many_Punch extends TestCase {
  override name: string = 'Ball_3005_vs_Many_Punch'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Attack)
    })
    .offset(500, () => {
      this.fighters[1].ctrl.click(GK.Defend, GK.Down, GK.Attack)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Henry, OID.Davis], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}
export class Ball_3006_vs_Many_Punch extends TestCase {
  override name: string = 'Ball_3006_vs_Many_Punch'
  readonly director = new ActionDirector()
    .offset(500, () => {
      this.fighters[0].ctrl.click(GK.Defend, GK.Right, GK.Jump)
    })
    .offset(500, () => {
      this.fighters[1].ctrl.click(GK.Defend, GK.Down, GK.Attack)
    })
    .sort();

  override update(dt: number): number | void | undefined {
    this.director.update(dt);
  }
  override enter(): void {
    super.enter();
    this.director.reset();
    this.fighters = this.hori([OID.Henry, OID.Davis], this.midX, this.midZ, 450);
    this.fighters[0].team = T_E.Team_1
    this.fighters[0].mp = this.fighters[0].mp_max = 99999;
    this.fighters[0].stat_bar_type = StatBarType.None
    this.fighters[1].team = T_E.Team_2
    this.fighters[1].mp = this.fighters[1].mp_max = 99999;
    this.fighters[1].facing = -1;
    this.fighters[1].stat_bar_type = StatBarType.None
  }
}