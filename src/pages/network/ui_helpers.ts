import { Ditto, type INetworking, type IStyle } from "@/LFW";
import { Style } from "@/LFW/ui/Style";
import type { UINode } from "@/LFW/ui/UINode";

let measure_ctx: CanvasRenderingContext2D | undefined;

/** 当前联机连接；未连接（含断开后）返回 undefined */
export function net_connection(): INetworking | undefined {
  const conn = Ditto.Networking;
  return conn.opened ? conn : undefined;
}

/** 按节点字体测量文本像素宽度 */
export function measure_text_width(text: string, node?: UINode): number {
  if (!text) return 0;
  const ctx = (measure_ctx ??= document.createElement("canvas").getContext("2d")!);
  ctx.font = node?.style.font ?? "normal 9px system-ui";
  let width = 0;
  for (const line of text.split("\n")) width = Math.max(width, ctx.measureText(line).width);
  return width + 4;
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
