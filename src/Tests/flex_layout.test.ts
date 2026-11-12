import {
  apply_flex_layout,
  compute_flex_layout,
  type IFlexContainerInput,
  type IFlexItemInput,
} from "../LFW/ui/flex_layout";
import type { IXMLElement } from "../LFW/ditto/xml/IXMLElement";
import { FlexStyle, normalize_flex_style, parse_flex_style } from "../LFW/ui/flex_style";
import type { UINode } from "../LFW/ui/UINode";
import { xml_to_ui_info } from "../LFW/ui/xml_to_ui_info";

type TStubChild = {
  self_visible: boolean;
  stretchable: boolean;
  flex: FlexStyle;
  w: number;
  h: number;
  x: number;
  y: number;
  z: number;
  cx: number;
  cy: number;
  resize(w: number, h: number): void;
  move_to(x: number, y: number, z: number): void;
};

function stub_child(over: Partial<TStubChild> = {}): TStubChild {
  const child: TStubChild = {
    self_visible: true,
    stretchable: false,
    flex: new FlexStyle(),
    w: 100,
    h: 20,
    x: 0,
    y: 0,
    z: 0,
    cx: 0,
    cy: 0,
    resize(w, h) { child.w = w; child.h = h; },
    move_to(x, y, z) { child.x = x; child.y = y; child.z = z; },
    ...over,
  };
  return child;
}

function stub_container(over: {
  flex: string;
  w?: number;
  h?: number;
  cx?: number;
  cy?: number;
  children?: TStubChild[];
}): UINode {
  const node = {
    flex: new FlexStyle(over.flex),
    w: over.w ?? 300,
    h: over.h ?? 100,
    cx: over.cx ?? 0,
    cy: over.cy ?? 0,
    children: over.children ?? [],
    resize(w: number, h: number) { node.w = w; node.h = h; },
  };
  return node as unknown as UINode;
}

function item(over: Partial<IFlexItemInput> = {}): IFlexItemInput {
  return {
    key: 0,
    width: 100,
    height: 20,
    grow: 0,
    shrink: 1,
    basis: "auto",
    align_self: "auto",
    order: 0,
    stretchable: false,
    ...over,
  };
}

function container(over: Partial<IFlexContainerInput> = {}): IFlexContainerInput {
  return {
    width: 300,
    height: 100,
    direction: "row",
    wrap: "nowrap",
    justify: "flex-start",
    align: "stretch",
    align_content: "stretch",
    row_gap: 0,
    col_gap: 0,
    padding: [0, 0, 0, 0],
    ...over,
  };
}

describe("compute_flex_layout", () => {
  test("row 默认从头排列", () => {
    const out = compute_flex_layout(container(), [item({ key: 0 }), item({ key: 1 })]);
    expect(out).toEqual([
      { key: 0, x: 0, y: 0, width: 100, height: 20 },
      { key: 1, x: 100, y: 0, width: 100, height: 20 },
    ]);
  });

  test("justify-content 各种对齐", () => {
    const items = [item({ key: 0, width: 50 }), item({ key: 1, width: 50 })];
    const xs = (justify: IFlexContainerInput["justify"]) =>
      compute_flex_layout(container({ justify }), items).map(v => v.x);

    expect(xs("flex-start")).toEqual([0, 50]);
    expect(xs("flex-end")).toEqual([200, 250]);
    expect(xs("center")).toEqual([100, 150]);
    expect(xs("space-between")).toEqual([0, 250]);
    expect(xs("space-around")).toEqual([50, 200]);

    const evenly = xs("space-evenly");
    expect(evenly[0]).toBeCloseTo(200 / 3);
    expect(evenly[1]).toBeCloseTo(200 / 3 + 50 + 200 / 3);
  });

  test("flex-grow 按比例分配剩余空间", () => {
    const out = compute_flex_layout(container(), [
      item({ key: 0, width: 50, grow: 1 }),
      item({ key: 1, width: 50, grow: 3 }),
    ]);
    expect(out[0].width).toBeCloseTo(100);
    expect(out[1].width).toBeCloseTo(200);
    expect(out[1].x).toBeCloseTo(100);
  });

  test("flex-shrink 按 basis 比例收缩", () => {
    const out = compute_flex_layout(container(), [
      item({ key: 0, width: 200 }),
      item({ key: 1, width: 200 }),
    ]);
    expect(out[0].width).toBeCloseTo(150);
    expect(out[1].x).toBeCloseTo(150);
  });

  test("column 主轴与 justify", () => {
    const out = compute_flex_layout(
      container({ direction: "column", height: 200, justify: "flex-end" }),
      [item({ key: 0, height: 40 }), item({ key: 1, height: 40 })]
    );
    expect(out[0]).toMatchObject({ x: 0, y: 120, width: 100, height: 40 });
    expect(out[1].y).toBeCloseTo(160);
  });

  test("align-items 控制交叉轴", () => {
    const center = compute_flex_layout(container({ align: "center" }), [item()]);
    expect(center[0].y).toBeCloseTo(40);

    const end = compute_flex_layout(container({ align: "flex-end" }), [item()]);
    expect(end[0].y).toBeCloseTo(80);

    const stretch = compute_flex_layout(container({ align: "stretch" }), [
      item({ stretchable: true }),
    ]);
    expect(stretch[0]).toMatchObject({ y: 0, height: 100 });
  });

  test("align-self 覆盖容器的 align-items", () => {
    const out = compute_flex_layout(
      container({ align: "flex-start" }),
      [item({ key: 0 }), item({ key: 1, align_self: "flex-end" })]
    );
    expect(out[0].y).toBe(0);
    expect(out[1].y).toBeCloseTo(80);
  });

  test("padding 从容器尺寸里扣除", () => {
    const out = compute_flex_layout(container({ padding: [10, 20, 30, 40], align: "center" }), [
      item({ key: 0, width: 200 }),
      item({ key: 1, width: 200 }),
    ]);
    expect(out[0].width).toBeCloseTo(120);
    expect(out[1].x).toBeCloseTo(120);
    expect(out[0].y).toBeCloseTo(20);
  });

  test("gap 作用于主轴，row-gap 作用于换行", () => {
    const row = compute_flex_layout(container({ col_gap: 10 }), [
      item({ key: 0 }),
      item({ key: 1 }),
    ]);
    expect(row[0].x).toBe(0);
    expect(row[1].x).toBe(110);

    const wrap = compute_flex_layout(
      container({ width: 250, wrap: "wrap", row_gap: 8, align_content: "flex-start" }),
      [
      item({ key: 0, height: 10 }),
      item({ key: 1, height: 10 }),
      item({ key: 2, height: 10 }),
    ]);
    expect(wrap.map(v => v.y)).toEqual([0, 0, 18]);
  });

  test("wrap 与 align-content 分布行", () => {
    const out = compute_flex_layout(
      container({ wrap: "wrap", align_content: "center", row_gap: 5 }),
      [
        item({ key: 0, width: 200, height: 10 }),
        item({ key: 1, width: 200, height: 10 }),
      ]
    );
    expect(out[0].y).toBeCloseTo(37.5);
    expect(out[1].y).toBeCloseTo(52.5);
  });

  test("wrap-reverse 翻转行顺序", () => {
    const out = compute_flex_layout(
      container({ wrap: "wrap-reverse", width: 200, align_content: "flex-start" }),
      [
        item({ key: 0, width: 200, height: 10 }),
        item({ key: 1, width: 200, height: 10 }),
      ]
    );
    expect(out.find(v => v.key === 0)!.y).toBeCloseTo(90);
    expect(out.find(v => v.key === 1)!.y).toBeCloseTo(80);
  });

  test("row-reverse 从尾部开始排列", () => {
    const out = compute_flex_layout(container({ direction: "row-reverse" }), [
      item({ key: 0 }),
      item({ key: 1 }),
    ]);
    expect(out.find(v => v.key === 0)!.x).toBeCloseTo(200);
    expect(out.find(v => v.key === 1)!.x).toBeCloseTo(100);
  });

  test("order 调整排列顺序", () => {
    const out = compute_flex_layout(container(), [
      item({ key: 0, order: 1 }),
      item({ key: 1, order: 0 }),
    ]);
    expect(out.find(v => v.key === 1)!.x).toBe(0);
    expect(out.find(v => v.key === 0)!.x).toBe(100);
  });

  test("flex-basis 覆盖主轴基准尺寸", () => {
    const out = compute_flex_layout(container(), [item({ width: 100, basis: 40 })]);
    expect(out[0].width).toBe(40);
  });

  test("空子项返回空结果", () => {
    expect(compute_flex_layout(container(), [])).toEqual([]);
  });

  test("入口页主菜单列布局", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      item({ key: i, width: 200, height: 22 })
    );
    const out = compute_flex_layout(
      container({
        width: 200,
        height: 130,
        direction: "column",
        justify: "center",
        align: "center",
        row_gap: 5,
        col_gap: 5,
      }),
      items
    );
    expect(out.map(v => v.y)).toEqual([0, 27, 54, 81, 108]);
    expect(out.every(v => v.x === 0 && v.width === 200 && v.height === 22)).toBe(true);
  });
});

describe("apply_flex_layout", () => {
  test("按内容盒原点与锚点换算子节点位置", () => {
    const a = stub_child({ w: 100, cx: 0 });
    const b = stub_child({ w: 100, cx: 0 });
    const container = stub_container({
      flex: "display:flex; direction:row",
      cx: 0.5,
      children: [a, b],
    });
    apply_flex_layout(container);
    expect(a.x).toBeCloseTo(-150);
    expect(b.x).toBeCloseTo(-50);
  });

  test("padding 参与内容盒偏移", () => {
    const child = stub_child({ w: 100 });
    const container = stub_container({
      flex: "display:flex; padding:8,16",
      children: [child],
    });
    apply_flex_layout(container);
    expect(child.x).toBeCloseTo(16);
    expect(child.y).toBeCloseTo(8);
  });

  test("子节点锚点影响落点", () => {
    const child = stub_child({ w: 100, cx: 0.5, cy: 0.5, h: 20 });
    const container = stub_container({
      flex: "display:flex; align:center",
      cx: 0.5,
      cy: 0.5,
      children: [child],
    });
    apply_flex_layout(container);
    expect(child.x).toBeCloseTo(-150 + 50);
    expect(child.y).toBeCloseTo(-50 + 40 + 10);
  });

  test("不可拉伸的子项不会被 stretch", () => {
    const child = stub_child({ h: 20 });
    const container = stub_container({ flex: "display:flex; align:stretch", children: [child] });
    apply_flex_layout(container);
    expect(child.h).toBe(20);
  });

  test("可拉伸的子项会被 stretch", () => {
    const child = stub_child({ h: 20, stretchable: true });
    const container = stub_container({ flex: "display:flex; align:stretch", children: [child] });
    apply_flex_layout(container);
    expect(child.h).toBeCloseTo(100);
  });

  test("不可见的子项不参与排列", () => {
    const hidden = stub_child({ self_visible: false, w: 100 });
    const shown = stub_child({ w: 100 });
    const container = stub_container({ flex: "display:flex", children: [hidden, shown] });
    apply_flex_layout(container);
    expect(hidden.x).toBe(0);
    expect(shown.x).toBe(0);
  });

  test("fit 收缩到内容尺寸", () => {
    const a = stub_child({ w: 100, h: 20 });
    const b = stub_child({ w: 80, h: 30 });
    const container = stub_container({
      flex: "display:flex; fit:true; gap:5",
      w: 500,
      h: 200,
      children: [a, b],
    });
    apply_flex_layout(container);
    expect(container.w).toBeCloseTo(185);
    expect(container.h).toBeCloseTo(30);
    expect(b.x).toBeCloseTo(105);
  });

  test("fit 在未设尺寸的容器上按内容撑开", () => {
    const a = stub_child({ w: 100, h: 20 });
    const b = stub_child({ w: 30, h: 20 });
    const container = stub_container({
      flex: "display:flex; align:start; fit:true",
      w: 0,
      h: 0,
      children: [a, b],
    });
    apply_flex_layout(container);
    expect(container.w).toBeCloseTo(130);
    expect(container.h).toBeCloseTo(20);
    expect(a.x).toBeCloseTo(0);
    expect(b.x).toBeCloseTo(100);
  });

  test("fit 子项不会被 stretch 拉伸", () => {
    const child = stub_child({ h: 20, stretchable: true });
    child.flex.fit_h = true;
    const container = stub_container({ flex: "display:flex; align:stretch", children: [child] });
    apply_flex_layout(container);
    expect(child.h).toBe(20);
  });

  test("stretch_force 强制拉伸不可拉伸的子项", () => {
    const child = stub_child({ h: 20 });
    child.flex.stretch_force = true;
    const container = stub_container({ flex: "display:flex; align:stretch", children: [child] });
    apply_flex_layout(container);
    expect(child.h).toBeCloseTo(100);
  });

  test("grow 参与真实节点换算", () => {
    const a = stub_child({ w: 100, flex: new FlexStyle({ grow: 1 }) });
    const b = stub_child({ w: 100, flex: new FlexStyle({ grow: 1 }) });
    const container = stub_container({ flex: "display:flex", children: [a, b] });
    apply_flex_layout(container);
    expect(a.w).toBeCloseTo(150);
    expect(b.x).toBeCloseTo(150);
  });
});

describe("XML 属性解析", () => {
  function element(
    tag: string,
    attrs: Record<string, string> = {},
    text = "",
    children: IXMLElement[] = [],
  ): IXMLElement {
    return {
      tag,
      children,
      attrs: [],
      text,
      parent: void 0,
      attr: (name: string) => attrs[name],
      nums_attr: () => void 0,
      as_object: () => ({}),
    } as unknown as IXMLElement;
  }

  function xml(attrs: Record<string, string>, children: IXMLElement[] = []): IXMLElement {
    return element("node", attrs, "", children);
  }

  test("flex 声明字符串", () => {
    const info = xml_to_ui_info(xml({ flex: "display:flex; gap:4" }));
    expect(info.flex).toBe("display:flex; gap:4");
  });

  test("拆成属性写", () => {
    const info = xml_to_ui_info(xml({
      display: "flex",
      direction: "column",
      gap: "6",
      align: "center",
      grow: "1",
    }));
    expect(info.flex).toEqual({
      display: "flex",
      direction: "column",
      gap: "6",
      align: "center",
      grow: "1",
    });
    const style = new FlexStyle(info.flex);
    expect(style.display).toBe("flex");
    expect(style.direction).toBe("column");
    expect(style.gap).toBe(6);
    expect(style.grow).toBe(1);
  });

  test("<flex> 子元素拆属性", () => {
    const info = xml_to_ui_info(xml({}, [
      element("flex", {
        display: "flex",
        direction: "column",
        gap: "6",
        fit: "true",
      }),
    ]));
    expect(info.flex).toEqual({
      display: "flex",
      direction: "column",
      gap: "6",
      fit: "true",
    });
    const style = new FlexStyle(info.flex);
    expect(style.display).toBe("flex");
    expect(style.direction).toBe("column");
    expect(style.gap).toBe(6);
    expect(style.fit).toBe(true);
  });

  test("<flex> 子元素文本声明", () => {
    const info = xml_to_ui_info(xml({}, [
      element("flex", {}, "display:flex; gap:4"),
    ]));
    expect(info.flex).toBe("display:flex; gap:4");
  });

  test("<flex> 子元素 properties", () => {
    const props = element("properties");
    (props as any).as_object = () => ({ direction: "column", gap: 6, fit: true });
    const info = xml_to_ui_info(xml({}, [
      element("flex", {}, "", [props]),
    ]));
    expect(info.flex).toEqual({ direction: "column", gap: 6, fit: true });
  });

  test("没有 flex 属性时为 undefined", () => {
    expect(xml_to_ui_info(xml({ id: "x" })).flex).toBeUndefined();
  });
});

describe("flex 声明解析", () => {
  test("字符串声明", () => {
    const style = new FlexStyle("display:flex; direction:column; gap:6; align:center; padding:4,8");
    expect(style.display).toBe("flex");
    expect(style.direction).toBe("column");
    expect(style.gap).toBe(6);
    expect(style.row_gap).toBe(6);
    expect(style.align).toBe("center");
    expect(style.padding).toEqual([4, 8, 4, 8]);
  });

  test("CSS 与简写键名都接受", () => {
    const data = parse_flex_style("display:flex; flex-direction:row-reverse; justify-content:space-between; align-items:flex-end");
    const style = new FlexStyle(data);
    expect(style.direction).toBe("row-reverse");
    expect(style.justify).toBe("space-between");
    expect(style.align).toBe("flex-end");
  });

  test("fit 声明", () => {
    const both = new FlexStyle("fit:true");
    expect(both.fit).toBe(true);
    expect(both.fit_w).toBe(true);
    expect(both.fit_h).toBe(true);

    const only_w = new FlexStyle("fit_w:1");
    expect(only_w.fit_w).toBe(true);
    expect(only_w.fit_h).toBe(false);
  });

  test("缺省值对齐 CSS", () => {
    const style = new FlexStyle();
    expect(style.display).toBe("block");
    expect(style.direction).toBe("row");
    expect(style.wrap).toBe("nowrap");
    expect(style.justify).toBe("flex-start");
    expect(style.align).toBe("stretch");
    expect(style.grow).toBe(0);
    expect(style.shrink).toBe(1);
    expect(style.basis).toBe("auto");
    expect(style.order).toBe(0);
  });

  test("非法值回退到默认", () => {
    const style = new FlexStyle({ display: "grid", direction: "diagonal", align: "middle" });
    expect(style.display).toBe("block");
    expect(style.direction).toBe("row");
    expect(style.align).toBe("stretch");
  });

  test("修改属性触发 on_change", () => {
    const style = new FlexStyle();
    let count = 0;
    style.on_change = () => count++;
    style.display = "flex";
    style.display = "flex";
    style.gap = 4;
    expect(count).toBe(2);
  });

  test("normalize_flex_style 补齐全部字段", () => {
    expect(normalize_flex_style("display:flex")).toMatchObject({
      display: "flex",
      direction: "row",
      wrap: "nowrap",
      justify: "flex-start",
      align: "stretch",
      align_content: "stretch",
      align_self: "auto",
      gap: 0,
      padding: [0, 0, 0, 0],
      grow: 0,
      shrink: 1,
      basis: "auto",
      order: 0,
    });
    expect(normalize_flex_style(void 0)).toBeUndefined();
  });
});
