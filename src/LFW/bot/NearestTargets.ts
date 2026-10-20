import { Entity } from "../entity";
import { manhattan_xz } from "../helper/manhattan_xz";

export class NearestTargets {
  max: number;
  targets: Entity[] = [];
  constructor(max: number) { this.max = max; }

  get size(): number { return this.targets.length; }

  get(): Entity | undefined { return this.targets[0]; }

  look(self: Entity, other: Entity) {
    const { targets } = this;
    if (!self || targets.includes(other)) return;

    const distance = manhattan_xz(self, other);
    const len = targets.length;
    if (len < this.max) {
      targets.push(other);
      return;
    }
    for (let i = 0; i < len; ++i) {
      if (distance > manhattan_xz(self, targets[i])) continue;
      targets.splice(i, 0, other);
      targets.length = this.max;
      break;
    }
  }

  del(condition: (target: Entity) => boolean) {
    this.targets = this.targets.filter((target) => !condition(target));
  }

  sort(self: Entity) {
    this.targets.sort((a, b) => {
      const d = manhattan_xz(self, a) - manhattan_xz(self, b);
      if (d !== 0) return d;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  clear() {
    this.targets.length = 0;
  }
}
