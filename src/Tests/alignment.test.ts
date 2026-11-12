import { apply_alignment, normalize_alignment, parse_alignment, parse_offset } from "../LFW/ui/alignment";
import type { IXMLElement } from "../LFW/ditto/xml/IXMLElement";
import { xml_to_ui_info } from "../LFW/ui/xml_to_ui_info";

function stub(over: Record<string, unknown> = {}): any {
  const node: any = {
    center: { x: 0, y: 0 },
    global_pos: { x: 0, y: 0, z: 0 },
    w: 100,
    h: 50,
    x: 0,
    y: 0,
    z: 0,
    cross: { left: 0, top: 0, right: 100, bottom: 50, mid_x: 50, mid_y: 25 },
    children: [],
    parent: undefined,
    move_to_global(x: number, y: number, z: number) {
      node.x = x;
      node.y = y;
      node.z = z;
      node.global_pos = { x, y, z };
    },
    resize(w: number, h: number) {
      node.w = w;
      node.h = h;
      node.cross = {
        left: -node.center.x * w,
        top: -node.center.y * h,
        right: (1 - node.center.x) * w,
        bottom: (1 - node.center.y) * h,
        mid_x: (w - 2 * node.center.x * w) / 2,
        mid_y: (h - 2 * node.center.y * h) / 2,
      };
    },
    ...over,
  };
  node.root = node.parent?.root ?? node;
  return node;
}

function parent(w: number, h: number): any {
  const node = stub({ w, h });
  node.cross = { left: 0, top: 0, right: w, bottom: h, mid_x: w / 2, mid_y: h / 2 };
  return node;
}

describe("normalize_alignment", () => {
  test("读取对齐、偏移、followed、once", () => {
    expect(normalize_alignment({
      left: "mid",
      top: "mid",
      followed: { l: "parent", t: "bro:+1" },
      offset: { t: -10 },
      once: true,
    })).toEqual({
      left: "mid",
      top: "mid",
      followed: { l: "parent", t: "bro:+1" },
      offset: { l: 0, r: 0, t: -10, b: 0 },
      once: true,
    });
  });

  test("没有对齐方向时返回 null", () => {
    expect(normalize_alignment({ offset: { l: 1 } })).toBeNull();
    expect(normalize_alignment(null)).toBeNull();
    expect(normalize_alignment("left:mid")).toBeNull();
  });
});

describe("parse_alignment", () => {
  test("CSS 声明字符串", () => {
    expect(parse_alignment("left:mid; top:top; offset:t:-80; followed:parent; once:true")).toEqual({
      left: "mid",
      top: "top",
      followed: "parent",
      offset: { l: 0, r: 0, t: -80, b: 0 },
      once: true,
    });
  });

  test("JSON 字符串", () => {
    expect(parse_alignment('{"left":"mid","top":"mid"}')).toEqual({
      left: "mid",
      top: "mid",
    });
  });

  test("偏移：命名、x/y、四边", () => {
    expect(parse_offset("0,-80")).toEqual({ l: 0, r: 0, t: -80, b: -80 });
    expect(parse_offset("l:10,t:-20")).toEqual({ l: 10, r: 0, t: -20, b: 0 });
    expect(parse_offset("1,2,3,4")).toEqual({ l: 1, r: 2, t: 3, b: 4 });
  });

  test("对象里的偏移字符串", () => {
    expect(parse_alignment({ left: "mid", offset: "0,-20" })).toEqual({
      left: "mid",
      offset: { l: 0, r: 0, t: -20, b: -20 },
    });
  });
});

describe("XML alignment", () => {
  function xml(attrs: Record<string, string>, children: IXMLElement[] = []): IXMLElement {
    return {
      tag: "node",
      children,
      attrs: [],
      text: "",
      parent: void 0,
      attr: (name: string) => attrs[name],
      nums_attr: () => void 0,
      as_object: () => ({}),
    } as unknown as IXMLElement;
  }

  test("alignment 属性", () => {
    const info = xml_to_ui_info(xml({
      alignment: "left:mid; top:top; offset:t:-80; followed:parent; once:true",
    }));
    expect(info.alignment).toEqual({
      left: "mid",
      top: "top",
      followed: "parent",
      offset: { l: 0, r: 0, t: -80, b: 0 },
      once: true,
    });
  });

  test("拆成 alignment_* 属性", () => {
    const info = xml_to_ui_info(xml({
      alignment_left: "mid",
      alignment_top: "top",
      alignment_offset: "l:10,t:-20",
      alignment_followed: "id:foo",
      alignment_once: "true",
    }));
    expect(info.alignment).toEqual({
      left: "mid",
      top: "top",
      followed: "id:foo",
      offset: { l: 10, r: 0, t: -20, b: 0 },
      once: true,
    });
  });

  test("没有 alignment 属性时为 undefined", () => {
    expect(xml_to_ui_info(xml({ id: "x" })).alignment).toBeUndefined();
  });

  test("alignment 子元素", () => {
    const alignment = {
      tag: "alignment",
      children: [],
      attrs: [],
      text: "",
      parent: void 0,
      attr: (name: string) => ({
        left: "mid",
        top: "top",
        offset: "0,-20",
      } as Record<string, string>)[name],
      nums_attr: () => void 0,
      as_object: () => ({}),
    } as unknown as IXMLElement;
    const info = xml_to_ui_info(xml({ id: "x" }, [alignment]));
    expect(info.alignment).toEqual({
      left: "mid",
      top: "top",
      offset: { l: 0, r: 0, t: -20, b: -20 },
    });
  });

  test("alignment 子元素 properties", () => {
    const props = {
      tag: "properties",
      children: [],
      attrs: [],
      text: "",
      parent: void 0,
      attr: () => void 0,
      nums_attr: () => void 0,
      as_object: () => ({
        left: "mid",
        top: "top",
        offset: "0,-20",
      }),
    } as unknown as IXMLElement;
    const alignment = {
      tag: "alignment",
      children: [props],
      attrs: [],
      text: "",
      parent: void 0,
      attr: () => void 0,
      nums_attr: () => void 0,
      as_object: () => ({}),
    } as unknown as IXMLElement;
    const info = xml_to_ui_info(xml({ id: "x" }, [alignment]));
    expect(info.alignment).toEqual({
      left: "mid",
      top: "top",
      offset: { l: 0, r: 0, t: -20, b: -20 },
    });
  });
});

describe("apply_alignment", () => {
  test("居中", () => {
    const root = parent(800, 450);
    const node = stub({ parent: root });
    expect(apply_alignment(node, { left: "mid", top: "mid" })).toBe(true);
    expect(node.x).toBe(350);
    expect(node.y).toBe(200);
  });

  test("右/下对齐与偏移", () => {
    const root = parent(800, 450);
    const node = stub({ parent: root });
    apply_alignment(node, {
      right: "right",
      bottom: "bottom",
      offset: { r: -10, b: 10 },
    });
    expect(node.x).toBe(690);
    expect(node.y).toBe(410);
  });

  test("左右/上下同时对齐时拉伸尺寸", () => {
    const root = parent(800, 450);
    const node = stub({ parent: root });
    apply_alignment(node, {
      left: "left",
      right: "right",
      top: "top",
      bottom: "bottom",
      offset: { l: 10, r: -10, t: 5, b: -5 },
    });
    expect(node.x).toBe(10);
    expect(node.y).toBe(5);
    expect(node.w).toBe(780);
    expect(node.h).toBe(440);
  });

  test("followed 兄弟节点", () => {
    const root = parent(800, 450);
    const a = stub({ parent: root, w: 50, global_pos: { x: 100, y: 0, z: 0 }, cross: {
      left: 0, top: 0, right: 50, bottom: 50, mid_x: 25, mid_y: 25,
    } });
    const b = stub({ parent: root });
    root.children.push(a, b);
    apply_alignment(b, { left: "right", top: "top", followed: "bro:0" });
    expect(b.x).toBe(150);
    expect(b.y).toBe(0);
  });
});
