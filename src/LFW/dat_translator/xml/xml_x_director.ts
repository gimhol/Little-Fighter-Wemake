import type {
  IActorData,
  IAutoRuleData,
  IAutoWhenData,
  ICameraActionData,
  ICmdActionData,
  ICycleActionData,
  IDirectorTimelineData,
  IFaceActionData,
  IInputActionData,
  IKeyStepData,
  IMoveActionData,
  IPickupActionData,
  IPlaceActionData,
  ISetActionData,
  IStageActionData,
  IDirectorData,
  IDirectorGroupData,
  IDirectorStageData,
  ILineLayoutData,
  ICircleLayoutData,
  IThrowSpotActionData,
  IVelocityActionData,
  IBgActionData,
  IFrameActionData,
  TActionData,
  TLayoutData,
  TNumberExpr,
  TSelectors,
  TTimelineEntryData,
} from "../../defines/IDirectorData";
import type { IDirectorIndex } from "../../defines/IDirectorIndex";
import type { LGK } from "../../defines/GameKey";
import type { IXML, IXMLElement } from "../../ditto/xml";

function attr(el: IXMLElement, name: string): string | undefined {
  const v = el.attr(name);
  return v == null ? void 0 : v;
}

function num_attr(el: IXMLElement, name: string): number | undefined {
  const v = el.attr(name);
  if (v == null || v.trim() === "") return void 0;
  const num = Number(v);
  return Number.isNaN(num) ? void 0 : num;
}

function bool_attr(el: IXMLElement, name: string): boolean | undefined {
  const v = el.attr(name);
  if (v == null) return void 0;
  return v === "true" || v === "1";
}

function str_or_strs(el: IXMLElement, name: string): string | string[] | undefined {
  const list = el.strs_attr(name);
  if (!list) return void 0;
  return list.length > 1 ? list : list[0];
}

function expr_attr(el: IXMLElement, name: string): TNumberExpr | undefined {
  const raw = attr(el, name);
  if (raw == null) return void 0;
  const text = raw.trim();
  return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : raw;
}

function to_expr(raw: string): TNumberExpr {
  const text = raw.trim();
  return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : raw;
}

function parse_literal(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parse_values(el: IXMLElement | undefined): Record<string, unknown> | undefined {
  if (!el) return void 0;
  const ret: Record<string, unknown> = {};
  const json = attr(el, "json");
  if (json != null) Object.assign(ret, parse_literal(json));
  for (const { name, value } of el.attrs) {
    if (name === "json") continue;
    ret[name] = parse_literal(value);
  }
  for (const child of el.children_by_tag("value")) {
    const parsed = parse_value(child);
    if (parsed) ret[parsed[0]] = parsed[1];
  }
  return Object.keys(ret).length ? ret : void 0;
}

function parse_value(el: IXMLElement): [string, unknown] | undefined {
  const name = attr(el, "name");
  if (!name) return void 0;
  const type = (attr(el, "type") ?? "str").toLowerCase();
  const raw = attr(el, "value") ?? el.text;
  switch (type) {
    case "num":
      return [name, Number(raw)];
    case "bool":
      return [name, raw === "true" || raw === "1"];
    case "strs":
      return [name, el.strs_attr("value") ?? (el.text ? el.text.split(",") : [])];
    case "nums":
      return [name, el.nums_attr("value") ?? (el.text ? el.text.split(",").map(Number) : [])];
    case "json":
      return [name, parse_literal(el.text || raw || "null")];
    default:
      return [name, raw ?? ""];
  }
}

function parse_keys(el: IXMLElement, name: string): LGK[] | "all" | undefined {
  const raw = attr(el, name);
  if (raw == null) return void 0;
  if (name === "key_up" && raw.trim() === "all") return "all";
  const keys = raw.split(",").map(v => v.trim()).filter(Boolean) as LGK[];
  return keys.length ? keys : void 0;
}

function parse_key_steps(el: IXMLElement): IKeyStepData[] {
  const ret: IKeyStepData[] = [];
  const own = parse_key_step_attrs(el);
  if (own) ret.push(own);
  for (const child of el.children_by_tag("step")) {
    const step = parse_key_step_attrs(child);
    if (step) ret.push(step);
  }
  return ret;
}

function parse_key_step_attrs(el: IXMLElement): IKeyStepData | undefined {
  const step: IKeyStepData = {};
  const click = parse_keys(el, "click") as LGK[] | undefined;
  const dbl_click = parse_keys(el, "dbl_click") as LGK[] | undefined;
  const db_hit = parse_keys(el, "db_hit") as LGK[] | undefined;
  const key_down = parse_keys(el, "key_down") as LGK[] | undefined;
  const key_up = parse_keys(el, "key_up");
  if (click) step.click = click;
  if (dbl_click) step.dbl_click = dbl_click;
  if (db_hit) step.db_hit = db_hit;
  if (key_down) step.key_down = key_down;
  if (key_up) step.key_up = key_up;
  return Object.keys(step).length ? step : void 0;
}

function parse_target(el: IXMLElement): TSelectors | undefined {
  return str_or_strs(el, "target");
}

function parse_pair(el: IXMLElement, name: string): [TNumberExpr, TNumberExpr] | undefined {
  const list = el.strs_attr(name);
  if (!list || list.length < 2) return void 0;
  return [to_expr(list[0]), to_expr(list[1])];
}

function parse_layout(el: IXMLElement | undefined): TLayoutData | undefined {
  if (!el) return void 0;
  const type = attr(el, "type") ?? "point";
  if (type === "line") {
    const ret: ILineLayoutData = { type: "line" };
    const axis = attr(el, "axis");
    if (axis === "x" || axis === "z") ret.axis = axis;
    const x = expr_attr(el, "x"); if (x != null) ret.x = x;
    const y = expr_attr(el, "y"); if (y != null) ret.y = y;
    const z = expr_attr(el, "z"); if (z != null) ret.z = z;
    const length = expr_attr(el, "length"); if (length != null) ret.length = length;
    return ret;
  }
  if (type === "circle") {
    const ret: ICircleLayoutData = { type: "circle" };
    const x = expr_attr(el, "x"); if (x != null) ret.x = x;
    const y = expr_attr(el, "y"); if (y != null) ret.y = y;
    const z = expr_attr(el, "z"); if (z != null) ret.z = z;
    const radius = expr_attr(el, "radius"); if (radius != null) ret.radius = radius;
    const rx = expr_attr(el, "rx"); if (rx != null) ret.rx = rx;
    const rz = expr_attr(el, "rz"); if (rz != null) ret.rz = rz;
    return ret;
  }
  return { type: "point" };
}

function xml_2_actor(el: IXMLElement): IActorData {
  const ret: IActorData = { id: attr(el, "id") ?? "" };
  const oid = str_or_strs(el, "oid");
  if (oid != null) ret.oid = oid;
  const source = attr(el, "source");
  if (source === "fighters") ret.source = source;
  const half = attr(el, "half");
  if (half === "first" || half === "second") ret.half = half;
  const count = num_attr(el, "count"); if (count != null) ret.count = count;
  const at = attr(el, "at"); if (at != null) ret.at = at;
  const x = expr_attr(el, "x"); if (x != null) ret.x = x;
  const y = expr_attr(el, "y"); if (y != null) ret.y = y;
  const z = expr_attr(el, "z"); if (z != null) ret.z = z;
  const dx = expr_attr(el, "dx"); if (dx != null) ret.dx = dx;
  const dy = expr_attr(el, "dy"); if (dy != null) ret.dy = dy;
  const dz = expr_attr(el, "dz"); if (dz != null) ret.dz = dz;
  const group = str_or_strs(el, "group"); if (group != null) ret.group = group;
  const ctrl = attr(el, "ctrl");
  if (ctrl === "local" || ctrl === "bot" || ctrl === "invalid") ret.ctrl = ctrl;
  const player_id = attr(el, "player_id"); if (player_id != null) ret.player_id = player_id;
  const attach = bool_attr(el, "attach"); if (attach != null) ret.attach = attach;

  const layout = parse_layout(el.child_by_tag("layout"));
  if (layout) ret.layout = layout;
  const values = parse_values(el.child_by_tag("values"));
  if (values) ret.values = values;
  return ret;
}

function parse_groups(el: IXMLElement | undefined): Record<string, TSelectors> | undefined {
  if (!el) return void 0;
  const ret: Record<string, TSelectors> = {};
  for (const child of el.children_by_tag("group")) {
    const name = attr(child, "name");
    if (!name) continue;
    ret[name] = str_or_strs(child, "actors") ?? [];
  }
  return Object.keys(ret).length ? ret : void 0;
}

const STAGE_NUMBER_KEYS = [
  "left",
  "right",
  "near",
  "far",
  "width",
  "depth",
  "player_l",
  "player_r",
  "cam_l",
  "cam_r",
  "enemy_l",
  "enemy_r",
  "drink_l",
  "drink_r",
  "phase_time",
  "dialog_time",
] as const;

function parse_stage(el: IXMLElement | undefined): IDirectorStageData | undefined {
  if (!el) return void 0;
  const ret: IDirectorStageData = {};
  for (const key of STAGE_NUMBER_KEYS) {
    const num = num_attr(el, key);
    if (num != null) ret[key] = num;
  }
  return Object.keys(ret).length ? ret : void 0;
}

function parse_actions(parent: IXMLElement | undefined): TActionData[] | undefined {
  if (!parent) return void 0;
  const ret: TActionData[] = [];
  for (const child of parent.children) {
    const action = xml_2_action(child);
    if (action) ret.push(action);
  }
  return ret.length ? ret : void 0;
}

function xml_2_action(el: IXMLElement): TActionData | undefined {
  switch (el.tag) {
    case "input": {
      const target = parse_target(el);
      if (!target) return void 0;
      const ret: IInputActionData = { op: "input", target, actions: parse_key_steps(el) };
      return ret;
    }
    case "set": {
      const target = parse_target(el);
      const values = parse_values(el.child_by_tag("values"));
      if (!target || !values) return void 0;
      const ret: ISetActionData = { op: "set", target, values };
      return ret;
    }
    case "camera": {
      const ret: ICameraActionData = { op: "camera" };
      const dest = parse_pair(el, "dest"); if (dest) ret.dest = dest;
      const lock = parse_pair(el, "lock"); if (lock) ret.lock = lock;
      const undest = bool_attr(el, "undest"); if (undest != null) ret.undest = undest;
      const unlock = bool_attr(el, "unlock"); if (unlock != null) ret.unlock = unlock;
      return ret;
    }
    case "cmd": {
      const name = attr(el, "name") ?? attr(el, "cmd");
      if (!name) return void 0;
      const ret: ICmdActionData = { op: "cmd", name };
      const args = el.strs_attr("args"); if (args) ret.args = args;
      return ret;
    }
    case "bg": {
      const id = attr(el, "id") ?? attr(el, "bg");
      if (!id) return void 0;
      const ret: IBgActionData = { op: "bg", id };
      return ret;
    }
    case "stage": {
      const values = parse_stage(el);
      if (!values) return void 0;
      const ret: IStageActionData = { op: "stage", values };
      return ret;
    }
    case "place": {
      const target = parse_target(el);
      const at = attr(el, "at");
      if (!target || at == null) return void 0;
      const ret: IPlaceActionData = { op: "place", target, at };
      const dx = expr_attr(el, "dx"); if (dx != null) ret.dx = dx;
      const dy = expr_attr(el, "dy"); if (dy != null) ret.dy = dy;
      const dz = expr_attr(el, "dz"); if (dz != null) ret.dz = dz;
      const requires = attr(el, "requires"); if (requires != null) ret.requires = requires;
      return ret;
    }
    case "move": {
      const target = parse_target(el);
      if (!target) return void 0;
      const ret: IMoveActionData = { op: "move", target };
      const dx = expr_attr(el, "dx"); if (dx != null) ret.dx = dx;
      const dy = expr_attr(el, "dy"); if (dy != null) ret.dy = dy;
      const dz = expr_attr(el, "dz"); if (dz != null) ret.dz = dz;
      return ret;
    }
    case "face": {
      const target = parse_target(el);
      const at = attr(el, "at");
      if (!target || at == null) return void 0;
      const ret: IFaceActionData = { op: "face", target, at };
      return ret;
    }
    case "velocity": {
      const target = parse_target(el);
      if (!target) return void 0;
      const ret: IVelocityActionData = { op: "velocity", target };
      for (const key of ["x", "y", "z"] as const) {
        const raw = attr(el, key);
        if (raw == null) continue;
        ret[key] = raw.trim() === "null" ? null : to_expr(raw);
      }
      return ret;
    }
    case "frame": {
      const target = parse_target(el);
      const id = attr(el, "id") ?? attr(el, "frame");
      if (!target || id == null) return void 0;
      const ret: IFrameActionData = { op: "frame", target, id };
      return ret;
    }
    case "pickup": {
      const target = parse_target(el);
      const weapon = attr(el, "weapon");
      if (!target || weapon == null) return void 0;
      const ret: IPickupActionData = { op: "pickup", target, weapon };
      const if_empty = bool_attr(el, "if_empty"); if (if_empty != null) ret.if_empty = if_empty;
      return ret;
    }
    case "cycle": {
      const target = parse_target(el);
      const property = attr(el, "property");
      if (!target || property == null) return void 0;
      const json = attr(el, "json");
      const ret: ICycleActionData = {
        op: "cycle",
        target,
        property,
        values: json != null ? parse_literal(json) as unknown[] : el.strs_attr("values") ?? [],
      };
      return ret;
    }
    case "throw_spot": {
      const target = attr(el, "target");
      const from = attr(el, "from");
      if (target == null || from == null) return void 0;
      const ret: IThrowSpotActionData = { op: "throw_spot", target, from };
      return ret;
    }
    case "reset":
      return { op: "reset" };
    default:
      return void 0;
  }
}

function xml_2_auto(el: IXMLElement): IAutoRuleData | undefined {
  const target = parse_target(el);
  if (!target) return void 0;
  const when: IAutoWhenData = {};
  const state = str_or_strs(el, "state"); if (state != null) when.state = state;
  const state_not = str_or_strs(el, "state_not"); if (state_not != null) when.state_not = state_not;
  const mp_gt = num_attr(el, "mp_gt"); if (mp_gt != null) when.mp_gt = mp_gt;
  const frame_hit = attr(el, "frame_hit"); if (frame_hit != null) when.frame_hit = frame_hit;
  const ret: IAutoRuleData = { target, actions: parse_key_steps(el) };
  if (Object.keys(when).length) ret.when = when;
  return ret;
}

function parse_timeline_entries(parent: IXMLElement): TTimelineEntryData[] {
  const ret: TTimelineEntryData[] = [];
  for (const el of parent.children_by_tag("entry")) {
    const wait = num_attr(el, "wait");
    if (wait != null) {
      ret.push({ wait });
      continue;
    }
    const repeat = num_attr(el, "repeat");
    const interval = num_attr(el, "interval");
    if (repeat != null && interval != null) {
      ret.push({ repeat, interval, entries: parse_timeline_entries(el) });
      continue;
    }
    const entry: { after?: number; actions?: TActionData[] } = {};
    const after = num_attr(el, "after"); if (after != null) entry.after = after;
    const actions = parse_actions(el); if (actions) entry.actions = actions;
    ret.push(entry);
  }
  return ret;
}

function xml_2_director_timeline(el: IXMLElement | undefined): IDirectorTimelineData | undefined {
  if (!el) return void 0;
  const ret: IDirectorTimelineData = { entries: parse_timeline_entries(el) };
  const times = num_attr(el, "times"); if (times != null) ret.times = times;
  return ret;
}

export function xml_2_director(el: IXMLElement): IDirectorData {
  const ret: IDirectorData = { name: attr(el, "name") ?? "" };
  const platform = str_or_strs(el, "platform"); if (platform != null) ret.platform = platform;
  const bg = attr(el, "bg"); if (bg != null) ret.bg = bg;
  const stage = parse_stage(el.child_by_tag("stage")); if (stage) ret.stage = stage;
  const actors_el = el.child_by_tag("actors");
  if (actors_el) {
    const actors = actors_el.children_by_tag("actor").map(xml_2_actor);
    if (actors.length) ret.actors = actors;
  }
  const groups = parse_groups(el.child_by_tag("groups")); if (groups) ret.groups = groups;
  const setup = parse_actions(el.child_by_tag("setup")); if (setup) ret.setup = setup;
  const autos = el.children_by_tag("auto").map(xml_2_auto).filter((v): v is IAutoRuleData => !!v);
  if (autos.length) ret.auto = autos;
  const director = xml_2_director_timeline(el.child_by_tag("timeline")); if (director) ret.timeline = director;
  return ret;
}

export function xml_to_directors(el: IXMLElement): IDirectorData[] {
  if (el.tag === "director") return [xml_2_director(el)];
  return el.children_by_tag("director").map(xml_2_director);
}

export function xml_2_director_index(el: IXMLElement): IDirectorIndex {
  const ret: IDirectorIndex = {
    id: attr(el, "id") ?? "",
    file: attr(el, "file") ?? "",
  };
  const name = attr(el, "name"); if (name != null) ret.name = name;
  const skipped = attr(el, "skipped"); if (skipped != null) ret.skipped = skipped;
  return ret;
}

export function xml_x_director_index(xml: IXML, index: IDirectorIndex, tag: string = "directors"): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("id", index.id);
  el.set_attr("file", index.file);
  el.set_attr("name", index.name);
  el.set_attr("skipped", index.skipped);
  return el;
}

function set_expr_attrs(el: IXMLElement, data: object, names: string[]): void {
  const record = data as Record<string, unknown>;
  for (const name of names) {
    const value = record[name] as TNumberExpr | undefined;
    if (value != null) el.set_attr(name, String(value));
  }
}

function xml_x_value(xml: IXML, name: string, value: unknown): IXMLElement {
  const el = xml.create("value");
  el.set_attr("name", name);
  if (typeof value === "boolean") {
    el.set_attr("type", "bool");
    el.set_attr("value", value);
  } else if (typeof value === "number") {
    el.set_attr("type", "num");
    el.set_attr("value", value);
  } else if (typeof value === "string") {
    el.set_attr("type", "str");
    el.set_attr("value", value);
  } else if (Array.isArray(value) && value.every(v => typeof v === "number")) {
    el.set_attr("type", "nums");
    el.set_attr("value", value as number[]);
  } else if (
    Array.isArray(value) &&
    value.every(v => typeof v === "string") &&
    !value.some(v => v.includes(","))
  ) {
    el.set_attr("type", "strs");
    el.set_arr_attr_soft("value", value as string[]);
  } else {
    el.set_attr("type", "json");
    el.set_text(JSON.stringify(value));
  }
  return el;
}

function xml_x_values(xml: IXML, values: Record<string, unknown>, parent: IXMLElement): void {
  const el = xml.create("values");
  for (const [name, value] of Object.entries(values)) {
    if (value === void 0) continue;
    el.insert(xml_x_value(xml, name, value));
  }
  parent.insert(el);
}

function xml_x_key_step_attrs(el: IXMLElement, step: IKeyStepData): void {
  if (step.click) el.set_attr("click", step.click);
  if (step.dbl_click) el.set_attr("dbl_click", step.dbl_click);
  if (step.db_hit) el.set_attr("db_hit", step.db_hit);
  if (step.key_down) el.set_attr("key_down", step.key_down);
  if (step.key_up) el.set_attr("key_up", step.key_up);
}

function xml_x_key_steps(xml: IXML, steps: IKeyStepData[], parent: IXMLElement): void {
  for (const step of steps) {
    const el = xml.create("step");
    xml_x_key_step_attrs(el, step);
    parent.insert(el);
  }
}

function xml_x_action(xml: IXML, action: TActionData): IXMLElement | undefined {
  switch (action.op) {
    case "input": {
      const el = xml.create("input");
      el.set_attr("target", action.target);
      if (action.actions.length === 1) xml_x_key_step_attrs(el, action.actions[0]);
      else xml_x_key_steps(xml, action.actions, el);
      return el;
    }
    case "set": {
      const el = xml.create("set");
      el.set_attr("target", action.target);
      xml_x_values(xml, action.values, el);
      return el;
    }
    case "camera": {
      const el = xml.create("camera");
      if (action.dest) el.set_attr("dest", action.dest.map(String));
      if (action.lock) el.set_attr("lock", action.lock.map(String));
      if (action.undest != null) el.set_attr("undest", action.undest);
      if (action.unlock != null) el.set_attr("unlock", action.unlock);
      return el;
    }
    case "cmd": {
      const el = xml.create("cmd");
      el.set_attr("name", action.name);
      if (action.args) el.set_attr("args", action.args.map(String));
      return el;
    }
    case "bg": {
      const el = xml.create("bg");
      el.set_attr("id", action.id);
      return el;
    }
    case "stage": {
      const el = xml.create("stage");
      for (const [name, value] of Object.entries(action.values)) el.set_attr(name, value);
      return el;
    }
    case "place": {
      const el = xml.create("place");
      el.set_attr("target", action.target);
      el.set_attr("at", action.at);
      set_expr_attrs(el, action, ["dx", "dy", "dz"]);
      el.set_attr("requires", action.requires);
      return el;
    }
    case "move": {
      const el = xml.create("move");
      el.set_attr("target", action.target);
      set_expr_attrs(el, action, ["dx", "dy", "dz"]);
      return el;
    }
    case "face": {
      const el = xml.create("face");
      el.set_attr("target", action.target);
      el.set_attr("at", action.at);
      return el;
    }
    case "velocity": {
      const el = xml.create("velocity");
      el.set_attr("target", action.target);
      for (const key of ["x", "y", "z"] as const) {
        const value = action[key];
        if (value === void 0) continue;
        el.set_attr(key, value === null ? "null" : String(value));
      }
      return el;
    }
    case "frame": {
      const el = xml.create("frame");
      el.set_attr("target", action.target);
      el.set_attr("id", action.id);
      return el;
    }
    case "pickup": {
      const el = xml.create("pickup");
      el.set_attr("target", action.target);
      el.set_attr("weapon", action.weapon);
      if (action.if_empty != null) el.set_attr("if_empty", action.if_empty);
      return el;
    }
    case "cycle": {
      const el = xml.create("cycle");
      el.set_attr("target", action.target);
      el.set_attr("property", action.property);
      if (action.values.every(v => typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
        el.set_arr_attr_soft("values", action.values.map(v => String(v)));
      } else {
        el.set_attr("json", JSON.stringify(action.values));
      }
      return el;
    }
    case "throw_spot": {
      const el = xml.create("throw_spot");
      el.set_attr("target", action.target);
      el.set_attr("from", action.from);
      return el;
    }
    case "reset":
      return xml.create("reset");
  }
}

function xml_x_actions(xml: IXML, actions: TActionData[] | undefined, parent: IXMLElement): void {
  if (!actions?.length) return;
  for (const action of actions) {
    const el = xml_x_action(xml, action);
    if (el) parent.insert(el);
  }
}

function xml_x_layout(xml: IXML, layout: TLayoutData): IXMLElement {
  const el = xml.create("layout");
  el.set_attr("type", layout.type ?? "point");
  if (layout.type === "line") el.set_attr("axis", layout.axis);
  set_expr_attrs(el, layout as unknown as Record<string, unknown>, ["x", "y", "z", "length", "radius", "rx", "rz"]);
  return el;
}

function xml_x_actor(xml: IXML, actor: IActorData, tag: string = "actor"): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("id", actor.id);
  el.set_attr("oid", actor.oid);
  el.set_attr("source", actor.source);
  el.set_attr("half", actor.half);
  el.set_attr("count", actor.count);
  el.set_attr("at", actor.at);
  set_expr_attrs(el, actor as unknown as Record<string, unknown>, ["x", "y", "z", "dx", "dy", "dz"]);
  el.set_attr("group", actor.group);
  el.set_attr("ctrl", actor.ctrl);
  el.set_attr("player_id", actor.player_id);
  el.set_attr("attach", actor.attach);
  if (actor.layout) el.insert(xml_x_layout(xml, actor.layout));
  if (actor.values) xml_x_values(xml, actor.values, el);
  return el;
}

function xml_x_timeline_entries(xml: IXML, entries: TTimelineEntryData[], parent: IXMLElement): void {
  for (const entry of entries) {
    const el = xml.create("entry");
    if ("wait" in entry) {
      el.set_attr("wait", entry.wait);
    } else if ("repeat" in entry) {
      el.set_attr("repeat", entry.repeat);
      el.set_attr("interval", entry.interval);
      xml_x_timeline_entries(xml, entry.entries, el);
    } else {
      el.set_attr("after", entry.after);
      xml_x_actions(xml, entry.actions, el);
    }
    parent.insert(el);
  }
}

export function xml_x_director(xml: IXML, data: IDirectorData, tag: string = "director"): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("name", data.name);
  el.set_attr("platform", data.platform);
  el.set_attr("bg", data.bg);
  if (data.stage) {
    const stage = xml.create("stage");
    for (const [name, value] of Object.entries(data.stage)) stage.set_attr(name, value);
    el.insert(stage);
  }
  if (data.actors?.length) {
    const actors = xml.create("actors");
    for (const actor of data.actors) actors.insert(xml_x_actor(xml, actor));
    el.insert(actors);
  }
  if (data.groups) {
    const groups = xml.create("groups");
    for (const [name, selectors] of Object.entries(data.groups)) {
      const group = xml.create("group");
      group.set_attr("name", name);
      group.set_attr("actors", selectors);
      groups.insert(group);
    }
    el.insert(groups);
  }
  if (data.setup?.length) {
    const setup = xml.create("setup");
    xml_x_actions(xml, data.setup, setup);
    el.insert(setup);
  }
  for (const rule of data.auto ?? []) {
    const auto = xml.create("auto");
    auto.set_attr("target", rule.target);
    if (rule.when) {
      auto.set_attr("state", rule.when.state);
      auto.set_attr("state_not", rule.when.state_not);
      auto.set_attr("mp_gt", rule.when.mp_gt);
      auto.set_attr("frame_hit", rule.when.frame_hit);
    }
    if (rule.actions.length === 1) xml_x_key_step_attrs(auto, rule.actions[0]);
    else xml_x_key_steps(xml, rule.actions, auto);
    el.insert(auto);
  }
  if (data.timeline) {
    const timeline = xml.create("timeline");
    timeline.set_attr("times", data.timeline.times);
    xml_x_timeline_entries(xml, data.timeline.entries, timeline);
    el.insert(timeline);
  }
  return el;
}

export function xml_x_directors(xml: IXML, group: IDirectorGroupData): IXMLElement {
  const root = xml.create("directors");
  root.set_attr("id", group.id);
  root.set_attr("name", group.name);
  for (const data of group.directors) root.insert(xml_x_director(xml, data));
  return root;
}
