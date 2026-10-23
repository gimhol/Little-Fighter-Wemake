import { eval_number } from "../LFW/utils/eval_number";
import type { IDirectorData } from "../LFW/defines/IDirectorData";
import type { IXMLElement } from "../LFW/ditto/xml/IXMLElement";
import { supports_platform } from "../LFW/defines/Platform";
import { make_director_group, to_director_list } from "../LFW/loader/normalize_directors";
import {
  xml_2_director,
  xml_2_director_index,
  xml_to_directors,
  xml_x_director_index,
  xml_x_directors,
} from "../LFW/dat_translator/xml/xml_x_director";

class FakeElement {
  readonly tag: string;
  readonly children: FakeElement[] = [];
  readonly attrs: { name: string; value: string }[] = [];
  text = "";

  constructor(tag: string) {
    this.tag = tag;
  }
  attr(name: string): string | undefined {
    return this.attrs.find(v => v.name === name)?.value;
  }
  set_attr(name: string, value: unknown): void {
    const i = this.attrs.findIndex(v => v.name === name);
    if (value === void 0 || value === null) {
      if (i >= 0) this.attrs.splice(i, 1);
      return;
    }
    const text = Array.isArray(value) ? value.join(",") : String(value);
    if (i >= 0) this.attrs[i] = { name, value: text };
    else this.attrs.push({ name, value: text });
  }
  set_arr_attr_soft(name: string, value: unknown): void {
    if (!Array.isArray(value)) return this.set_attr(name, value);
    this.set_attr(name, value.map(v => (v === void 0 || v === null) ? "" : String(v)).join(","));
  }
  insert(child?: FakeElement): void {
    if (child) this.children.push(child);
  }
  set_text(text: string): void {
    this.text = text;
  }
  strs_attr(name: string): string[] | undefined {
    const v = this.attr(name);
    return v == null ? void 0 : v.split(",").map(s => s.trim());
  }
  nums_attr(name: string): number[] | undefined {
    const v = this.attr(name);
    return v == null ? void 0 : v.split(",").map(s => Number(s.trim()));
  }
  children_by_tag(tag: string): FakeElement[] {
    return this.children.filter(v => v.tag === tag);
  }
  child_by_tag(tag: string): FakeElement | undefined {
    return this.children.find(v => v.tag === tag);
  }
  to_element(): IXMLElement {
    return this as unknown as IXMLElement;
  }
}

const xml = {
  create: (tag: string) => new FakeElement(tag),
};

const DIRECTOR: IDirectorData = {
  name: "Sample",
  platform: ["godot", "web"],
  bg: "bg_4",
  stage: { player_r: 10 },
  actors: [
    {
      id: "jan",
      oid: "jan",
      count: 2,
      x: "midX",
      z: "midZ - 50",
      group: "fighters",
      ctrl: "local",
      player_id: "p_{i}",
      layout: { type: "line", axis: "x", length: "width - 120" },
      values: {
        team: ["1", "2"],
        hp: 50,
        as_key_role: false,
        name: ["A", "B"],
      },
    },
  ],
  groups: { fighters: ["jan"] },
  setup: [
    { op: "input", target: "jan", actions: [{ click: ["d", "U", "j"] }, { key_up: "all" }] },
  ],
  auto: [
    { target: "jan", when: { mp_gt: 100, state: "Standing" }, actions: [{ click: ["a"] }] },
  ],
  timeline: {
    times: 2,
    entries: [
      { after: 100, actions: [{ op: "camera", dest: [350, 0] }] },
      { wait: 500 },
      {
        repeat: 3,
        interval: 50,
        entries: [
          { actions: [{ op: "input", target: "@fighters", actions: [{ click: ["a"] }] }] },
        ],
      },
      {
        actions: [
          { op: "cycle", target: "@fighters", property: "team", values: ["1", "2", ""] },
          { op: "place", target: "jan", at: "jan", dx: -8, requires: "bearer" },
          { op: "pickup", target: "jan", weapon: "jan", if_empty: true },
          { op: "throw_spot", target: "jan", from: "jan" },
          { op: "reset" },
        ],
      },
    ],
  },
};

describe("eval_number", () => {
  const ctx = { midX: 500, midZ: 100, width: 1000 };
  it("evaluates plain numbers and expressions", () => {
    expect(eval_number(12, ctx)).toBe(12);
    expect(eval_number("midX - 50", ctx)).toBe(450);
    expect(eval_number("(midX + 10) * 2", ctx)).toBe(1020);
    expect(eval_number("width / 2", ctx)).toBe(500);
  });
  it("throws on unknown variables", () => {
    expect(() => eval_number("unknown + 1", ctx)).toThrow();
  });
});

describe("director xml", () => {
  it("round-trips director data through XML", () => {
    const root = xml_x_directors(xml as never, { id: "sample", name: "Sample Group", directors: [DIRECTOR] }) as unknown as FakeElement;
    const directors = xml_to_directors(root.to_element());
    const expected = JSON.parse(JSON.stringify(DIRECTOR));
    expected.groups.fighters = "jan";
    expect(directors).toEqual([expected]);
  });

  it("parses a single <director> element", () => {
    const el = new FakeElement("director");
    el.set_attr("name", "Only");
    el.set_attr("bg", "pixel_ruler");
    expect(xml_2_director(el.to_element())).toEqual({ name: "Only", bg: "pixel_ruler" });
  });

  it("parses the optional platform attribute", () => {
    const el = new FakeElement("director");
    el.set_attr("name", "Only");
    el.set_attr("platform", "godot");
    expect(xml_2_director(el.to_element())).toEqual({ name: "Only", platform: "godot" });
    el.set_attr("platform", "godot,web");
    expect(xml_2_director(el.to_element())).toEqual({ name: "Only", platform: ["godot", "web"] });
  });

  it("parses and serializes director index entries", () => {
    const el = xml_x_director_index(xml as never, { id: "misc", name: "Misc", file: "directors/00_misc.director.xml" }) as unknown as FakeElement;
    expect(xml_2_director_index(el.to_element())).toEqual({
      id: "misc",
      name: "Misc",
      file: "directors/00_misc.director.xml",
    });
  });
});

describe("supports_platform", () => {
  it("treats a missing platform as all platforms", () => {
    expect(supports_platform(undefined, "web")).toBe(true);
    expect(supports_platform(undefined, "godot")).toBe(true);
    expect(supports_platform(null, "godot")).toBe(true);
    expect(supports_platform("", "godot")).toBe(true);
  });

  it("accepts strings, arrays, commas and whitespace", () => {
    expect(supports_platform("web", "web")).toBe(true);
    expect(supports_platform("web", "godot")).toBe(false);
    expect(supports_platform("godot,web", "web")).toBe(true);
    expect(supports_platform("godot web", "web")).toBe(true);
    expect(supports_platform(["godot", "web"], "godot")).toBe(true);
    expect(supports_platform(["godot"], "web")).toBe(false);
  });
});
describe("director data normalization", () => {
  it("accepts {directors}, arrays and single objects", () => {
    expect(to_director_list({ directors: [{ name: "A" }] })).toEqual([{ name: "A" }]);
    expect(to_director_list([{ name: "A" }, { name: "B" }])).toEqual([{ name: "A" }, { name: "B" }]);
    expect(to_director_list({ name: "A" })).toEqual([{ name: "A" }]);
    expect(to_director_list({})).toEqual([]);
    expect(to_director_list(null)).toEqual([]);
  });

  it("wraps files into groups with index metadata", () => {
    const group = make_director_group(
      { id: "misc", name: "Misc", file: "directors/directors.index.json5" },
      { directors: [{ name: "A" }] },
    );
    expect(group).toEqual({
      id: "misc",
      name: "Misc",
      file: "directors/directors.index.json5",
      directors: [{ name: "A" }],
    });
  });
});
