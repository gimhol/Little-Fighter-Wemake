export function cover_scale(
  parent_w: number,
  parent_h: number,
  design_w: number,
  design_h: number,
): number {
  if (parent_w <= 0 || parent_h <= 0 || design_w <= 0 || design_h <= 0) return 1;
  return Math.max(parent_w / design_w, parent_h / design_h);
}
