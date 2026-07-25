import type { INextFrame, TNextFrame } from "../defines";

export function edit_next_frame(
  nexts: TNextFrame | undefined | null,
  fn: (item: INextFrame, idx: number, arr: INextFrame[]) => void,
) {
  if (!nexts) return nexts;
  (Array.isArray(nexts) ? nexts : [nexts]).forEach(fn);
  return nexts;
}
export function add_next_frame(
  src: TNextFrame | undefined,
  ...items: INextFrame[]
): TNextFrame | undefined {
  if (!items.length) return src;

  if (Array.isArray(src)) {
    return [...src, ...items];
  } else if (src) {
    return [src, ...items];
  }
  return [...items];

}
