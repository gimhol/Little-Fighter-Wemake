import type { IStyle } from "../defines";
import type { IXMLElement } from "../ditto/xml/IXMLElement";
import type { IComponentInfo } from "./IComponentInfo";
import type { IUIInfo, TComponentInfo } from "./IUIInfo.dat";
import { normalize_alignment, parse_alignment, parse_alignment_object, parse_offset, type IAlignmentInfo } from "./alignment";

const ACTION_PLACES = new Set(['click', 'resume', 'pause', 'start', 'stop']);

/** `flex="..."` 之外的简写属性，避免在 XML 里写一长串声明 */
const FLEX_ATTRS = [
  'display', 'direction', 'wrap', 'justify', 'align', 'align_content', 'align_self',
  'gap', 'row_gap', 'col_gap', 'padding', 'grow', 'shrink', 'basis', 'order',
  'fit', 'fit_w', 'fit_h',
] as const;

/**
 * 读取元素属性：自身属性优先，其次按文档顺序倒序查子元素 `<attrs>`（后者覆盖前者）。
 *
 * `<node id="FOO" name="bar"/>` 等价于
 * `<node><attrs id="FOO" name="bar"/></node>`。
 */
type AttrGetter = (name: string) => string | undefined;

function attr_getter(el: IXMLElement): AttrGetter {
  const attr_children: IXMLElement[] = [];
  for (const child of el.children) {
    if (child.tag === 'attrs') attr_children.push(child);
  }
  return (name: string) => {
    const own = el.attr(name);
    if (own != null) return own;
    for (let i = attr_children.length - 1; i >= 0; --i) {
      const value = attr_children[i].attr(name);
      if (value != null) return value;
    }
    return void 0;
  };
}

/** 与 XML 元素的 `nums_attr` 一致：逗号分隔后逐段转数字 */
function nums_of(attr: AttrGetter, name: string, sep = ','): number[] | undefined {
  const value = attr(name);
  if (value == null) return void 0;
  return value.split(sep).map((part) => Number(part.trim()));
}

function parse_flex_attrs(attr: AttrGetter): string | Record<string, string> | undefined {
  const inline = attr('flex');
  if (inline != null) return inline;
  const flex: Record<string, string> = {};
  for (const name of FLEX_ATTRS) {
    const value = attr(name);
    if (value != null) flex[name] = value;
  }
  return Object.keys(flex).length ? flex : void 0;
}

function parse_flex_element(el: IXMLElement): string | Record<string, string> | undefined {
  const attr = attr_getter(el);
  const inline = attr('flex') ?? attr('value') ?? el.text.trim();
  if (inline) return inline;
  const propsEl = el.children.find(c => c.tag === 'properties');
  if (propsEl) {
    const props = propsEl.as_object({});
    if (Object.keys(props).length) return props as Record<string, string>;
  }
  return parse_flex_attrs(attr);
}

/** `display:flex; gap:4` → { display: "flex", gap: "4" }（按第一个 ':' 切分） */
function flex_decls(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of text.split(';')) {
    const at = decl.indexOf(':');
    if (at < 0) continue;
    const key = decl.slice(0, at).trim();
    const value = decl.slice(at + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

/** 多个 flex 声明按文档顺序合并（后者覆盖前者）；只有一个时原样返回以保留原类型 */
function merge_flex(
  specs: (string | Record<string, string>)[],
): string | Record<string, string> {
  if (specs.length === 1) return specs[0];
  const merged: Record<string, string> = {};
  for (const spec of specs) {
    Object.assign(merged, typeof spec === 'string' ? flex_decls(spec) : spec);
  }
  return merged;
}

/**
 * 多个 alignment 声明按文档顺序合并（后者覆盖前者）。
 *
 * `offset` / `followed` 整体替换（`offset` 解析后总是四边齐全，逐字段合并会冲掉前面的值）。
 */
function merge_alignment(specs: IAlignmentInfo[]): IAlignmentInfo {
  if (specs.length === 1) return specs[0];
  const merged: IAlignmentInfo = {};
  for (const spec of specs) {
    if (spec.left != null) merged.left = spec.left;
    if (spec.right != null) merged.right = spec.right;
    if (spec.top != null) merged.top = spec.top;
    if (spec.bottom != null) merged.bottom = spec.bottom;
    if (spec.offset != null) merged.offset = spec.offset;
    if (spec.followed != null) merged.followed = spec.followed;
    if (spec.once) merged.once = true;
  }
  return merged;
}

const STYLE_NUMBER_ATTRS = [
  'line_width', 'scale', 'padding_l', 'padding_r', 'padding_t', 'padding_b',
  'shadow_blur', 'shadow_offset_x', 'shadow_offset_y', 'underline_width',
] as const;

/** `<style>` 元素 → `IStyle`（数值/布尔属性在此统一转型，与 JSON5 的 style 对象一致） */
function read_style(el: IXMLElement): IStyle | undefined {
  const raw = el.as_object() as IStyle | undefined;
  const style: Record<string, unknown> = raw != null ? { ...raw } : {};
  let any = raw != null;
  for (const name of STYLE_NUMBER_ATTRS) {
    const value = el.attr(name);
    if (value == null) continue;
    style[name] = Number(value);
    any = true;
  }
  const smoothing = el.attr('smoothing');
  if (smoothing != null) {
    style.smoothing = smoothing === 'true';
    any = true;
  }
  const disposable = el.attr('disposable');
  if (disposable != null) {
    style.disposable = disposable === 'true';
    any = true;
  }
  return any ? (style as IStyle) : void 0;
}

function parse_alignment_attrs(
  attr: AttrGetter,
  prefix = 'alignment_',
  inline_name = 'alignment',
): IAlignmentInfo | undefined {
  const inline = inline_name ? attr(inline_name) : void 0;
  if (inline) return parse_alignment(inline);
  const read = (name: string) => attr(`${prefix}${name}`);
  const info: IAlignmentInfo = {};
  const left = read('left');
  const right = read('right');
  const top = read('top');
  const bottom = read('bottom');
  if (left != null) info.left = left;
  if (right != null) info.right = right;
  if (top != null) info.top = top;
  if (bottom != null) info.bottom = bottom;
  const offset = read('offset');
  if (offset != null) {
    const parsed = parse_offset(offset);
    if (parsed) info.offset = parsed;
  }
  const followed = read('followed');
  if (followed != null) info.followed = followed;
  const followed_l = read('followed_l');
  const followed_r = read('followed_r');
  const followed_t = read('followed_t');
  const followed_b = read('followed_b');
  if (followed_l != null || followed_r != null || followed_t != null || followed_b != null) {
    info.followed = {
      l: followed_l ?? followed ?? void 0,
      r: followed_r ?? followed ?? void 0,
      t: followed_t ?? followed ?? void 0,
      b: followed_b ?? followed ?? void 0,
    };
  }
  const once = read('once');
  if (once != null) info.once = once.toLowerCase() === 'true' || once === '1';
  return normalize_alignment(info) ?? void 0;
}

function parse_action_children(place: IXMLElement): string | string[] {
  const actions = place.children.filter(c => c.tag === 'action');
  if (actions.length) {
    return actions.map(a => a.action_str());
  }
  if (place.attr('action') || place.attr('name')) {
    return place.action_str();
  }
  const v = place.text;
  return v.includes(',') ? v.split(',').map(s => s.trim()) : v.trim();
}

function parse_component(el: IXMLElement): TComponentInfo {
  const cls = el.attr('cls') || el.tag;
  const ret: IComponentInfo = { cls: cls };
  const args = el.attr('args');
  if (args) ret.args = args.split(',').map(s => s.trim());
  const id = el.attr('id');
  if (id) ret.id = id;
  const weight = el.attr('weight');
  if (weight) ret.weight = Number(weight);

  // <properties> 子元素
  const propsEl = el.children.find(c => c.tag === 'properties');
  if (propsEl) {
    ret.properties = propsEl.as_object();
  }
  return ret;
}

export function xml_to_ui_info(el: IXMLElement): IUIInfo {
  const ret: IUIInfo = {};
  const attr = attr_getter(el);

  // id / name / i18n
  ret.id = attr('id');
  ret.name = attr('name');
  ret.i18n = attr('i18n');
  ret.color = attr('color');
  ret.background = attr('background');
  ret.foreground = attr('foreground');
  ret.outlineColor = attr('outlineColor');
  ret.template = attr('template');
  ret.auto_focus = attr('auto_focus') === 'true' ? true : void 0;

  // flex / alignment：属性形式与多个子元素按文档顺序合并
  const flex_specs: (string | Record<string, string>)[] = [];
  const alignment_specs: IAlignmentInfo[] = [];
  const style_specs: IStyle[] = [];
  const flex = parse_flex_attrs(attr);
  if (flex != null) flex_specs.push(flex);
  const alignment = parse_alignment_attrs(attr);
  if (alignment) alignment_specs.push(alignment);

  // number arrays (comma-separated)
  ret.pos = nums_of(attr, 'pos');
  ret.size = nums_of(attr, 'size');
  ret.center = nums_of(attr, 'center');
  ret.scale = nums_of(attr, 'scale');

  // number properties
  const opacity = attr('opacity');
  if (opacity != null) ret.opacity = Number(opacity);
  const count = attr('count');
  if (count != null) ret.count = Number(count);
  const visible = attr('visible');
  if (visible != null) ret.visible = visible === 'true';
  const disabled = attr('disabled');
  if (disabled != null) ret.disabled = disabled === 'true';
  const clips = attr('clips');
  if (clips != null) ret.clips = clips === 'true';
  const local_only = attr('local_only');
  if (local_only != null) ret.local_only = local_only === 'true';
  const ignore_esc = attr('ignore_esc');
  if (ignore_esc != null) ret.ignore_esc = ignore_esc === 'true';
  const touchable = attr('touchable');
  if (touchable != null) ret.touchable = touchable === 'true';
  const bgAlpha = attr('backgroundAlpha');
  if (bgAlpha != null) ret.backgroundAlpha = Number(bgAlpha);
  const fgAlpha = attr('foregroundAlpha');
  if (fgAlpha != null) ret.foregroundAlpha = Number(fgAlpha);
  const olWidth = attr('outlineWidth');
  if (olWidth != null) ret.outlineWidth = Number(olWidth);
  const olAlpha = attr('outlineAlpha');
  if (olAlpha != null) ret.outlineAlpha = Number(olAlpha);

  // children
  const items: (IUIInfo | string)[] = [];
  const components: TComponentInfo[] = [];
  const templates: Record<string, IUIInfo> = {};

  for (const child of el.children) {
    const tag = child.tag;
    switch (tag) {
      case 'attrs': {
        // 已合并进本节点的属性（`attr_getter`），不是子节点
        break;
      }
      case 'node':
      case 'item': {
        const ref = child.attr('ref');
        if (ref) {
          items.push(ref);
        } else {
          items.push(xml_to_ui_info(child));
        }
        break;
      }
      case 'values': {
        if (!ret.values) ret.values = {};
        Object.assign(ret.values, child.as_object());
        break;
      }
      case 'actions': {
        const actions: any = {};
        // 属性形式: <actions click="sound(ok),set_page(loading)"/>
        for (const attr of child.attrs) {
          const v = attr.value;
          actions[attr.name] = v.includes(',') ? v.split(',').map(s => s.trim()) : v.trim();
        }
        // 子元素形式: 支持多个同标签子元素自动合并为数组
        for (const c of child.children) {
          if (!ACTION_PLACES.has(c.tag)) continue;
          const val = parse_action_children(c);
          const prev = actions[c.tag];
          if (prev != null) {
            actions[c.tag] = Array.isArray(prev)
              ? prev.concat(val)
              : [prev].concat(val);
          } else {
            actions[c.tag] = val;
          }
        }
        ret.actions = actions;
        break;
      }
      case 'components': {
        for (const c of child.children) {
          components.push(parse_component(c));
        }
        break;
      }
      case 'component': {
        components.push(parse_component(child));
        break;
      }
      case 'style': {
        const style = read_style(child);
        if (style != null) style_specs.push(style);
        break;
      }
      case 'img': {
        const img: any = {};
        const num = (name: string) => child.attr(name) != null ? Number(child.attr(name)) : void 0;
        img.path = child.attr('path') || child.attr('src');
        img.x = num('x');
        img.y = num('y');
        img.w = num('w');
        img.h = num('h');
        img.dw = num('dw') ?? img.w;
        img.dh = num('dh') ?? img.h;
        if (child.attr('flip_x') != null) img.flip_x = Number(child.attr('flip_x'));
        if (child.attr('flip_y') != null) img.flip_y = Number(child.attr('flip_y'));
        if (child.attr('wrapS') != null) img.wrapS = Number(child.attr('wrapS'));
        if (child.attr('wrapT') != null) img.wrapT = Number(child.attr('wrapT'));
        if (child.attr('offsetX') != null) img.offsetX = Number(child.attr('offsetX'));
        if (child.attr('offsetY') != null) img.offsetY = Number(child.attr('offsetY'));
        if (child.attr('offsetAnimX') != null) img.offsetAnimX = Number(child.attr('offsetAnimX'));
        if (child.attr('offsetAnimY') != null) img.offsetAnimY = Number(child.attr('offsetAnimY'));
        if (child.attr('offsetAnimR') != null) img.offsetAnimR = Number(child.attr('offsetAnimR'));
        if (child.attr('repeatX') != null) img.repeatX = Number(child.attr('repeatX'));
        if (child.attr('repeatY') != null) img.repeatY = Number(child.attr('repeatY'));
        const np = child.children.find(c => c.tag === 'nine_patch');
        if (np) {
          const n = (name: string) => np.attr(name) != null ? Number(np.attr(name)) : void 0;
          img.nine_patch = {
            f_l: n('f_l'),
            f_t: n('f_t'),
            f_r: n('f_r'),
            f_b: n('f_b'),
            f_w: n('f_w'),
            f_h: n('f_h'),
            l_w: n('l_w'),
            t_h: n('t_h'),
            r_w: n('r_w'),
            b_h: n('b_h'),
          };
        }
        ret.img = img;
        break;
      }
      case 'template': {
        const tid = child.attr('id') || child.attr('name') || '';
        templates[tid] = xml_to_ui_info(child);
        break;
      }
      case 'alignment': {
        const propsEl = child.children.find(c => c.tag === 'properties');
        const parsed = (propsEl ? parse_alignment_object(propsEl.as_object({})) : void 0)
          ?? parse_alignment_attrs(attr_getter(child), '', 'value')
          ?? parse_alignment(child.text);
        if (parsed) alignment_specs.push(parsed);
        break;
      }
      case 'flex': {
        const parsed = parse_flex_element(child);
        if (parsed != null) flex_specs.push(parsed);
        break;
      }
      default: {
        // 其他元素作为 component 简写，如 <Label /> <Reachable args="main"/>
        const comp: IComponentInfo = { cls: tag };
        const args = child.attr('args');
        if (args) comp.args = args.split(',').map(s => s.trim());
        components.push(comp);
        break;
      }
    }
  }

  if (flex_specs.length) ret.flex = merge_flex(flex_specs);
  if (alignment_specs.length) ret.alignment = merge_alignment(alignment_specs);
  if (style_specs.length) {
    ret.style = style_specs.length === 1
      ? style_specs[0]
      : (Object.assign({}, ...style_specs) as IStyle);
  }

  if (items.length) ret.items = items;
  if (components.length) ret.component = components;
  if (Object.keys(templates).length) ret.templates = templates;

  return ret;
}
