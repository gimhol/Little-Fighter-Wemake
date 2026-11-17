import type { IXMLElement } from "../LFW/ditto/xml/IXMLElement";
import { xml_to_ui_info } from "../LFW/ui/xml_to_ui_info";

function attrs_of(values: Record<string, string>) {
  return Object.entries(values).map(([name, value]) => ({ name, value }));
}

function el(
  tag: string,
  values: Record<string, string> = {},
  children: IXMLElement[] = [],
  text = "",
  object?: object,
): IXMLElement {
  const node = {
    tag,
    attrs: attrs_of(values),
    children,
    text,
    parent: void 0,
    attr: (name: string) => values[name],
    nums_attr: (name: string, sep = ",") =>
      values[name] == null ? void 0 : values[name].split(sep).map((s) => Number(s.trim())),
    as_object: () => object,
    action_str: () => "",
  };
  return node as unknown as IXMLElement;
}

describe("xml_to_ui_info <attrs>", () => {
  test("内联属性与 <attrs> 子元素等价", () => {
    const inline = xml_to_ui_info(el("node", { id: "FOO", name: "bar" }));
    const nested = xml_to_ui_info(el("node", {}, [el("attrs", { id: "FOO", name: "bar" })]));
    expect(nested).toEqual(inline);
  });

  test("多个 <attrs> 依次合并", () => {
    const info = xml_to_ui_info(
      el("node", {}, [
        el("attrs", { id: "A", pos: "1,2" }),
        el("attrs", { name: "B", visible: "false" }),
      ]),
    );
    expect(info.id).toBe("A");
    expect(info.name).toBe("B");
    expect(info.pos).toEqual([1, 2]);
    expect(info.visible).toBe(false);
  });

  test("节点自身属性优先，<attrs> 之间后者覆盖前者", () => {
    const info = xml_to_ui_info(
      el("node", { id: "SELF" }, [
        el("attrs", { id: "A", name: "first", size: "1,2" }),
        el("attrs", { name: "second", size: "3,4" }),
      ]),
    );
    expect(info.id).toBe("SELF");
    expect(info.name).toBe("second");
    expect(info.size).toEqual([3, 4]);
  });

  test("<attrs> 不会被当成子节点或组件", () => {
    const info = xml_to_ui_info(
      el("node", {}, [
        el("attrs", { id: "A" }),
        el("node", { id: "child" }),
      ]),
    );
    expect(info.items?.length).toBe(1);
    expect((info.items?.[0] as { id?: string }).id).toBe("child");
    expect(info.component ?? []).toEqual([]);
  });

  test("<attrs> 支持 flex 简写属性", () => {
    const by_string = xml_to_ui_info(el("node", {}, [el("attrs", { flex: "display:flex; gap:4" })]));
    expect(by_string.flex).toBe("display:flex; gap:4");
    const by_attr = xml_to_ui_info(el("node", {}, [el("attrs", { display: "flex", gap: "4" })]));
    expect(by_attr.flex).toEqual({ display: "flex", gap: "4" });
  });

  test("<attrs> 支持 alignment 属性", () => {
    const info = xml_to_ui_info(el("node", {}, [el("attrs", { alignment: "left:0%; top:100%" })]));
    expect(info.alignment).toEqual({ left: "0%", top: "100%" });
  });
});

describe("xml_to_ui_info 多个 <flex> / <alignment>", () => {
  test("多个 <flex> 合并，后者覆盖前者", () => {
    const info = xml_to_ui_info(
      el("node", {}, [
        el("flex", { display: "flex", gap: "4" }),
        el("flex", { gap: "8", align: "center" }),
      ]),
    );
    expect(info.flex).toEqual({ display: "flex", gap: "8", align: "center" });
  });

  test("<flex> 字符串声明可与属性声明混写", () => {
    const info = xml_to_ui_info(
      el("node", {}, [
        el("flex", {}, [], "display:flex; gap:4"),
        el("flex", { align: "center" }),
      ]),
    );
    expect(info.flex).toEqual({ display: "flex", gap: "4", align: "center" });
  });

  test("单个 <flex> 保持原样（字符串仍是字符串）", () => {
    const info = xml_to_ui_info(el("node", {}, [el("flex", {}, [], "display:flex")]));
    expect(info.flex).toBe("display:flex");
  });

  test("多个 <alignment> 合并四边", () => {
    const info = xml_to_ui_info(
      el("node", {}, [
        el("alignment", { left: "0%", top: "0%" }),
        el("alignment", { right: "100%", bottom: "100%" }),
      ]),
    );
    expect(info.alignment).toEqual({ left: "0%", top: "0%", right: "100%", bottom: "100%" });
  });

  test("alignment 属性与子元素合并", () => {
    const info = xml_to_ui_info(
      el("node", { alignment: "left:0%" }, [el("alignment", { top: "50%" })]),
    );
    expect(info.alignment).toEqual({ left: "0%", top: "50%" });
  });

  test("同一侧后者覆盖，offset 整体替换", () => {
    const info = xml_to_ui_info(
      el("node", {}, [
        el("alignment", { left: "0%", offset: "l:10" }),
        el("alignment", { left: "50%", offset: "t:-5" }),
      ]),
    );
    expect(info.alignment).toEqual({ left: "50%", offset: { l: 0, r: 0, t: -5, b: 0 } });
  });
});

describe("xml_to_ui_info 多个 <style>", () => {
  test("多个 <style> 合并，后者覆盖前者", () => {
    const info = xml_to_ui_info(
      el("node", {}, [
        el("style", { fill_style: "white", font: "12px Arial" }, [], "", {
          fill_style: "white",
          font: "12px Arial",
        }),
        el("style", { font: "14px Arial", line_width: "2" }, [], "", {
          font: "14px Arial",
          line_width: "2",
        }),
      ]),
    );
    expect(info.style).toEqual({ fill_style: "white", font: "14px Arial", line_width: 2 });
  });

  test("单个 <style> 的数值/布尔属性仍转型", () => {
    const info = xml_to_ui_info(
      el("node", {}, [
        el("style", { line_width: "2", smoothing: "true" }, [], "", {
          line_width: "2",
          smoothing: "true",
        }),
      ]),
    );
    expect(info.style).toEqual({ line_width: 2, smoothing: true });
  });

  test("空 <style/> 不产生 style", () => {
    const info = xml_to_ui_info(el("node", {}, [el("style")]));
    expect(info.style).toBeUndefined();
  });
});
