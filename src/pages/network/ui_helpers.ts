import type { IStyle, LFW } from "@/LFW";
import { Style } from "@/LFW/ui/Style";
import type { UINode } from "@/LFW/ui/UINode";

let measure_ctx: CanvasRenderingContext2D | undefined;

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

/** 按钮的 hover / press / click 反馈 */
export function bind_button(
  lfw: LFW,
  node: UINode | undefined,
  fn: () => void,
  sound: "ok" | "cancel" = "ok",
): void {
  if (!node) return;
  const hover_fill = "#eaf1ff";
  const hover_underline_color = "#ffffff";
  let hovered = false;
  let pressed = false;
  let fill: string | undefined;
  let underline_color: string | undefined;
  let underline_width: number | undefined;
  let sx = 1;
  let sy = 1;
  let sz = 1;
  const capture = (): void => {
    const style = node.text?.style;
    fill = style?.fill_style;
    underline_color = style?.underline_color;
    underline_width = style?.underline_width;
  };
  const restore = (): void => {
    if (!hovered) return;
    hovered = false;
    pressed = false;
    paint(node, { fill_style: fill, underline_color, underline_width });
    node.set_scale(sx, sy, sz);
  };
  node.callbacks.add({
    on_pointer_enter: () => {
      if (node.disabled || hovered) return;
      hovered = true;
      capture();
      sx = node.scale.x;
      sy = node.scale.y;
      sz = node.scale.z;
      paint(node, {
        fill_style: hover_fill,
        underline_color: hover_underline_color,
        underline_width: 2,
      });
      node.set_scale(sx * 1.06, sy * 1.06, sz);
    },
    on_pointer_leave: restore,
    on_hide: restore,
    on_pointer_cancel: restore,
    on_pointer_down: () => {
      if (node.disabled) return;
      pressed = true;
      node.set_scale(sx * 0.96, sy * 0.96, sz);
    },
    on_pointer_up: () => {
      if (!pressed) return;
      pressed = false;
      node.set_scale(hovered ? sx * 1.06 : sx, hovered ? sy * 1.06 : sy, sz);
    },
    on_click: () => {
      if (node.disabled) return;
      lfw.sounds.play_preset(sound);
      fn();
      if (!hovered) return;
      const style = node.text?.style;
      if (style?.fill_style !== hover_fill) fill = style?.fill_style;
      if (style?.underline_color !== hover_underline_color || style?.underline_width !== 2) {
        underline_color = style?.underline_color;
        underline_width = style?.underline_width;
      }
    },
  });
}
