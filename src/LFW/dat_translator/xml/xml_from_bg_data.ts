import type { IBgData } from "../../defines/IBgData";
import type { IXML } from "../../ditto/xml";

/**
 * 序列化背景数据为 XML 元素树，再 stringify 输出
 */
export function xml_from_bg_data(xml: IXML, data: IBgData): string {
  const root = xml.create("background");
  root.set_attr("id", data.id);

  // <base>
  const info = xml.create("base");
  const b = data.base;
  info.set_attr("name", b.name);
  info.set_attr("shadow", b.shadow);
  info.set_attr("left", b.left);
  info.set_attr("right", b.right);
  info.set_attr("far", b.far);
  info.set_attr("near", b.near);

  // 此处刻意的''
  const { shadow_w = '', shadow_h = '' } = data.base
  if (shadow_w || shadow_h)
    info.set_attr("shadowsize", [shadow_w, shadow_h].join(","));

  if (data.base.group?.length) info.set_arr_attr("group", data.base.group as string[]);
  if (data.base.height && data.base.height !== 600) info.set_attr("height", data.base.height);

  // 此处刻意的''
  const { zoom_x = '', zoom_y = '', zoom_z = '' } = data.base
  if (zoom_x || zoom_y || zoom_z)
    info.set_attr("zoom", [zoom_x, zoom_y, zoom_z].join(","));
  root.insert(info);

  // <dataset>
  if (data.dataset && Object.keys(data.dataset).length) {
    const ds = xml.create("dataset");
    for (const [k, v] of Object.entries(data.dataset)) {
      ds.set_attr(k, v);
    }
    root.insert(ds);
  }

  if (data.layers?.length) {
    for (const l of data.layers) {
      const layer = xml.create("layer");
      layer.set_attr("width", l.width);
      layer.set_attr("height", l.height);
      layer.set_attr("x", l.x);
      layer.set_attr("y", l.y);
      layer.set_attr("z", l.z);
      layer.set_attr("w", l.w);
      layer.set_attr("h", l.h);
      layer.set_attr("loop", l.loop);
      layer.set_attr("absolute", l.absolute);
      layer.set_attr("cc", l.cc);
      layer.set_attr("c1", l.c1);
      layer.set_attr("c2", l.c2);
      layer.set_attr("offsetAnimX", l.offsetAnimX);
      layer.set_attr("offsetAnimY", l.offsetAnimY);
      layer.set_attr("id", l.id);
      layer.set_attr("name", l.name);
      layer.set_attr("file", l.file);
      layer.set_attr("color", l.color);
      root.insert(layer);
    }
  }
  return root.stringify();
}
