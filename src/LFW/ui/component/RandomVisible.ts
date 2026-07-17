import { Randoming } from "../../helper";
import { range } from '../../utils/math/range';
import { UIComponent } from "./UIComponent";

export class RandomVisible extends UIComponent {
  static override readonly TAGS: string[] = ["RandomVisible"];
  static randomings = new Map<string | RandomVisible, Randoming<number>>();
  get group() { return this.str(0) };
  get randoming() {
    const key = this.group || this;
    let ret = RandomVisible.randomings.get(key);
    if (!ret) {
      const arr = range(0, this.node.children.length - 1, 1);
      RandomVisible.randomings.set(key, ret = new Randoming(arr, void 0, false));
    }
    return ret;
  }
  override on_resume(): void {
    super.on_resume?.();
    const idx = this.randoming.get();
    this.node.children.forEach((v, i) => {
      v.visible = i == idx
    })
  }
}

