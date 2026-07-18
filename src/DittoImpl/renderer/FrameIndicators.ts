import type { IFrameInfo } from "@/LFW/defines";
import type { IQube } from "@/LFW/defines/IQube";
import type { IQubePair } from "@/LFW/defines/IQubePair";
import type { Entity } from "@/LFW/entity/Entity";
import { foreach } from "@/LFW/utils/container_help/foreach";
import * as T from "../_t";
import { INDICATINGS } from "./INDICATINGS";
import { INDICATORS_INFO } from "./INDICATORS_INFO";
import type { WorldRenderer } from "./WorldRenderer";
const line_geometry = new T.LineGeometry();
const line_vertices = new Float32Array([
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1,
]);
line_geometry.setPositions(line_vertices);

const EMPTY_ARR = [] as const;
const DOT = {
  __indicator_info: {
    1: {
      z: 0,
      l: 0,
      x: -1,
      y: -1,
      w: 2,
      h: 2
    },
    [-1]: {
      z: 0,
      l: 0,
      x: -1,
      y: -1,
      w: 2,
      h: 2
    }
  }
}
type Indicatable = { __indicator_info?: IQubePair }
export type Indicating = 'frame' | 'bdy' | 'itr' | 'ft' | 'opoint' | 'wpoint' | 'cpoint' | 'bpoint' | 'ctrl';
const geometry = new T.BufferGeometry();
const vertices = new Float32Array([
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1,
]);
geometry.setAttribute("position", new T.BufferAttribute(vertices, 3));
export class FrameIndicators {
  readonly renderer_type: string = "FrameIndicators";
  protected _entity: Entity;
  protected _indicators_map: Record<Indicating, T.Object3D[]> = {
    frame: [],
    bdy: [],
    itr: [],
    ft: [],
    opoint: [],
    wpoint: [],
    cpoint: [],
    bpoint: [],
    ctrl: []
  };

  private _x: number = 0;
  private _y: number = 0;
  private _z: number = 0;
  private _prev_flags?: number;
  private _prev_frame?: IFrameInfo;
  private _prev_face?: number;

  get world_node() {
    return (this._entity.world.renderer as WorldRenderer).world_node;
  }
  get frame() {
    return this._entity.frame;
  }
  get face() {
    return this._entity.facing;
  }
  private _flags: number = 0;
  set flags(v: number) {
    if (this._flags === v) return;
    this._flags = v;
    this.render();
  }

  constructor(entity: Entity) {
    this._entity = entity;
  }
  get visible(): boolean {
    throw new Error("Method not implemented.");
  }
  set visible(v: boolean) {
    throw new Error("Method not implemented.");
  }

  protected _new_indicator(k: keyof typeof this._indicators_map, idx: number) {
    let mp = INDICATORS_INFO[k]
    if (idx == 2 && k == 'ft') {
      mp = INDICATORS_INFO.ft_l
    }
    const ret = new T.Line2(
      line_geometry,
      new T.LineMaterial(mp),
    )
    this._indicators_map[k][idx] = ret;
    this.world_node.add(ret);
    return ret;
  }

  protected _del_indicator(k: keyof typeof this._indicators_map, idx: number) {
    const [indicator] = this._indicators_map[k].splice(idx, 1);
    indicator?.removeFromParent();
  }
  show_indicators(name: keyof typeof this._indicators_map) {
    let data: readonly Indicatable[];

    switch (name) {
      case "frame": data = [this.frame]; break;
      case "ft": data = [DOT, DOT, DOT]; break;
      case "opoint":
      case "bdy":
      case "itr":
        data = this.frame[name] || EMPTY_ARR;
        break;
      case "wpoint":
      case "cpoint":
      case "bpoint":
        data = this.frame[name] ? [this.frame[name]] : EMPTY_ARR;
        break;
      default:
        data = EMPTY_ARR;
        break;
    }

    if (name === 'ft') {
      if (data.length) this._show_ft();
      else this.hide_indicators(name);
      return;
    }

    const data_len = data.length;
    const indicator_len = Math.max(this._indicators_map[name].length, data_len);
    for (let i = 0; i < indicator_len; ++i) {
      if (i >= data_len) {
        this._del_indicator(name, i);
        continue;
      }
      const info = data[i].__indicator_info?.[this.face];
      if (!info) {
        this._del_indicator(name, i);
        continue;
      }
      const indicator =
        this._indicators_map[name][i] ?? this._new_indicator(name, i);
      let y = this._y + info.y;
      let x = this._x + info.x;
      let { w, h } = info;
      indicator.userData.info = info;
      indicator.position.set(x, y, this._z);
      indicator.scale.set(w, h, 1);
    }
  }

  hide_indicators(k: keyof typeof this._indicators_map) {
    const indicators = this._indicators_map[k]
    if (!indicators.length) return
    this.world_node.remove(...indicators);
    indicators.length = 0;
  }

  private _show_ft(): void {
    this.hide_indicators('ft');

    const info = DOT.__indicator_info?.[this.face];
    if (!info) return;

    const foot_x = this._x + info.x;
    const foot_y = this._y + info.y;
    const foot_z = this._z;
    const ground_ty = this._entity.ground_y - this._z / 2;

    const mp = INDICATORS_INFO.ft!;

    // 脚点：小十字
    const dot_geo = new T.LineGeometry();
    dot_geo.setPositions([
      -3, 0, 0, 3, 0, 0,
      0, -3, 0, 0, 3, 0,
    ]);
    const dot = new T.Line2(dot_geo, new T.LineMaterial({ ...mp, linewidth: 4 }));
    dot.position.set(foot_x, foot_y, foot_z);

    // 竖线：脚点 → 地面
    const vline_geo = new T.LineGeometry();
    vline_geo.setPositions([0, 0, 0, 0, -1, 0]);
    const vline = new T.Line2(vline_geo, new T.LineMaterial({ ...mp, linewidth: 2 }));
    vline.position.set(foot_x, foot_y, foot_z);
    vline.scale.set(1, foot_y - ground_ty, 1);

    // 地面圆
    const CIRCLE_R = 10;
    const CIRCLE_SEG = 16;
    const cp: number[] = [];
    for (let i = 0; i < CIRCLE_SEG; i++) {
      const a0 = (2 * Math.PI * i) / CIRCLE_SEG;
      const a1 = (2 * Math.PI * (i + 1)) / CIRCLE_SEG;
      cp.push(
        CIRCLE_R * Math.cos(a0), CIRCLE_R * Math.sin(a0), 0,
        CIRCLE_R * Math.cos(a1), CIRCLE_R * Math.sin(a1), 0,
      );
    }
    const circle_geo = new T.LineGeometry();
    circle_geo.setPositions(cp);
    const circle = new T.Line2(circle_geo, new T.LineMaterial({ ...mp, linewidth: 2 }));
    circle.position.set(foot_x, ground_ty, foot_z);

    const group = new T.Object3D();
    group.name = 'ft_indicator';
    group.add(dot, vline, circle);
    this.world_node.add(group);
    this._indicators_map.ft[0] = group;
  }

  private _update_ft(): void {
    const group = this._indicators_map.ft[0];
    if (!group || group.children.length < 3) return;

    const info = DOT.__indicator_info?.[this.face];
    if (!info) return;

    const foot_x = this._x + info.x;
    const foot_y = this._y + info.y;
    const foot_z = this._z;
    const ground_ty = this._entity.ground_y - this._z / 2;

    const [dot, vline, circle] = group.children;
    dot.position.set(foot_x, foot_y, foot_z);
    vline.position.set(foot_x, foot_y, foot_z);
    vline.scale.set(1, foot_y - ground_ty, 1);
    circle.position.set(foot_x, ground_ty, foot_z);
  }

  on_mount(): void { }

  on_unmount() {
    foreach(this._indicators_map, (list) => {
      list.forEach((item) => this.world_node.remove(item));
      list.length = 0;
    });
  }
  update_indicators() {
    if (this._indicators_map.ft.length) {
      this._update_ft();
    }

    foreach(this._indicators_map, (indicators, name) => {
      if (name === 'ft') return;
      foreach(indicators, (indicator, i) => {
        const info = indicator.userData.info as IQube
        let y = this._y + info.y;
        let x = this._x + info.x;
        let { w, h } = info;
        indicator.userData.info = info;
        indicator.position.set(x, y, this._z);
        indicator.scale.set(w, h, 1);
      })
    })
  }

  render() {
    if (this._flags) {
      const { x: game_x, y: game_y, z: game_z } = this._entity.position;
      this._x = game_x;
      this._y = game_y - game_z / 2;
      this._z = game_z;
    }

    if (
      this._flags === this._prev_flags &&
      this._prev_frame === this.frame &&
      this._prev_face === this.face
    ) {
      if (this._flags) this.update_indicators()
      return;
    }

    foreach(INDICATINGS, (n, k) => {
      if (this._flags & n) this.show_indicators(k);
      else this.hide_indicators(k);
    })
    this._prev_flags = this._flags;
    this._prev_frame = this.frame;
    this._prev_face = this.face;
  }
}
