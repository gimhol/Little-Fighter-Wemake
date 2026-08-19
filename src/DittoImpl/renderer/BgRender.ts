import type { Background } from "@/LFW/bg/Background";
import type { World } from "@/LFW/World";
import * as T from "../_t";
import { Object3D } from "../_t";
import { BgLayerRender } from "./BgLayerRender";
import { WorldRenderer } from "./WorldRenderer";

export class BgRender {
  readonly world_renderer: WorldRenderer
  readonly world: World;
  protected bg: Background | null = null;
  protected root_node: Object3D | null = null;
  protected cam_node: Object3D | null = null;
  protected layers: BgLayerRender[] = [];
  protected quaternion = new T.Quaternion();

  constructor(world_renderer: WorldRenderer) {
    this.world = world_renderer.world;
    this.world_renderer = world_renderer;
  }

  set_bg(bg: Background | null): void {
    this.root_node?.removeFromParent();
    this.root_node = null
    this.cam_node?.removeFromParent();
    this.cam_node = null
    this.layers.length = 0;

    this.bg = bg;
    if (!this.bg) return

    const { base } = this.bg.data
    const { height = 600, far = 0 } = base;

    const z = -height * 2 + far;

    this.cam_node = new T.Object3D();
    this.cam_node.name = "Background(Cam Follower):" + base.name;
    this.cam_node.position.z = z;


    this.root_node = new T.Object3D();
    this.root_node.position.z = z;
    this.root_node.name = "Background:" + base.name;


    for (const layer of this.bg.layers) {
      const layer_render = new BgLayerRender(this, layer)

      if (layer.info.absolute) {
        this.cam_node.add(layer_render.mesh);
      } else {
        this.root_node.add(layer_render.mesh);
      }
      if (!layer.is_static())
        this.layers.push(layer_render);
    }
    this.world_renderer.bg_container.add(this.root_node, this.cam_node);
  }

  render(dt: number): void {
    const cam_x = this.world_renderer.camera.position.x;
    const { root_node, layers, cam_node } = this;
    const { bg } = this.world
    if (this.bg !== bg) this.set_bg(bg)
    this.world_renderer.camera.getWorldQuaternion(this.quaternion);
    root_node?.setRotationFromQuaternion(this.quaternion);
    if (cam_node) {
      cam_node.setRotationFromQuaternion(this.quaternion);
      cam_node.position.x = cam_x;
    }
    for (const layer of layers) layer.render(dt);
  }

  release(): void {
    this.root_node?.removeFromParent();
    this.cam_node?.removeFromParent();
    this.root_node = null
    this.cam_node = null
    this.layers.length = 0;
    this.bg = null
    this.quaternion.set(0, 0, 0, 0)
  }
}
