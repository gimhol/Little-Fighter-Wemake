import type { UINode } from "../../ui/UINode";

export interface IUINodeRenderer {
  __debugging?: boolean;
  set x(v: number);
  set y(v: number);
  ui: UINode;
  visible: boolean;
  parent: IUINodeRenderer | null;
  del(child: IUINodeRenderer): void;
  add(child: IUINodeRenderer): void;
  del_self(): void;
  render(dt: number, df: number): void;

  on_start?(): void;
  on_resume(): void;
  on_show?(): void;
  on_hide?(): void;
  on_pause?(): void;
  on_stop?(): void;
  on_foucs?(): void;
  on_blur?(): void;
}