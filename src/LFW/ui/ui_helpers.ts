import type { IStyle } from "../defines/IStyle";
import { Style } from "./Style";
import type { UINode } from "./UINode";

/** 按节点样式测量文本像素宽度（走注入的 ImageMgr，不直接碰宿主 DOM） */
export function measure_text_width(text: string, node?: UINode): number {
  if (!text || !node) return 0;
  let width = 0;
  for (const line of text.split("\n"))
    width = Math.max(width, node.lfw.images.measure_text(line, node.style).w ?? 0);
  return width;
}

/** 超出宽度时按像素截断并补省略号 */
export function fit_text(text: string, max_width: number, node?: UINode): string {
  if (!text || measure_text_width(text, node) <= max_width) return text;
  const chars = [...text];
  const ellipsis_width = measure_text_width("…", node);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const width = measure_text_width(chars.slice(0, mid).join(""), node);
    if (width + ellipsis_width <= max_width) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join("").trimEnd() + "…";
}

/** 覆盖节点文本样式（只重建发生变化的 Style） */
export function paint(node: UINode | undefined, patch: Partial<IStyle>): void {
  if (!node?.text) return;
  const src: Partial<IStyle> = node.text.style ?? {};
  if (!Object.keys(patch).some(key => src[key as keyof IStyle] !== patch[key as keyof IStyle])) return;
  const style = node.text.style instanceof Style ? node.text.style : new Style();
  if (!(node.text.style instanceof Style)) style.assign(src);
  style.assign(patch);
  node.set_text(node.text.text, style);
}
