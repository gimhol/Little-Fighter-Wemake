import { Defines, floor, min } from "@/LFW";
import type { IWorldRenderer } from "@/LFW/ditto/render/IWorldRenderer";
import type { Entity } from "@/LFW/entity";
import type { LFW } from "@/LFW/LFW";
import type { World } from "@/LFW/World";
import { CSS2DRenderer, Camera, Object3D, OrthographicCamera, Scene, Vector3, WebGLRenderer } from "../_t";
import { BgRender } from "./BgRender";
import { EntityRenderer } from "./EntityRenderer";
import { TerrainIndicator } from "./TerrainIndicator";
import csses from "./styles.module.scss";

export class WorldRenderer implements IWorldRenderer {
  readonly lfw: LFW;
  readonly world: World;
  readonly bg_render: BgRender;
  readonly terrain_indicator: TerrainIndicator;
  readonly camera: Camera;
  readonly ui_container: Object3D;
  readonly ui_offset = new Vector3(0, 0, 0);
  readonly bg_container: Object3D;
  readonly bg_offset = new Vector3(0, 0, 0);
  readonly entity_renderers = new Set<EntityRenderer>();
  readonly world_node = new Object3D();
  readonly world_offset = new Vector3(0, 0, 0);
  readonly is_scene_node = true;
  protected _cameras = new Set<Camera>();
  protected _renderer?: WebGLRenderer;
  protected _css_renderer?: CSS2DRenderer;
  protected _canvas_ob = new MutationObserver(() => this.on_win_resize());
  protected scene: Scene = new Scene();
  protected renderer_w: number = 0;
  protected renderer_h: number = 0;
  indicators: number = 0;

  private cam_p0 = new Vector3()
  private cam_p1 = new Vector3()

  set_renderer_size(w: number, h: number): this {
    this.renderer_w = w;
    this.renderer_h = h;
    this._renderer?.setSize(w, h, false);
    return this;
  }
  on_win_resize = () => {
    if (!this._css_renderer || !this._renderer) return;
    const styles = window.getComputedStyle(this._renderer.domElement)
    let w = parseInt(styles.width)
    let h = parseInt(styles.height)
    const scale = w / Defines.CLASSIC_SCREEN_WIDTH
    this._css_renderer.setSize(w / scale, h / scale)
    this._css_renderer.domElement.style.top = styles.top;
    this._css_renderer.domElement.style.left = styles.left;
    this._css_renderer.domElement.style.width = floor(w / scale) + 'px';
    this._css_renderer.domElement.style.height = floor(h / scale) + 'px';
    this._css_renderer.domElement.style.zIndex = '1';
    this._css_renderer.domElement.style.transform = `scale(${scale})`
    this._css_renderer.domElement.style.transformOrigin = `0px 0px`
  }
  constructor(world: World) {
    if (!world) debugger;
    if (!world.lfw) debugger;

    this.world = world;
    this.lfw = world.lfw;
    const w = world.dataset.screen_w;
    const h = world.dataset.screen_h;

    this.bg_render = new BgRender(this);
    this.terrain_indicator = new TerrainIndicator(this);
    this.set_renderer_size(w * 4, h * 4);
    this.scene.add(this.world_node);

    this.ui_container = new Object3D();
    this.scene.add(this.ui_container);

    this.bg_container = new Object3D();
    this.scene.add(this.bg_container);
    {
      const camera = this.camera = new OrthographicCamera()
      camera.left = 0;
      camera.right = w;
      camera.top = h;
      camera.bottom = 0;
      camera.near = 0.1;
      camera.far = 1000000;
      camera.position.set(0, 0, 100)
      this.cam_p1.copy(camera.position)
      this.cam_p0.copy(camera.position)
      camera.name = "default_orthographic_camera"
      this.add_camera(camera);
      camera.updateProjectionMatrix();
    }

    {
      // this.ui_offset.x = -Defines.MODERN_SCREEN_WIDTH / 2
      // this.ui_offset.y = -Defines.MODERN_SCREEN_HEIGHT / 2
      // this.world_offset.x = -Defines.MODERN_SCREEN_WIDTH / 2
      // this.world_offset.y = -Defines.MODERN_SCREEN_HEIGHT / 2

      // const camera = this.camera = new PerspectiveCamera()
      // camera.aspect = Defines.MODERN_SCREEN_WIDTH / Defines.MODERN_SCREEN_HEIGHT
      // camera.near = 0.1;
      // camera.far = 2000;
      // camera.position.set(0, 0, 482)
      // camera.name = "default_orthographic_camera"
      // this.scene.add_camera(camera);
      // camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', this.on_win_resize)
  }

  add_entity(entity: Entity): void {
    let renderer: EntityRenderer = entity.renderer;
    if (!renderer) renderer = entity.renderer = new EntityRenderer(entity)

    renderer.mount();
    this.entity_renderers.add(renderer)
  }
  del_entity(e: Entity): void {
    const renderer: EntityRenderer = e.renderer;
    if (!renderer) return;
    renderer.unmount();
    this.entity_renderers.delete(renderer);
  }
  tu: number = 1;
  utime: number = 0;
  dtime: number = 0;
  dfactor: number = 1;
  dirty: boolean = false;
  render(dt: number): void {
    this.tu = this.world.TU;
    const utime = this.world.lifetime
    if (this.world.FPS <= this.world.dataset.UPS) {
      this.utime = utime;
      this.dtime = this.tu;
      this.dfactor = 1;
      this.dirty = true;
    } else if (this.utime != utime) {
      this.utime = utime;
      this.dtime = 0;
      this.dfactor = 0;
      this.dirty = true;
    } else {
      this.dtime = min(this.dtime + dt, this.tu);
      this.dfactor = min(this.dtime / this.tu, 1);
    }

    if (this.dirty) {
      this.cam_p0.copy(this.cam_p1)
      this.cam_p1.x = this.world.current_cam_pos.x;
      this.cam_p1.y = this.world.current_cam_pos.y;
    }

    this.camera.position.lerpVectors(this.cam_p0, this.cam_p1, this.dfactor)
    this.ui_container.position.set(
      this.camera.position.x + this.ui_offset.x,
      this.camera.position.y + this.world.dataset.screen_h + this.ui_offset.y,
      this.ui_offset.z
    )
    const { dataset: { indicator_flags }, transform } = this.world;
    let { x, y, z, earthquake, earthquake_level, scale_x, scale_y, scale_z } = transform
    if (earthquake) x += Math.floor(Math.random() * (earthquake_level * 2 + 1)) - earthquake_level
    this.world_node.position.set(
      x + this.world_offset.x,
      y + this.world_offset.y,
      z + this.world_offset.z
    );
    this.world_node.scale.set(scale_x, scale_y, scale_z);
    if (indicator_flags != this.indicators)
      this.indicators = indicator_flags;
    this.bg_render.render(dt);
    this.terrain_indicator.set_visible(!!this.world.dataset.terrain_indicator);
    this.terrain_indicator.render();
    for (const renderer of this.entity_renderers) {
      if (renderer.entity.bearer || renderer.entity.catcher)
        continue;
      renderer.render(dt)
    }
    for (const ui_stack of this.lfw.ui_stacks)
      ui_stack.ui?.renderer.render(dt)

    const { scene } = this;
    for (const camera of this._cameras) {
      this._renderer?.render(scene, camera);
      this._css_renderer?.render(scene, camera);
    }
    this.dirty = false;
  }
  set_canvas(canvas: HTMLCanvasElement | null | undefined) {
    if (this._renderer) {
      if (canvas === this._renderer.domElement)
        return;
      this._renderer.clear();
      this._renderer.dispose();
    }
    this._renderer = void 0;
    if (canvas) {
      const { renderer_w, renderer_h } = this;
      this._canvas_ob.observe(canvas, { attributes: true, attributeFilter: ['style'] })
      this._renderer = new WebGLRenderer({
        canvas,
        // premultipliedAlpha: false 
      });
      this._renderer.setSize(renderer_w, renderer_h, false);
      this._css_renderer = new CSS2DRenderer();
      this._css_renderer.domElement.className = csses.css_2d_renderer
      this.on_win_resize()
      canvas.parentElement?.appendChild(this._css_renderer.domElement);
    } else {
      this._canvas_ob.disconnect()
    }
  }
  add_camera(...cameras: Camera[]) {
    for (const camera of cameras) {
      if (this._cameras.has(camera)) continue;
      this._cameras.add(camera);
    }
  }
  dispose() {
    window.removeEventListener('resize', this.on_win_resize)
    if (this._css_renderer) this._css_renderer?.domElement.remove()
    this._canvas_ob.disconnect()
    this._renderer?.clear();
    this._renderer?.dispose();
    this._renderer = void 0;
    this.bg_render.release();
    this.terrain_indicator.release();
  }
}
