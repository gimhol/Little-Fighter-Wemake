import { Defines } from "../LFW/defines/defines";

describe("viewport_from_aspect", () => {
  test("16:9 不裁安全区，只向右扩一点", () => {
    expect(Defines.viewport_from_aspect(16 / 9)).toEqual({ w: 800, h: 450 });
  });
  test("4:3 只向上扩", () => {
    expect(Defines.viewport_from_aspect(4 / 3)).toEqual({ w: 794, h: 596 });
  });
  test("21:9 只向左右扩", () => {
    const vp = Defines.viewport_from_aspect(21 / 9);
    expect(vp).toEqual({ w: 1050, h: 450 });
  });
  test("任意比例下安全区都完整可见", () => {
    for (const aspect of [0.6, 1, 4 / 3, 1.6, 16 / 9, 2.33, 3]) {
      const vp = Defines.viewport_from_aspect(aspect);
      expect(vp.w).toBeGreaterThanOrEqual(Defines.SAFE_SCREEN_WIDTH);
      expect(vp.h).toBeGreaterThanOrEqual(Defines.SAFE_SCREEN_HEIGHT);
      expect(vp.w / vp.h).toBeCloseTo(aspect, 1);
    }
  });
});

describe("parse_aspect", () => {
  test("支持 a:b / a/b / 小数", () => {
    expect(Defines.parse_aspect("16:9")).toBeCloseTo(16 / 9);
    expect(Defines.parse_aspect("21/9")).toBeCloseTo(21 / 9);
    expect(Defines.parse_aspect("1.5")).toBeCloseTo(1.5);
  });
  test("非法值返回 undefined", () => {
    expect(Defines.parse_aspect("")).toBeUndefined();
    expect(Defines.parse_aspect("abc")).toBeUndefined();
    expect(Defines.parse_aspect(undefined)).toBeUndefined();
    expect(Defines.parse_aspect("10:0")).toBeUndefined();
    expect(Defines.parse_aspect("0.1:1")).toBeUndefined();
    expect(Defines.parse_aspect("5:1")).toBeUndefined();
  });
});
