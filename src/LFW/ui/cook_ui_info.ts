import type { IStyle } from "../defines";
import { Ditto } from "../ditto";
import { LFW } from "../LFW";
import { floor } from '../utils/math/base';
import { is_num_arr } from '../utils/type_check/is_num';
import { is_str } from '../utils/type_check/is_str';
import type { Unsafe } from "../utils/type_check/Unsafe";
import type { IComponentInfo } from "./IComponentInfo";
import type { ICookedUIInfo } from "./ICookedUIInfo";
import type { IUIAction } from "./IUIAction";
import type { INinePatch, IUIImgInfo } from "./IUIImgInfo.dat";
import type { IUIInfo, TComponentInfo } from "./IUIInfo.dat";
import { is_0_or_1, judger, parse_ui_value, unsafe_is_object } from "./read_info_value";
import { ui_load_img } from "./ui_load_img";
import { parse_call_func_expression } from './utils/parse_call_func_expression';
import { read_nums } from "./utils/read_nums";
import { validate_ui_img_info } from "./utils/validate_ui_img_info";
import { xml_to_ui_info } from "./xml_to_ui_info";

let __new_id = 0;
const new_id = () => ++__new_id;

export async function merge_ui_template(lfw: LFW, raw_info: IUIInfo, parent: ICookedUIInfo | undefined): Promise<IUIInfo> {
  const { template: template_name, ...remain_info } = raw_info;
  if (!template_name) return raw_info;
  const template_info: Unsafe<IUIInfo> = await find_ui_template(lfw, parent, template_name);
  const component: TComponentInfo[] = [];
  template_info.component?.forEach(c => {
    component.push(c)
  })
  remain_info.component?.forEach(c => {
    component.push(c)
  })
  if (lfw.dev === true) {
    template_info.dev_component?.forEach(c => {
      component.push(c)
    })
    remain_info.dev_component?.forEach(c => {
      component.push(c)
    })
  }
  return {
    ...template_info,
    ...remain_info,
    template: template_name,
    component,
    values: {
      ...template_info.values,
      ...remain_info.values
    },
    template_values: {
      ...template_info.template_values,
      ...remain_info.template_values
    }
  };
}
merge_ui_template.TAG = 'read_ui_template';

export async function find_ui_template(
  lfw: LFW,
  parent: Unsafe<ICookedUIInfo>,
  template_name: string
): Promise<IUIInfo> {
  const { TAG } = find_ui_template;
  let ret: Unsafe<IUIInfo>;
  let ptr: Unsafe<ICookedUIInfo> = parent;
  while (ptr && !ret) {
    ret = ptr.templates?.[template_name];
    ptr = ptr.parent;
  }
  if (ret) return ret;

  let path = template_name.startsWith('@/') ? template_name.replace('@/', 'builtin_data/launch/') : template_name;

  const is_json = path.endsWith('.ui.json5') || path.endsWith('.ui.json');
  const is_xml = path.endsWith('.ui.xml');

  if (is_xml) {
    const { data: root } = await lfw.resources.import_xml(path, true);
    return xml_to_ui_info(root);
  }
  if (is_json) {
    const { data } = await lfw.resources.import_json<IUIInfo>(path, true);
    return data;
  }
  try {
    ret = await lfw.resources.import_json<IUIInfo>(path + '.ui.json5', true).then(r => r.data);
    if (ret && Object.keys(ret).length) return ret;
  } catch { /* fall through */ }

  try {
    ret = await lfw.resources.import_json<IUIInfo>(path + '.ui.json', true).then(r => r.data);
    if (ret && Object.keys(ret).length) return ret;
  } catch { /* fall through to xml */ }

  try {
    const { data: root } = await lfw.resources.import_xml(path + '.ui.xml', true);
    if (root) {
      ret = xml_to_ui_info(root);
      if (ret && Object.keys(ret).length) return ret;
    }
  } catch (e) {
    Ditto.warn(`[${TAG}] ui template not found! template_name: ${template_name}, e:${e}`);
  }

  return ret || {};
}
find_ui_template.TAG = 'find_ui_template';

export async function cook_ui_info(
  lfw: LFW,
  info: IUIInfo | string,
  parent?: ICookedUIInfo
): Promise<ICookedUIInfo> {
  let raw: IUIInfo;
  if (is_str(info)) {
    raw = await find_ui_template(lfw, parent, info)
  } else {
    raw = info
  }
  if (raw.template) {
    raw = await merge_ui_template(lfw, raw, parent);
  }

  const id = raw.id || `no_id_${new_id()}`;
  const name = raw.name || id;
  const components = raw.component?.map(t => {
    if (typeof t !== 'string') {
      if (!t.cls) debugger; // my bad -Gim
      if (!t.cls && t.name) t.cls = t.name;
      t.id ||= `${t.cls}_${new_id()}`
      t.name ||= `${t.cls}_no_name`
      return t;
    }
    const result = parse_call_func_expression(t);
    const ret: IComponentInfo = result ? {
      ...result,
      cls: result.name,
      id: result.id || `no_id_${new_id()}`
    } : {
      id: `no_id_${new_id()}`,
      name: t,
      cls: t,
    }
    return ret;
  }).sort((a, b) => (b.weight || 0) - (a.weight || 0)) ?? [];

  const { actions: raw_actions, ...rest_raw } = raw;

  const ret: ICookedUIInfo = {
    ...rest_raw,
    values: raw.values ? raw.values : {},
    id, name, parent,
    pos: [0, 0, 0],
    scale: [0, 0, 0],
    center: [0, 0, 0],
    size: [0, 0, 0],
    img_info: void 0,
    txt_info: void 0,
    items: void 0,
    img: void 0,
    component: components,
    style: void 0,
    count: void 0,
    visible: void 0,
    disabled: void 0,
    clips: void 0,
    backgroundAlpha: void 0,
    foregroundAlpha: void 0,
    outlineWidth: void 0,
    outlineAlpha: void 0,
    opacity: void 0,
  };
  ret.raw = raw;
  const parse_str = (v: string | undefined) => parse_ui_value(ret, String, v) ?? void 0
  const parse_boolean = (v: string | boolean | undefined) => parse_ui_value(ret, Boolean, v) ?? void 0
  const parse_num = (v: string | number | undefined) => parse_ui_value(ret, Number, v) ?? void 0
  const parse_nums = (v: string | number[] | undefined): string | number[] | undefined => {
    if (is_num_arr(v)) return v;
    return parse_ui_value(ret, null, v)
  }
  ret.pos             /**/ = read_nums(parse_nums(raw.pos), 3)
  ret.scale           /**/ = read_nums(parse_nums(raw.scale), 3, 1)
  ret.center          /**/ = read_nums(parse_nums(raw.center), 3)
  ret.visible         /**/ = parse_boolean(raw.visible);
  ret.disabled        /**/ = parse_boolean(raw.disabled);
  ret.clips           /**/ = parse_boolean(raw.clips);
  ret.count           /**/ = parse_num(raw.count);
  ret.opacity         /**/ = parse_num(raw.opacity);
  ret.color           /**/ = parse_str(raw.color) ?? void 0;
  ret.background      /**/ = parse_str(raw.background) ?? void 0;
  ret.backgroundAlpha /**/ = parse_num(raw.backgroundAlpha);
  ret.foreground      /**/ = parse_str(raw.foreground) ?? void 0;
  ret.foregroundAlpha /**/ = parse_num(raw.foregroundAlpha);
  ret.outlineColor    /**/ = parse_str(raw.outlineColor) ?? void 0;
  ret.outlineWidth    /**/ = parse_num(raw.outlineWidth);
  ret.outlineAlpha    /**/ = parse_num(raw.outlineAlpha);
  ret.i18n            /**/ = parse_str(raw.i18n) ?? void 0;
  ret.style           /**/ = parse_ui_value(ret, unsafe_is_object<IStyle>(), raw.style) ?? void 0

  // actions: 统一转为 IUIAction[]，支持字符串 "sound(ok)" 或 IUIAction 对象
  if (raw_actions) {
    const cooked_actions: ICookedUIInfo['actions'] = {};
    for (const [place, val] of Object.entries(raw_actions)) {
      if (val == null) continue;
      const arr = (Array.isArray(val) ? val : [val]) as (string | IUIAction)[];
      (cooked_actions as Record<string, IUIAction[]>)[place] = arr.map(a => {
        if (typeof a === 'string') {
          const parsed = parse_call_func_expression(a);
          return {
            name: (parsed ? parsed.name : a) as IUIAction['name'],
            args: parsed?.args ?? [],
          } as IUIAction;
        }
        return a;
      });
    }
    ret.actions = cooked_actions;
  }

  if (raw.img && typeof raw.img === 'string') {
    ret.img = parse_ui_value<IUIImgInfo>(ret, judger(validate_ui_img_info), raw.img) ?? void 0
  }
  if (raw.img && typeof raw.img === 'object') {
    const w = parse_num(raw.img.w);
    const h = parse_num(raw.img.h);
    const img: IUIImgInfo = {
      path        /**/: parse_str(raw.img.path) ?? '',
      x           /**/: parse_num(raw.img.x),
      y           /**/: parse_num(raw.img.y),
      w, h,
      dw          /**/: parse_num(raw.img.dw) ?? w,
      dh          /**/: parse_num(raw.img.dh) ?? h,
      wrapS       /**/: parse_num(raw.img.wrapS),
      wrapT       /**/: parse_num(raw.img.wrapT),
      offsetX     /**/: parse_num(raw.img.offsetX),
      offsetY     /**/: parse_num(raw.img.offsetY),
      offsetAnimX /**/: parse_num(raw.img.offsetAnimX),
      offsetAnimY /**/: parse_num(raw.img.offsetAnimY),
      offsetAnimR /**/: parse_num(raw.img.offsetAnimR),
      repeatX     /**/: parse_num(raw.img.repeatX),
      repeatY     /**/: parse_num(raw.img.repeatY),
      flip_x      /**/: parse_ui_value(ret, is_0_or_1, raw.img.flip_x) ?? void 0,
      flip_y      /**/: parse_ui_value(ret, is_0_or_1, raw.img.flip_y) ?? void 0,
    }
    const { nine_patch: np } = raw.img;
    if (np) {
      if (typeof np === 'string') {
        img.nine_patch = parse_ui_value(ret, unsafe_is_object<INinePatch>(), np) ?? void 0
      } else {
        img.nine_patch = {
          f_l: parse_num(np.f_l),
          f_t: parse_num(np.f_t),
          f_r: parse_num(np.f_r),
          f_b: parse_num(np.f_b),
          f_w: parse_num(np.f_w),
          f_h: parse_num(np.f_h),
          l_w: parse_num(np.l_w),
          t_h: parse_num(np.t_h),
          r_w: parse_num(np.r_w),
          b_h: parse_num(np.b_h),
        }
      }
    }
    ret.img = img
  }
  if (ret.img) ret.img_info = await ui_load_img(lfw, ret.img);
  if (ret.i18n) ret.txt_info = lfw.images.measure_text(lfw.string(ret.i18n), ret.style)

  const img = ret.img_info || ret.txt_info;
  if (raw.size) {
    ret.size = read_nums(parse_nums(raw.size), 3)
  } else if (ret.img) {
    const w = ret.img.dw ?? ret.img.w ?? 0;
    const h = ret.img.dh ?? ret.img.h ?? 0;
    ret.size = [w, h, 0]
  } else if (!parent) {
    ret.size = [lfw.world.dataset.screen_w, lfw.world.dataset.screen_h, 0]
  }

  do {
    if (!img) break;
    const { w: img_w = 0, h: img_h = 0, scale = 1 } = img;
    if (!img_w || !img_h || !scale) {
      debugger;
      break;
    }
    const sw = img_w / scale;
    const sh = img_h / scale;
    const [w, h] = ret.size;
    if (!w && !h) {
      ret.size[0] = sw
      ret.size[1] = sh
    } else if (!w && h) {
      ret.size[0] = floor(h * sw / sh);
    } else if (!h && w) {
      ret.size[1] = floor(w * sh / sw);
    }
  } while (0)

  const { items: raw_items } = raw;
  if (raw_items && !Array.isArray(raw_items)) {
    Ditto.warn(`[cook_ui_info] items must be array, but got`, raw_items);
  }
  if (raw_items?.length) {
    ret.items = [];
    for (const raw_item of raw_items) {
      const item = await cook_ui_info(lfw, raw_item, ret);
      let { count = 1 } = item;
      while (count) {
        ret.items.push(item);
        count = floor(count - 1)
      };
    }
  }
  if (!ret.items?.length)
    delete ret.items;
  return ret;
}
merge_ui_template.TAG = 'cook_ui_info';