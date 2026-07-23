import type { Entity, IEntityData, IFrameInfo, IPictureInfo, TFace } from "@/LFW";
import { Buff_Electroshock, clamp, floor, LFW, StateEnum, World } from "@/LFW";
import type { IModelInfo } from "@/LFW/defines/IModelInfo";
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D, Vector3 } from "../_t";
import type { ImageMgr } from "../ImageMgr/ImageMgr";
import type { RImageInfo } from "../RImageInfo";
import type { EntityRenderer } from "./EntityRenderer";
import { MeshFactory, MeshKind } from "./factory";
import { OutlineMaterial } from "./materials/OutlineMaterial";
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


export class EntityMainRender {
  readonly world_renderer: WorldRenderer;
  readonly owner: EntityRenderer;
  readonly world: World;
  readonly lfw: LFW;
  protected images = new Map<string, RImageInfo>();
  protected entity: Entity;
  protected node = new Object3D();
  protected main_mesh = MeshFactory.get(MeshKind.Entity, Mesh<BufferGeometry, OutlineMaterial>);
  protected sub_meshs: Mesh<BufferGeometry, OutlineMaterial>[] = [];
  protected blood_mesh = MeshFactory.get(MeshKind.Blood, Mesh<BufferGeometry, MeshBasicMaterial>);
  protected file_variants = new Map<string, string[]>();
  protected shaking = 0;
  protected shaking_x = 0;
  protected data: IEntityData;
  protected frame: IFrameInfo;
  protected facing: TFace;
  protected p0 = new Vector3();
  protected p1 = new Vector3();
  protected centerx = 0;
  protected centery = 0;
  protected files: Record<string, IPictureInfo> = {};
  protected models: Record<string, IModelInfo> = {};
  protected model_variants = new Map<string, string[]>();
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
    this.node.add(this.main_mesh, this.blood_mesh)
  }

  reset(): void {
    const { entity } = this;
    this.frame = entity.frame;
    this.facing = entity.facing;
    this.p0.set(0, 0, 0);
    this.p1.set(0, 0, 0);
    this.shaking = 0;
    this.shaking_x = 0;
    const { data } = entity;
    this.file_variants.clear();
    const files = this.files = data.base.files ?? {};
    for (const k in files) {
      const file = files[k];
      file.variants?.length && this.file_variants.set(k, [k, ...file.variants]);
    }

    const models = this.models = data.base.models ?? {};
    for (const k in models) {
      const model = models[k];
      model.variants?.length && this.model_variants.set(k, [k, ...model.variants]);
    }

    this.data = data;
    get_img_map(this.lfw, data, this.images);
    for (const img of this.images.values()) {
      img.pic?.texture && (img.pic.texture.needsUpdate = true);
    }

    this.main_mesh.visible = false;
    this.main_mesh.name = `Entity: ${this.entity.name}`;

    this.blood_mesh.visible = false;
    this.blood_mesh.name = `Blood: ${this.entity.name}`;

    this.sub_meshs.length = 0;
    if (this.data.__pics) {
      for (let i = 0; i < this.data.__pics; i++) {
        const sub_mesh = MeshFactory.get(MeshKind.Entity, Mesh<BufferGeometry, OutlineMaterial>);
        sub_mesh.name = `Entity: ${this.entity.name} SubMesh[${i}]`
        sub_mesh.visible = false;
        this.sub_meshs[i] = sub_mesh;
        this.node.add(sub_mesh)
      }
    }
  }

  on_mount(): void {
    this.reset()
    this.update_texture();
    this.update_outline();
    this.update_position(true);
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
    const { entity, main_mesh, sub_meshs } = this;
    if (this.world_renderer.dirty) {
      const { frame, facing, data, variant } = entity;
      if (data != this.data) {
        this.reset();
        this.update_texture();
        this.update_outline();
        this.update_position(true);
      } else if (this.frame !== frame || this.facing !== facing || this.variant !== variant) {
        this.frame = frame;
        this.facing = facing;
        this.variant = variant;
        this.update_texture();
        this.update_position();
      } else {
        this.update_position();
      }
    }

    this.update_shaking();
    const holder = (entity.bearer?.renderer ?? entity.catcher?.renderer) as EntityRenderer;
    if (!holder) {
      let { dfactor } = this.world_renderer;
      entity.lifetime === 0 && (dfactor = 1);
      this.node.position.lerpVectors(this.p0, this.p1, dfactor);
    } else {
      this.node.position.copy(this.p1);
      this.node.position.x -= holder.main.p1.x - holder.main.node.position.x;
      this.node.position.y -= holder.main.p1.y - holder.main.node.position.y;
      this.node.position.z -= holder.main.p1.z - holder.main.node.position.z;
    }
    const { invisible } = this.owner;
    const { blinking } = entity;

    main_mesh.visible = !invisible && (!blinking || floor(blinking / 4) % 2 === 0);
    main_mesh.position.set(this.centerx + this.shaking_x, this.centery, 0);


    if (sub_meshs.length) for (let i = 0; i < sub_meshs.length; i++) {
      sub_meshs[i].position.copy(main_mesh.position);
      sub_meshs[i].visible = main_mesh.visible;
    }

    this.render_bpoint();
    this.update_outline();
  }

  private update_texture() {
    const { main_mesh, entity } = this;
    const { frame, facing, variant } = entity;
    const { centerx, centery, width, height } = frame;
    this.centerx = facing === 1 ? -centerx : centerx - width;
    this.centery = centery;
    const { pic } = frame;
    const { images } = this;
    main_mesh.scale.set(width, height, 0);
    if (!pic) return;
    const { material: m } = main_mesh;
    let { tex } = pic;
    if (variant) tex = this.file_variants.get(tex)?.at(variant) ?? tex;
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

  update_position(immediate = false): void {
    const { entity } = this;
    const { facing, state, frame, world } = entity;
    let { x, y, z } = entity.position;

    if (state === StateEnum.Message) {
      const { centerx, width } = frame;
      const cameraX = this.world_renderer.camera.position.x;
      const screenW = world.dataset.screen_w / (world.bg.zoom_x ?? 1);
      const offsetX = facing === 1 ? centerx : width - centerx;
      const left = cameraX + offsetX;
      const right = cameraX + screenW - (width - offsetX);
      x = clamp(x, left, right);
    }
    this.p0.copy(this.p1);
    this.p1.set(x, y - z / 2, z);
    immediate && (this.p0.copy(this.p1), this.node.position.copy(this.p1));
  }

  private update_outline(): void {
    const { ghosted, render_effect_time } = this.entity;
    if (ghosted) return;

    if (this.render_effect_time == render_effect_time) return;
    this.render_effect_time = render_effect_time;
    const { main_mesh } = this;
    const { material: m } = main_mesh;
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
    const { entity, main_mesh } = this;
    const { bpoint } = entity.frame;

    const visible = !!bpoint && main_mesh.visible && entity.hp < entity.hp_max * 0.33;
    this.blood_mesh.visible = visible;

    if (!visible) return;

    let { x: bx, y: by, z: bz = 0.1, r = 0 } = bpoint;
    bx = entity.facing === 1 ? bx : main_mesh.scale.x - bx;
    this.blood_mesh.position.set(this.centerx + bx, this.centery - by, bz);
  }
}