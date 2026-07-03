import type { World } from "../World";
import type { IBgData, IBgLayerInfo } from "../defines";
import { Layer } from "./Layer";

export class Background {
  readonly data: Readonly<IBgData>;
  private _layers: Layer[] = [];
  zoom_x: number;
  zoom_y: number;
  zoom_z: number;
  name: string
  id: string
  left: number
  right: number
  near: number
  far: number
  height: number
  width: number;
  readonly depth: number;
  readonly middle: { x: number; z: number };
  readonly world: World;
  private _update_times = 0;
  get layers(): ReadonlyArray<Layer> {
    return this._layers;
  }

  constructor(world: World, data: Readonly<IBgData>) {
    this.data = data;
    this.world = world;
    this.id = this.data.id
    const info = this.data.base
    this.name = info.name ?? this.id;
    this.left = info.left ?? 0;
    this.right = info.right ?? 0;
    this.near = info.near ?? 0;
    this.far = info.far ?? 0;
    this.width = this.right - this.left;
    this.depth = this.near - this.far;
    this.height = info.height ?? 0;
    this.middle = {
      x: (this.right + this.left) / 2,
      z: (this.far + this.near) / 2,
    };
    if (data.layers)
      for (const info of data.layers)
        this.add_layer(info);

    this.zoom_x = info.zoom_x ?? 1;
    this.zoom_y = info.zoom_y ?? 1;
    this.zoom_z = info.zoom_z ?? 1;
  }

  private add_layer(info: IBgLayerInfo) {
    let { x, loop = 0 } = info;
    if (loop <= 0) {
      this._layers.push(new Layer(this, info))
      return;
    } else {
      const right = this.width + loop;
      for (x -= loop; x < right; x += loop) {
        this._layers.push(new Layer(this, { ...info, x }));
      }
    }
  }

  update() {
    this._update_times++;
    for (const layer of this._layers)
      layer.update(this._update_times);
  }

  dispose() {
    this._layers.length = 0
  }
}

