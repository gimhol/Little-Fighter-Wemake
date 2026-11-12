import { merge_ui_template } from "../LFW/ui/cook_ui_info";

describe("merge_ui_template", () => {
  test("未定义的字段不覆盖模板字段", async () => {
    const lfw = {
      dev: false,
      resources: {
        import_json: async () => ({
          data: {
            id: "tpl",
            size: [794, 450],
            pos: [1, 449],
            center: [0, 1],
            i18n: "VERSION_NAME",
          },
        }),
      },
    } as any;

    const info = await merge_ui_template(lfw, {
      template: "tpl",
      alignment: { left: "left", bottom: "bottom" },
      id: void 0,
      size: void 0,
      pos: void 0,
      center: void 0,
      i18n: void 0,
    }, void 0);

    expect(info.id).toBe("tpl");
    expect(info.size).toEqual([794, 450]);
    expect(info.pos).toEqual([1, 449]);
    expect(info.center).toEqual([0, 1]);
    expect(info.i18n).toBe("VERSION_NAME");
    expect(info.alignment).toEqual({ left: "left", bottom: "bottom" });
  });
});
