import type { Entity, IEntityData, IFrameInfo, IFramePic, IPictureInfo, TFace } from "@/LFW";
import { Buff_Electroshock, clamp, cos, floor, LFW, max, sin, World } from "@/LFW";
import type { IFrameModel, IFrameModelPose } from "@/LFW/defines/IFrameModel";
import type { IModelInfo } from "@/LFW/defines/IModelInfo";
import { Ditto } from "@/LFW/ditto";
import type { AnimationAction, AnimationClip, Bone } from "../_t";
import { AnimationMixer, BufferGeometry, Color, DoubleSide, LoopOnce, LoopRepeat, Mesh, MeshBasicMaterial, Object3D, Quaternion, ShaderMaterial } from "../_t";
import type { ImageMgr } from "../ImageMgr/ImageMgr";
import type { RImageInfo } from "../RImageInfo";
import type { EntityRenderer } from "./EntityRenderer";
import { MeshFactory, MeshKind } from "./factory";
import { OutlineMaterial } from "./materials/OutlineMaterial";
import { OutlineMesh } from "./meshs/OutlineMesh";
import { Shaders } from "./shader";
import { clone as clone_skeleton } from "three/addons/utils/SkeletonUtils.js";
import { ModelCache, type IModelCacheEntry } from "./ModelCache";
import type { WorldRenderer } from "./WorldRenderer";

const get_img_map = (lfw: LFW, data: IEntityData, out: Map<string, RImageInfo>): void => {
  out.clear();
  const { base: { files = {} } } = data;
  const images = lfw.images as ImageMgr;
  for (const key in files) {
    const img = images.find_by_pic_info(files[key]);
    img && out.set(key, img.clone());
  }
};

function make_model_hull_material(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uOutline: { value: 0 },
      uColor: { value: new Color('#000000') },
      uAlpha: { value: 1 },
    },
    vertexShader: Shaders.Vertex.ModelOutline,
    fragmentShader: Shaders.Fragment.ModelOutline,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  })
}

function build_model_hulls(root: Object3D): Mesh[] {
  const hulls: Mesh[] = []
  root.traverse(obj => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry as BufferGeometry
    if (!geo?.getAttribute?.('normal')) return
    const hull = new Mesh(geo, make_model_hull_material())
    hull.name = 'model_outline_hull'
    hull.visible = false
    mesh.parent?.add(hull)
    hulls.push(hull)
  })
  return hulls
}


export class EntityMainRender {
  readonly world_renderer: WorldRenderer;
  readonly owner: EntityRenderer;
  readonly world: World;
  readonly lfw: LFW;
  protected images = new Map<string, RImageInfo>();
  protected entity: Entity;
  protected node = new Object3D();
  protected meshs: OutlineMesh[] = [
    MeshFactory.get(MeshKind.Entity, OutlineMesh)
  ];
  protected blood_mesh = MeshFactory.get(MeshKind.Blood, Mesh<BufferGeometry, MeshBasicMaterial>);
  protected file_variants = new Map<string, string[]>();
  protected shaking = 0;
  protected shaking_x = 0;
  protected data: IEntityData;
  protected frame: IFrameInfo;
  protected facing: TFace;
  protected centerx = 0;
  protected centery = 0;
  protected files: Record<string, IPictureInfo> = {};
  protected models: Record<string, IModelInfo> = {};
  protected model_variants = new Map<string, string[]>();
  protected model_node = new Object3D();
  protected model_key = "";
  protected model_path = "";
  protected model_hulls: Mesh[] = [];
  protected model_sx = 1;
  protected model_outline_key = "";
  protected mixer: AnimationMixer | undefined;
  protected mixer_actions = new Map<string, AnimationAction>();
  protected bone_list: Bone[] = [];
  protected bone_by_name = new Map<string, Bone>();
  protected _q1 = new Quaternion();
  protected _q2 = new Quaternion();
  protected playing_anim = "";
  protected anim_loop = false;
  protected anim_speed = 1;
  protected prev_lifetime = 0;
  protected img: RImageInfo | undefined;
  protected render_effect_time = -1;
  protected variant: number = -1;

  constructor(owner: EntityRenderer) {
    this.owner = owner;
    this.world_renderer = owner.owner;
    const { entity } = owner;
    this.entity = entity;
    this.lfw = entity.lfw;
    this.world = entity.world;
    this.data = entity.data;
    this.frame = entity.frame;
    this.facing = entity.facing;
    this.node.add(this.meshs[0], this.blood_mesh, this.model_node)
  }

  reset(): void {
    const { entity } = this;
    this.frame = entity.frame;
    this.facing = entity.facing;
    this.shaking = 0;
    this.shaking_x = 0;
    this.render_effect_time = -1;
    const { data } = entity;
    this.file_variants.clear();
    const files = this.files = data.base.files ?? {};
    for (const k in files) {
      const file = files[k];
      file.variants?.length && this.file_variants.set(k, [k, ...file.variants]);
    }

    const model_list: IModelInfo[] = [];
    const models = this.models = data.base.models ?? {};
    for (const k in models) {
      const model = models[k];
      model.variants?.length && this.model_variants.set(k, [k, ...model.variants]);
      model_list.push(model);
    }

    this.data = data;
    get_img_map(this.lfw, data, this.images);
    // 贴图与全局 ImageMgr 共享（clip 走 uniforms，无需隔离 texture）。
    // 不要在这里设 needsUpdate：它会 bump 共享 source.version，
    // 导致所有引用同一贴图的实体都在下一帧重新上传 GPU。

    this.dispose_model();
    for (const info of model_list) this.preload_model(info);
    this.meshs[0].visible = false;
    this.meshs[0].name = `Entity Mesh 0: ${this.entity.name}`;

    const mesh_count = this.meshs.length;
    const pics_count = this.data.__pics || 0;
    const count = max(mesh_count, pics_count)
    for (let i = 0; i < count; ++i) {
      let mesh = this.meshs[i + 1];
      if (i <= pics_count) {
        if (!mesh) {
          mesh = MeshFactory.get(MeshKind.Entity, OutlineMesh);
          this.meshs[i + 1] = mesh;
          this.node.add(mesh)
        }
        mesh.name = `Entity Mesh ${i}: ${this.entity.name}`
        mesh.visible = false;
      } else if (mesh) {
        mesh.removeFromParent();
      }
    }
    this.meshs.length = (pics_count + 1);
    for (const mesh of this.meshs) mesh.reset();

    this.blood_mesh.visible = false;
    this.blood_mesh.name = `Blood: ${this.entity.name}`;
  }

  on_mount(): void {
    this.reset()
    this.update_texture();
    this.update_outline();
    this.world_renderer.world_node.add(this.node);
  }

  on_unmount(): void {
    this.node.removeFromParent();
  }

  update_shaking(): void {
    let { shaking, facing, buffs } = this.entity;

    if (!shaking && buffs.size) {
      for (const [, b] of buffs) {
        if (b.kind === Buff_Electroshock.KIND) {
          shaking = b.duration - b.lifetime;
          break;
        }
      }
    }
    if (shaking != this.shaking) {
      this.shaking = shaking;
      this.shaking_x = shaking ? facing * (floor(shaking / 2) % 2 ? 1 : -1) : 0;
    }
  }

  render(): void {
    const { entity, meshs } = this;
    if (this.world_renderer.dirty) {
      const { frame, facing, data, variant } = entity;
      if (data != this.data) {
        this.reset();
        this.update_texture();
        this.update_outline();
      } else if (this.frame !== frame || this.facing !== facing || this.variant !== variant) {
        this.frame = frame;
        this.facing = facing;
        this.variant = variant;
        this.update_texture();
      }
    }

    this.update_shaking();
    this.node.position.copy(this.owner.position);
    const { invisible } = this.owner;
    const { blinking, facing } = entity;
    const visible = !invisible && (!blinking || floor(blinking / 4) % 2 === 0)

    // 3D 模型与 2D 精灵可共存：frame 同时有 pic 和 model 时叠加渲染
    const model = this.get_frame_model(this.frame)
    if (model) {
      this.update_model(model)
      this.update_model_visual(model)
      const b = this.models[model.id]?.scale
      const s = model.scale
      const sx = (b?.x ?? 1) * (s?.x ?? 1)
      const sy = (b?.y ?? 1) * (s?.y ?? 1)
      const sz = (b?.z ?? 1) * (s?.z ?? 1)
      const rad = model.rad ?? 0
      this.model_sx = Math.max(Math.abs(sx), 1e-4)
      this.update_model_outline()
      // 平移 = base 模型 offset + 帧 model offset（缺省 0，逐轴相加，y 向上为正）
      const bo = this.models[model.id]?.offset
      const fo = model.offset
      const ox = (bo?.x ?? 0) + (fo?.x ?? 0)
      const oy = (bo?.y ?? 0) + (fo?.y ?? 0)
      const oz = (bo?.z ?? 0) + (fo?.z ?? 0)
      this.model_node.visible = visible
      this.model_node.position.set(this.shaking_x + ox, oy, oz)
      this.model_node.scale.set(facing * sx, sy, sz)
      this.model_node.rotation.z = facing < 0 ? -rad : rad
    } else {
      this.model_node.visible = false
    }

    const { pic } = this.frame;
    const mesh = meshs[0]
    mesh.visible = visible && !(model && !pic);

    if (pic) {
      const cx = this.centerx + this.shaking_x;
      const cy = this.centery;
      this.update_mesh_position(pic, mesh, cx, cy, 0)
    }

    for (let i = 1; i < meshs.length; i++) {
      const mesh = meshs[i];
      if (!mesh) continue;
      mesh.visible = visible;
      if (!visible) continue;
      const pic = this.frame.pics?.[i - 1]
      if (!pic) mesh.visible = false;
      if (!pic) continue;
      const cx: number = (
        (pic?.cx === void 0) ? this.centerx :
          (facing === 1 ? -pic.cx : pic.cx - pic.w)
      ) + this.shaking_x;
      const cy = pic.cy ?? this.centery;
      // stupid -Gim
      this.update_mesh_position(pic, mesh, cx, cy, 0.05 * i)
    }

    this.render_bpoint();
    this.update_outline();
  }

  /** 获取当前帧要使用的模型（含队伍变体解析） */
  private get_frame_model(frame: IFrameInfo): IFrameModel | undefined {
    const m = frame.model
    if (!m) return void 0
    const { variant } = this.entity
    if (variant) {
      const id = this.model_variants.get(m.id)?.at(variant)
      if (id) return { ...m, id }
    }
    return m
  }

  /** 切换/加载模型（含缓存；姿态/片段驱动在 update_model_visual） */
  private update_model(model: IFrameModel): void {
    if (this.model_key === model.id) return
    this.model_key = model.id
    const info = this.models[model.id]
    if (!info) {
      this.model_node.visible = false
      Ditto.warn(`[EntityMainRender] model "${model.id}" 未在 base.models 中声明`)
      return
    }
    const { path } = this.resolve_model_path(info)
    const cached = ModelCache.instance.peek(path)
    if (cached) {
      this.attach_model(path, cached)
      return
    }
    // 未缓存：保留旧模型（若有）直至新模型加载完成，避免切换瞬间闪没
    void this.load_model(info)
  }

  /** 预加载模型到缓存（不挂载），消除首次渲染的加载空窗 */
  private preload_model(info: IModelInfo): void {
    void this.load_model(info)
  }

  /** 解析 info.path 的查找前缀（! 精确 / ? 模糊） */
  private resolve_model_path(info: IModelInfo): { path: string; exact: boolean } {
    let path = info.path
    let exact = true
    if (path.startsWith('!')) path = path.substring(1)
    else if (path.startsWith('?')) { path = path.substring(1); exact = false }
    return { path, exact }
  }

  /** 异步加载 GLB 到全局缓存；加载完成时若仍是当前需要的模型则挂载 */
  private async load_model(info: IModelInfo): Promise<void> {
    const { path, exact } = this.resolve_model_path(info)
    try {
      const entry = await ModelCache.instance.get(this.lfw, path, exact)
      if (this.models[this.model_key] === info) {
        this.attach_model(path, entry)
      }
    } catch (e) {
      Ditto.warn(`[EntityMainRender] 3D 模型加载失败: ${info.path}`, e)
      ModelCache.instance.invalidate(path)
      // 允许后续帧重试（否则 model_key 已切换且加载失败，模型将永久不显示）
      if (this.model_key === info.id) this.model_key = ""
    }
  }

  private attach_model(path: string, cache: IModelCacheEntry): void {
    if (this.model_path === path) return
    const old_path = this.model_path
    if (old_path) {
      this.model_node.clear()
      this.dispose_model_hulls()
      ModelCache.instance.release(old_path)
    }
    ModelCache.instance.retain(path)
    // 缓存 root 是共享模板（同一 Object3D 只能有一个父节点），直接 add 会被后挂载者抢走 → 只剩一个可见。
    // 每个实体克隆一棵场景图：SkeletonUtils.clone 几何/材质仍共享，蒙皮会克隆并重绑骨架供逐实体动画。
    const clone = clone_skeleton(cache.root)
    this.model_hulls = build_model_hulls(clone)
    this.model_outline_key = ""
    this.model_node.add(clone)
    this.model_node.visible = true
    this.collect_bones(clone)
    this.setup_mixer(clone, cache.animations)
    this.playing_anim = ""
    this.prev_lifetime = this.entity.lifetime
    this.model_path = path
  }

  /** 每帧驱动模型视觉：姿态插值（模式A）与动画片段（模式B） */
  private update_model_visual(model: IFrameModel): void {
    const sim_dt = (this.entity.lifetime - this.prev_lifetime) * this.atom_time()
    this.prev_lifetime = this.entity.lifetime

    if (model.pose) {
      const total = this.frame.wait
      const t = total > 0 ? clamp(1 - this.entity.wait / total, 0, 1) : 1
      this.apply_pose_blend(model.pose, this.get_next_model_pose(), t)
    }
    if (model.anim) this.play_anim(model, sim_dt)
    else this.stop_anim()
  }

  /** 下一帧的姿态（用于当前帧姿态向下一帧插值） */
  private get_next_model_pose(): IFrameModelPose | undefined {
    const next = this.frame.next
    if (!next) return void 0
    const id = typeof next === 'string' ? next : Array.isArray(next) ? (next[0] as any)?.id : (next as any)?.id
    if (!id) return void 0
    return this.data.frames?.[id]?.model?.pose
  }

  /** 应用姿态（与下一帧姿态按 t 混合，t∈[0,1]） */
  private apply_pose_blend(from: IFrameModelPose, to: IFrameModelPose | undefined, t: number): void {
    const bones = this.pose_bones(from)
    if (!bones.length) return
    const { rot, pos, scl } = from
    const rot2 = to?.rot, pos2 = to?.pos, scl2 = to?.scl
    const has_to = !!(to && (rot2 || pos2 || scl2))
    for (let i = 0; i < bones.length; ++i) {
      const bone = bones[i]
      if (rot && rot.length >= (i + 1) * 4) {
        const q = this._q1.set(rot[i * 4], rot[i * 4 + 1], rot[i * 4 + 2], rot[i * 4 + 3])
        if (has_to && rot2 && rot2.length >= (i + 1) * 4) {
          this._q2.set(rot2[i * 4], rot2[i * 4 + 1], rot2[i * 4 + 2], rot2[i * 4 + 3])
          q.slerp(this._q2, t)
        }
        bone.quaternion.copy(q)
      }
      if (pos && pos.length >= (i + 1) * 3) {
        let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]
        if (has_to && pos2 && pos2.length >= (i + 1) * 3) {
          x += (pos2[i * 3] - x) * t
          y += (pos2[i * 3 + 1] - y) * t
          z += (pos2[i * 3 + 2] - z) * t
        }
        bone.position.set(x, y, z)
      }
      if (scl && scl.length >= (i + 1) * 3) {
        let x = scl[i * 3], y = scl[i * 3 + 1], z = scl[i * 3 + 2]
        if (has_to && scl2 && scl2.length >= (i + 1) * 3) {
          x += (scl2[i * 3] - x) * t
          y += (scl2[i * 3 + 1] - y) * t
          z += (scl2[i * 3 + 2] - z) * t
        }
        bone.scale.set(x, y, z)
      }
    }
  }

  /** 按 pose.bones（名称）或骨骼遍历顺序取骨骼列表 */
  private pose_bones(pose: IFrameModelPose): Bone[] {
    const names = pose.bones
    if (names?.length) {
      const ret: Bone[] = []
      for (const n of names) {
        const b = this.bone_by_name.get(n)
        if (b) ret.push(b)
      }
      return ret
    }
    return this.bone_list
  }

  /** 收集模型根下的骨骼 */
  private collect_bones(root: Object3D): void {
    this.bone_list = []
    this.bone_by_name.clear()
    root.traverse(obj => {
      const bone = obj as Bone
      if (bone.isBone) {
        this.bone_list.push(bone)
        if (obj.name) this.bone_by_name.set(obj.name, bone)
      }
    })
  }

  /** 用 glTF 动画片段初始化 mixer */
  private setup_mixer(root: Object3D, animations: AnimationClip[]): void {
    this.mixer = new AnimationMixer(root)
    this.mixer_actions.clear()
    for (const clip of animations) {
      this.mixer_actions.set(clip.name, this.mixer.clipAction(clip))
    }
  }

  /** 播放/推进动画片段（确定性：用实体 lifetime 差作为模拟时钟） */
  private play_anim(model: IFrameModel, sim_dt: number): void {
    if (!this.mixer) return
    const name = model.anim ?? ''
    const loop = !!model.loop
    const speed = model.time_scale ?? 1
    if (this.playing_anim !== name || this.anim_loop !== loop) {
      this.playing_anim = name
      this.anim_loop = loop
      this.anim_speed = speed
      for (const [, a] of this.mixer_actions) a.stop()
      const action = this.mixer_actions.get(name)
      if (action) {
        action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1)
        action.timeScale = speed
        action.reset().play()
      }
    } else if (this.anim_speed !== speed) {
      this.anim_speed = speed
      this.mixer_actions.get(name)?.setEffectiveTimeScale(speed)
    }
    this.mixer.update(sim_dt)
  }

  private stop_anim(): void {
    if (!this.playing_anim) return
    this.playing_anim = ""
    for (const [, a] of this.mixer_actions) a.stop()
  }

  private atom_time(): number {
    return this.world.dataset.atom_time
  }

  /** 卸载模型节点、释放引用（全局缓存决定是否回收 GPU 资源） */
  private dispose_model(): void {
    this.model_key = ""
    this.model_node.visible = false
    this.mixer?.stopAllAction()
    this.mixer = undefined
    this.mixer_actions.clear()
    this.playing_anim = ""
    this.bone_list = []
    this.bone_by_name.clear()
    if (this.model_path) {
      ModelCache.instance.release(this.model_path)
      this.model_path = ""
    }
    this.model_node.clear()
    this.dispose_model_hulls()
    this.model_sx = 1
    this.model_outline_key = ""
  }

  private dispose_model_hulls(): void {
    for (const hull of this.model_hulls) {
      (hull.material as ShaderMaterial)?.dispose?.()
    }
    this.model_hulls = []
  }

  private update_model_outline(): void {
    const hulls = this.model_hulls
    if (!hulls.length) return
    const { ghosted, outline_color, outline_alpha, outline_width, outline_enabled } = this.entity
    const show = !ghosted && !!outline_color && !!outline_alpha && !!outline_enabled
    const key = `${show}:${outline_color || ''}:${outline_alpha}:${outline_width}:${outline_enabled}:${this.model_sx}`
    if (key === this.model_outline_key) return
    this.model_outline_key = key
    const width_local = show ? outline_width / this.model_sx : 0
    for (const hull of hulls) {
      const m = hull.material as ShaderMaterial
      m.uniforms.uOutline.value = width_local
      m.uniforms.uColor.value.set(outline_color || '#000')
      m.uniforms.uAlpha.value = show ? outline_alpha : 0
      hull.visible = show
    }
  }

  private update_mesh_position(pic: IFramePic, mesh: Mesh<BufferGeometry, OutlineMaterial>, cx: number, cy: number, cz: number) {
    const rad = pic?.rad
    if (!pic || !rad) {
      mesh.position.x = cx;
      mesh.position.y = cy;
      mesh.position.z = cz;
      mesh.rotation.z = 0;
      return;
    }
    const ox = pic?.ox ?? pic.w / 2;
    const oy = pic?.oy ?? pic.h / 2;
    const px = cx + ox;
    const py = cy - oy;
    const dx = cx - px;
    const dy = cy - py;
    const flipped = this.facing < 0;
    const _cos = pic.__cos_r ?? cos(rad);
    const _sin = (pic.__sin_r ?? sin(rad)) * (flipped ? -1 : 1);
    mesh.position.x = px + dx * _cos - dy * _sin;
    mesh.position.y = py + dx * _sin + dy * _cos;
    mesh.position.z = cz;
    mesh.rotation.z = flipped ? -rad : rad;
  }
  private update_mesh_material(pic: IFramePic, mesh: Mesh<BufferGeometry, OutlineMaterial>) {
    mesh.scale.set(pic.w, pic.h, 0);
    const { entity } = this;
    const { variant } = entity;
    const { material: m } = mesh;
    let { tex } = pic;
    if (variant) tex = this.file_variants.get(tex)?.at(variant) ?? tex;
    const { images } = this;
    const img = this.img = images.get(tex);
    if (img?.pic) {
      m.texture = img.pic.texture;
      m.set_tex_size(img.w, img.h, img.scale)
    } else {
      m.texture = void 0;
    }
    m.set_clip(pic.x, pic.y, pic.w, pic.h)
    m.flip_x = entity.facing;
  }

  private update_texture() {
    const { meshs, entity } = this;
    const { frame, facing } = entity;
    const { centerx, centery, width } = frame;
    const { pic, pics } = frame;
    this.centerx = facing === 1 ? -centerx : centerx - width;
    this.centery = centery;
    if (pic) this.update_mesh_material(pic, this.meshs[0])
    for (let i = 0; pics && i < pics?.length; ++i) {
      const pic = pics[i];
      const mesh = meshs[i + 1];
      if (!pic || !mesh) continue;
      this.update_mesh_material(pic, mesh);
    }
  }


  private update_outline(): void {
    const { ghosted, render_effect_time } = this.entity;
    if (ghosted) return;

    if (this.render_effect_time == render_effect_time) return;
    this.render_effect_time = render_effect_time;
    const mesh0 = this.meshs[0];
    const { material: m } = mesh0;
    const {
      outline_color,
      outline_alpha,
      outline_width,
      outline_enabled,
      greyscale,
      mix_color,
      mix_strength
    } = this.entity;

    if (outline_color && outline_alpha && outline_enabled) {
      m.outlineColor.set(outline_color);
      m.outlineAlpha = outline_alpha;
      m.outlineWidth = outline_width * (this.img?.scale ?? 1)
    } else {
      m.outlineWidth = 0;
      m.outlineAlpha = 0;
    }
    m.gray = greyscale;
    if (mix_strength) {
      m.mixColor.set(mix_color);
      m.mixStrength = mix_strength;
    } else {
      m.mixStrength = 0;
    }
  }

  private render_bpoint(): void {
    const { entity } = this;
    const { bpoint } = entity.frame;
    const mesh0 = this.meshs[0]
    const visible = !!bpoint && mesh0.visible && entity.hp < entity.hp_max * 0.33;
    this.blood_mesh.visible = visible;

    if (!visible) return;

    let { x: bx, y: by, z: bz = 0.1, r = 0 } = bpoint;
    bx = entity.facing === 1 ? bx : mesh0.scale.x - bx;
    this.blood_mesh.position.set(this.centerx + bx, this.centery - by, bz);
  }
}


