import type { IPropsMeta } from "../../defines/ISchema";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import { UINode } from "../../ui/UINode";
import { UIComponent } from "./UIComponent";

export interface IFnKeysCountsProps {
  f6?: UINode;
  f7?: UINode;
  f8?: UINode;
  f9?: UINode;
  f10?: UINode;
  fn_key_counts?: UINode;
  fn_key_locked?: UINode;
}
export class FnKeysCounts extends UIComponent<IFnKeysCountsProps> {
  static override readonly TAGS: string[] = ["FnKeysCounts"];
  static override readonly PROPS: IPropsMeta<IFnKeysCountsProps> = {
    f6: UINode,
    f7: UINode,
    f8: UINode,
    f9: UINode,
    f10: UINode,
    fn_key_counts: UINode,
    fn_key_locked: UINode
  }
  readonly world_cbs: IWorldCallbacks = {
    on_fn_locked_change: (locked) => {
      if (locked) {
        this.props.fn_key_locked?.set_visible(true)
        this.props.fn_key_counts?.set_visible(false)
      } else {
        this.props.fn_key_locked?.set_visible(false)
        this.props.fn_key_counts?.set_visible(true)
      }
    },
    on_counts: () => {
      this.props.fn_key_counts?.set_visible(true)
      const { f6, f7, f8, f9, f10 } = this.props;
      f6?.set_text('' + (this.world.counts.get('f6') ?? 0))
      f7?.set_text('' + (this.world.counts.get('f7') ?? 0))
      f8?.set_text('' + (this.world.counts.get('f8') ?? 0))
      f9?.set_text('' + (this.world.counts.get('f9') ?? 0))
      f10?.set_text('' + (this.world.counts.get('f10') ?? 0))
    }
  }
  override on_start(): void {
    this.world.callbacks.add(this.world_cbs)
  }
  override on_stop(): void {
    this.world.callbacks.del(this.world_cbs)
  }
}
