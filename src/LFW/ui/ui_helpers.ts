import type { IStyle } from "../defines/IStyle";
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

/** 覆盖节点文本样式（文本样式只存在节点上，直接合并进 node.style） */
export function paint(node: UINode | undefined, patch: Partial<IStyle>): void {
  if (!node?.text) return;
  const { style } = node;
  const data = style.data;
  if (!Object.keys(patch).some(key => data[key as keyof IStyle] !== patch[key as keyof IStyle])) return;
  style.assign(patch);
  // 样式变化可能影响文本尺寸；不清除 i18n 绑定
  node.refresh_text_layout();
}
