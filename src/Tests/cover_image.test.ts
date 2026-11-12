import { cover_scale } from "../LFW/ui/cover_scale";

describe("cover_scale", () => {
  test("宽屏按宽度铺满", () => {
    expect(cover_scale(950, 450, 794, 450)).toBeCloseTo(950 / 794);
  });

  test("高屏按高度铺满", () => {
    expect(cover_scale(794, 596, 794, 450)).toBeCloseTo(596 / 450);
  });

  test("设计尺寸匹配时为 1", () => {
    expect(cover_scale(794, 450, 794, 450)).toBe(1);
  });

  test("非法尺寸回退到 1", () => {
    expect(cover_scale(0, 450, 794, 450)).toBe(1);
  });
});
