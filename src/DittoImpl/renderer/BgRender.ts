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
  protected fg_root_node: Object3D | null = null;
  protected fg_cam_node: Object3D | null = null;
  protected layers: BgLayerRender[] = [];
  protected quaternion = new T.Quaternion();

  constructor(world_renderer: WorldRenderer) {
    this.world = world_renderer.world;
    this.world_renderer = world_renderer;
  }

  set_bg(bg: Background | null): void {
    this.clear_nodes();
    this.bg = bg;
    if (!this.bg) return

    const { base } = this.bg.data
    
    this.cam_node = new T.Object3D();
    this.cam_node.name = "Background(Cam Follower):" + base.name;

    this.root_node = new T.Object3D();
    this.root_node.name = "Background:" + base.name;


    for (const layer of this.bg.layers) {
      const layer_render = new BgLayerRender(this, layer)
      this.layers.push(layer_render);

      const is_fg = layer.info.z > 0;
      if (is_fg) {
        const [root, cam] = this.ensure_fg_nodes(base.name);
        if (layer.info.absolute) cam.add(layer_render.mesh);
        else root.add(layer_render.mesh);
      } else if (layer.info.absolute) {
        this.cam_node!.add(layer_render.mesh);
      } else {
        this.root_node!.add(layer_render.mesh);
      }
    }
    this.world_renderer.bg_container.add(this.root_node, this.cam_node);
  }

  /** 惰性创建前景（z>0 图层）的根 / 相机跟随节点，挂到 fg_container */
  protected ensure_fg_nodes(name: string | undefined): [Object3D, Object3D] {
    if (this.fg_root_node && this.fg_cam_node) return [this.fg_root_node, this.fg_cam_node];
    this.fg_cam_node = new T.Object3D();
    this.fg_cam_node.name = "Foreground(Cam Follower):" + name;
    this.fg_root_node = new T.Object3D();
    this.fg_root_node.name = "Foreground:" + name;
    this.world_renderer.fg_container.add(this.fg_root_node, this.fg_cam_node);
    return [this.fg_root_node, this.fg_cam_node];
  }

  protected clear_nodes(): void {
    this.root_node?.removeFromParent();
    this.cam_node?.removeFromParent();
    this.fg_root_node?.removeFromParent();
    this.fg_cam_node?.removeFromParent();
    this.root_node = null
    this.cam_node = null
    this.fg_root_node = null
    this.fg_cam_node = null
    for (const layer of this.layers) layer.release();
    this.layers.length = 0;
  }

  render(dt: number): void {
    const cam_x = this.world_renderer.camera.position.x;
    const zoom_x = this.world.bg?.zoom_x ?? 1;
    const { root_node, fg_root_node, layers, cam_node, fg_cam_node } = this;
    const { bg } = this.world
    if (this.bg !== bg) this.set_bg(bg)
    this.world_renderer.camera.getWorldQuaternion(this.quaternion);
    if (root_node) {
      root_node.setRotationFromQuaternion(this.quaternion);
      root_node.position.x = cam_x * (1 - zoom_x);
    }
    if (fg_root_node) {
      fg_root_node.setRotationFromQuaternion(this.quaternion);
      fg_root_node.position.x = cam_x * (1 - zoom_x);
    }
    if (cam_node) {
      cam_node.setRotationFromQuaternion(this.quaternion);
      cam_node.position.x = cam_x;
    }
    if (fg_cam_node) {
      fg_cam_node.setRotationFromQuaternion(this.quaternion);
      fg_cam_node.position.x = cam_x;
    }
    for (const layer of layers) layer.render(dt);
  }

  set_indicator_visible(v: boolean): void {
    for (const l of this.layers) l.set_indicator_visible(v);
  }

  release(): void {
    this.clear_nodes();
    this.bg = null
    this.quaternion.set(0, 0, 0, 0)
  }
}
