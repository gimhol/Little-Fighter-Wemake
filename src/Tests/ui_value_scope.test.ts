import { find_ui_value, parse_ui_value, type IUIValueScope } from "../LFW/ui/read_info_value";

describe("$val 解析作用域", () => {
  test("不依赖 cook 产物，普通对象也能沿 parent 链查找", () => {
    const root: IUIValueScope = {
      values: { color: "white", size: 12 },
      template_values: { from_template: "tpl" },
    };
    const child: IUIValueScope = { parent: root };

    expect(parse_ui_value(child, null, "$val:color")).toBe("white");
    expect(parse_ui_value(child, null, "$val:size")).toBe(12);
    expect(parse_ui_value(child, null, "$val:from_template")).toBe("tpl");
  });

  test("节点自身的值优先于父链", () => {
    const root: IUIValueScope = { values: { color: "white" } };
    const child: IUIValueScope = { values: { color: "pink" }, parent: root };

    expect(find_ui_value(child, "color")).toBe("pink");
    expect(parse_ui_value(child, null, "$val:color")).toBe("pink");
  });

  test("找不到时返回 null", () => {
    const child: IUIValueScope = { values: {} };
    expect(find_ui_value(child, "missing")).toBeNull();
    expect(parse_ui_value(child, null, "$val:missing")).toBeNull();
  });
});
