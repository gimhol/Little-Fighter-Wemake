import type { IStyle } from "../defines";
import type { IXMLElement } from "../ditto/xml/IXMLElement";
import type { IComponentInfo } from "./IComponentInfo";
import type { IUIInfo, TComponentInfo } from "./IUIInfo.dat";

const ACTION_PLACES = new Set(['click', 'resume', 'pause', 'start', 'stop']);

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

  // id / name / i18n
  ret.id = el.attr('id');
  ret.name = el.attr('name');
  ret.i18n = el.attr('i18n');
  ret.color = el.attr('color');
  ret.background = el.attr('background');
  ret.foreground = el.attr('foreground');
  ret.outlineColor = el.attr('outlineColor');
  ret.template = el.attr('template');
  ret.auto_focus = el.attr('auto_focus') === 'true' ? true : void 0;

  // number arrays (comma-separated)
  ret.pos = el.nums_attr('pos');
  ret.size = el.nums_attr('size');
  ret.center = el.nums_attr('center');
  ret.scale = el.nums_attr('scale');

  // number properties
  const opacity = el.attr('opacity');
  if (opacity != null) ret.opacity = Number(opacity);
  const count = el.attr('count');
  if (count != null) ret.count = Number(count);
  const visible = el.attr('visible');
  if (visible != null) ret.visible = visible === 'true';
  const disabled = el.attr('disabled');
  if (disabled != null) ret.disabled = disabled === 'true';
  const clips = el.attr('clips');
  if (clips != null) ret.clips = clips === 'true';
  const bgAlpha = el.attr('backgroundAlpha');
  if (bgAlpha != null) ret.backgroundAlpha = Number(bgAlpha);
  const fgAlpha = el.attr('foregroundAlpha');
  if (fgAlpha != null) ret.foregroundAlpha = Number(fgAlpha);
  const olWidth = el.attr('outlineWidth');
  if (olWidth != null) ret.outlineWidth = Number(olWidth);
  const olAlpha = el.attr('outlineAlpha');
  if (olAlpha != null) ret.outlineAlpha = Number(olAlpha);

  // children
  const items: (IUIInfo | string)[] = [];
  const components: TComponentInfo[] = [];
  const templates: Record<string, IUIInfo> = {};

  for (const child of el.children) {
    const tag = child.tag;
    switch (tag) {
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
        // 属性形式: <actions click="sound(ok),set_ui(loading)"/>
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
        ret.style = child.as_object() as IStyle;
        // 数值属性转换
        const s = ret.style as any;
        if (child.attr('line_width') != null) s.line_width = Number(child.attr('line_width'));
        if (child.attr('scale') != null) s.scale = Number(child.attr('scale'));
        if (child.attr('padding_l') != null) s.padding_l = Number(child.attr('padding_l'));
        if (child.attr('padding_r') != null) s.padding_r = Number(child.attr('padding_r'));
        if (child.attr('padding_t') != null) s.padding_t = Number(child.attr('padding_t'));
        if (child.attr('padding_b') != null) s.padding_b = Number(child.attr('padding_b'));
        if (child.attr('shadow_blur') != null) s.shadow_blur = Number(child.attr('shadow_blur'));
        if (child.attr('shadow_offset_x') != null) s.shadow_offset_x = Number(child.attr('shadow_offset_x'));
        if (child.attr('shadow_offset_y') != null) s.shadow_offset_y = Number(child.attr('shadow_offset_y'));
        if (child.attr('underline_width') != null) s.underline_width = Number(child.attr('underline_width'));
        if (child.attr('smoothing') != null) s.smoothing = child.attr('smoothing') === 'true';
        if (child.attr('disposable') != null) s.disposable = child.attr('disposable') === 'true';
        break;
      }
      case 'img': {
        const img: any = {};
        img.path = child.attr('path') || child.attr('src');
        img.x = Number(child.attr('x'));
        img.y = Number(child.attr('y'));
        img.w = Number(child.attr('w'));
        img.h = Number(child.attr('h'));
        img.dw = Number(child.attr('dw')) || img.w;
        img.dh = Number(child.attr('dh')) || img.h;
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
        ret.img = img;
        break;
      }
      case 'template': {
        const tid = child.attr('id') || child.attr('name') || '';
        templates[tid] = xml_to_ui_info(child);
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

  if (items.length) ret.items = items;
  if (components.length) ret.component = components;
  if (Object.keys(templates).length) ret.templates = templates;

  return ret;
}
