import type { IDoubleClickSnapshot } from "./IDoubleClickSnapshot";

export class DoubleClick<D> {
  data: [D | undefined, D | undefined] = [void 0, void 0];
  time: number = 0;
  used: boolean = false;
  fired: boolean = false;
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  press(time: number, data: D, interval: number) {
    if (this.time + time <= interval) {
      //  双击判定：间隔时间内再次按下
      this.time = time;
      this.data[1] = data;
      this.fired = true;
    } else {
      // 双击判定：首次按下
      this.time = -time;
      this.data[0] = data;
      this.data[1] = void 0;
    }
  }
  step() {
    this.time = -this.time;
    this.data[0] = this.data[1];
    this.data[1] = void 0;
    this.fired = false;
  }
  reset() {
    this.time = 0;
    this.data[0] = void 0;
    this.data[1] = void 0;
    this.fired = false;
  }

  to_snapshot(): IDoubleClickSnapshot<D> {
    return {
      data: [...this.data],
      time: this.time,
      used: this.used,
      fired: this.fired,
      name: this.name,
    };
  }

  from_snapshot(s: IDoubleClickSnapshot<D>) {
    this.data[0] = s.data[0];
    this.data[1] = s.data[1];
    this.time = s.time;
    this.used = s.used;
    this.fired = s.fired;
    this.name = s.name;
  }
}
