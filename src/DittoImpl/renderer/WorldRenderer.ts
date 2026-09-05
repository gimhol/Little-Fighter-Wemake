import { Defines, floor, min } from "@/LFW";
import type { IWorldRenderer } from "@/LFW/ditto/render/IWorldRenderer";
import type { Entity } from "@/LFW/entity";
import type { LFW } from "@/LFW/LFW";
import type { World } from "@/LFW/World";
import { AmbientLight, CSS2DRenderer, Camera, DirectionalLight, Object3D, OrthographicCamera, Scene, Vector3, WebGLRenderer } from "../_t";
import { BgRender } from "./BgRender";
import { EntityRenderer } from "./EntityRenderer";
import { BG_INDICATINGS } from "./INDICATINGS";
import csses from "./styles.module.scss";
import { TerrainIndicator } from "./TerrainIndicator";

/** 组内是否有成员当前显示 3D 模型（模块级函数，避免每帧生成闭包） */
const group_has_model = (g: EntityRenderer[]): boolean => {
  for (let i = 0; i < g.length; i++) if (g[i].has_model) return true;
  return false;
};
/** 组按代表实体 z 远→近排序 */
const by_group_z = (a: EntityRenderer[], b: EntityRenderer[]) => a[0].position.z - b[0].position.z;

export class WorldRenderer implements IWorldRenderer {
  readonly lfw: LFW;
  readonly world: World;
  readonly bg_render: BgRender;
  readonly bg_flags: TerrainIndicator;
  readonly camera: Camera;
  readonly ui_bg_camera: OrthographicCamera;
  readonly ui_fg_camera: OrthographicCamera;
  readonly ui_bg_container: Object3D;
  readonly ui_fg_container: Object3D;
  readonly ui_offset = new Vector3(0, 0, 0);
  readonly bg_container: Object3D;
  readonly bg_offset = new Vector3(0, 0, 0);
  readonly world_node = new Object3D();
  readonly overlay_node = new Object3D();
  readonly world_offset = new Vector3(0, 0, 0);
  readonly ambient_light: AmbientLight;
  readonly directional_light: DirectionalLight;
  readonly is_scene_node = true;
  protected _cameras = new Set<Camera>();
  protected _renderer?: WebGLRenderer;
  protected _css_renderer?: CSS2DRenderer;
  protected _canvas_ob = new MutationObserver(() => this.on_win_resize());
  protected scene: Scene = new Scene();
  protected ui_bg_scene = new Scene();
  protected ui_fg_scene = new Scene();
  protected renderer_w: number = 0;
  protected renderer_h: number = 0;
  /** 渲染缓冲尺寸（LineMaterial.resolution 需要与之匹配，否则线宽错误） */
  get renderer_size() {
    return { w: this.renderer_w, h: this.renderer_h };
  }
  indicators: number = 0;

  /** 实体分组复用缓冲（避免每帧 new） */
  protected _grp_pool: EntityRenderer[][] = [];
  protected _grp_map = new Map<EntityRenderer, EntityRenderer[]>();
  protected _grps: EntityRenderer[][] = [];

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
    this.bg_flags = new TerrainIndicator(this);
    this.set_renderer_size(w * 4, h * 4);
    this.scene.add(this.world_node);
    this.world_node.add(this.overlay_node);

    this.ui_bg_container = new Object3D();
    this.ui_bg_scene.add(this.ui_bg_container);
    this.ui_fg_container = new Object3D();
    this.ui_fg_scene.add(this.ui_fg_container);

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
      this.ui_bg_camera = this.make_ui_camera(camera, "ui_bg_camera")
      this.ui_fg_camera = this.make_ui_camera(camera, "ui_fg_camera")
    }
    // 场景光：GLB/GLTF 是 PBR（MeshStandardMaterial），无光则全黑。
    // 2D 精灵/背景均为 MeshBasicMaterial / 自定义 ShaderMaterial（无光照），不受这些灯影响。
    this.ambient_light = new AmbientLight(0xffffff, 0.7);
    this.directional_light = new DirectionalLight(0xffffff, 1.4);
    // 左上前方照向原点（平行光只看方向）；可后续按观感调整
    this.directional_light.position.set(-300, 400, 600);
    this.scene.add(this.ambient_light, this.directional_light);

    window.addEventListener('resize', this.on_win_resize)
  }

  add_entity(entity: Entity): void {
    this.mount_renderer(entity)
  }
  /** 创建（如有）+ 挂载 + 登记渲染器 */
  protected mount_renderer(entity: Entity): void {
    let renderer: EntityRenderer = entity.renderer as EntityRenderer;
    if (!renderer) renderer = entity.renderer = new EntityRenderer(entity)
    if (!renderer || renderer.mounted) return;
    renderer.mount();
    renderer.mounted = true;
  }
  del_entity(e: Entity): void {
    const renderer: EntityRenderer = e.renderer as EntityRenderer;
    if (!renderer || !renderer.mounted) return;
    renderer.unmount();
    renderer.mounted = false;
  }
  /** 单趟实体渲染（world.entities 为唯一来源） */
  protected render_entities(dt: number, df: number): void {
    const { entities } = this.world;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.bearer || e.catcher) continue;
      this.mount_renderer(e);
      e.renderer!.render(dt, df);
    }
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
      this.cam_p1.x = this.world.camera.position.x;
      this.cam_p1.y = this.world.camera.position.y;
    }

    this.camera.position.lerpVectors(this.cam_p0, this.cam_p1, this.dfactor)
    this.ui_bg_camera.position.copy(this.camera.position);
    this.ui_fg_camera.position.copy(this.camera.position);
    const ui_x = this.camera.position.x + this.ui_offset.x;
    const ui_y = this.camera.position.y + this.world.dataset.screen_h + this.ui_offset.y;
    this.ui_bg_container.position.set(ui_x, ui_y, this.ui_offset.z)
    this.ui_fg_container.position.set(ui_x, ui_y, this.ui_offset.z)
    const { dataset: { entity_flags }, transform } = this.world;
    const { x, y, z, scale_x, scale_y, scale_z } = transform
    this.world_node.position.set(
      x + this.world_offset.x,
      y + this.world_offset.y,
      z + this.world_offset.z
    );
    this.world_node.scale.set(scale_x, scale_y, scale_z);
    if (entity_flags != this.indicators)
      this.indicators = entity_flags;
    this.bg_render.render(dt);
    const { bg_flags } = this.world.dataset;
    this.bg_flags.set_visible(!!(bg_flags & BG_INDICATINGS.terrain));
    this.bg_flags.render();
    this.bg_render.set_indicator_visible(!!(bg_flags & BG_INDICATINGS.layer));
    this.render_entities(dt, this.dfactor);
    for (const ui_stack of this.lfw.ui_stacks)
      ui_stack.ui?.renderer.render(dt, this.dfactor)

    this.render_layers();
    this.dirty = false;
  }

  protected make_ui_camera(src: Camera, name: string): OrthographicCamera {
    const o = src as OrthographicCamera
    const c = new OrthographicCamera()
    c.left = o.left; c.right = o.right;
    c.top = o.top; c.bottom = o.bottom;
    c.near = o.near; c.far = o.far;
    c.position.copy(o.position);
    c.name = name;
    c.updateProjectionMatrix();
    return c;
  }

  protected render_layers(): void {
    const r = this._renderer;
    if (!r) return;
    const css = this._css_renderer;
    r.autoClear = false;
    r.clear(true, true, true);
    r.render(this.ui_bg_scene, this.ui_bg_camera);
    css?.render(this.ui_bg_scene, this.ui_bg_camera);

    // 背景（MeshBasic 无光照，单独成根绘制，始终位于实体之后）
    r.clearDepth();
    r.render(this.bg_container, this.camera);
    // 实体：跨实体遮挡按“实体 z 平面”画家判定（组间清深度、组内真实深度）。
    // 纯 2D 时所有组合并为一次渲染，行为与单次 scene 渲染一致。
    const groups = this.collect_entity_groups();
    this.render_world_entities(groups);
    this.render_world_overlay(groups);
    // 归还复用的组数组，供下一帧再次使用
    for (let i = 0; i < groups.length; i++) this._grp_pool.push(groups[i]);
    css?.render(this.scene, this.camera);

    r.clearDepth();
    r.render(this.ui_fg_scene, this.ui_fg_camera);
    css?.render(this.ui_fg_scene, this.ui_fg_camera);
  }

  /** 收集已挂载实体渲染器为“组”：持有者与其持有/抓住的实体同组；组按 z 远→近排序（复用缓冲） */
  protected collect_entity_groups(): EntityRenderer[][] {
    const { entities } = this.world;
    const map = this._grp_map;
    map.clear();
    const out = this._grps;
    out.length = 0;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const er = e.renderer as EntityRenderer | undefined;
      if (!er?.mounted || !er.body) continue;
      const holder = (e.bearer ?? e.catcher) as Entity | undefined;
      const hr = holder?.renderer as EntityRenderer | undefined;
      let key = er;
      if (holder && hr?.mounted && hr.body) key = hr;
      let g = map.get(key);
      if (!g) {
        g = this._grp_pool.pop();
        if (!g) g = [];
        g.length = 1;
        g[0] = key;
        map.set(key, g);
      }
      if (er !== key) g.push(er);
    }
    for (const g of map.values()) out.push(g);
    out.sort(by_group_z);
    return out;
  }

  /**
   * 实体主体绘制：组已按 z 远→近排序。
   * - 含 3D 模型的组各自独立 pass（必须隔离深度）；
   * - 连续纯 2D 组并入同一 pass（2D-2D 靠画家排序本就正确），
   *   渲染次数与“模型实体数”成正比而非实体总数。
   * 仅用索引循环，不建 passes/闭包，避免每帧分配。
   */
  protected render_world_entities(groups: EntityRenderer[][]): void {
    const r = this._renderer;
    if (!r || !groups.length) return;
    this.bg_container.visible = false;
    this.overlay_node.visible = false;
    this.world_node.updateMatrixWorld(true);
    for (const g of groups) for (const er of g) er.body.visible = false;

    const n = groups.length;
    let i = 0;
    while (i < n) {
      const g = groups[i];
      if (group_has_model(g)) {
        // 模型组：独立 pass
        for (const er of g) er.body.visible = true;
        r.clearDepth();
        r.render(this.scene, this.camera);
        for (const er of g) er.body.visible = false;
        i++;
      } else {
        // 连续纯 2D 组并入一次 pass（同一 scene.render 内仍按 z 画家排序）
        let j = i;
        while (j < n && !group_has_model(groups[j])) {
          for (const er of groups[j]) er.body.visible = true;
          j++;
        }
        r.clearDepth();
        r.render(this.scene, this.camera);
        for (let k = i; k < j; k++) for (const er of groups[k]) er.body.visible = false;
        i = j;
      }
    }
    this.bg_container.visible = true;
    this.overlay_node.visible = true;
  }

  protected render_world_overlay(groups: EntityRenderer[][]): void {
    const r = this._renderer;
    if (!r) return;
    // 叠加层仅剩地面调试网格等，平时为空 → 整段跳过，省一次 scene.render
    if (this.overlay_node.children.length) {
      this.bg_container.visible = false;
      for (const g of groups) for (const er of g) er.body.visible = false;
      this.world_node.updateMatrixWorld(true);
      r.clearDepth();
      r.render(this.scene, this.camera);
      this.bg_container.visible = true;
    }
    // 实体主体恢复可见（供下一帧 css / 单次渲染等读取）
    for (const g of groups) for (const er of g) er.body.visible = true;
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
      this._renderer = new WebGLRenderer({ canvas });
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
    this.bg_flags.release();
  }
}
