import { FID, is_fighter, OID, SE, type Entity, type LFW, type World } from "@/LFW";
import { Vector3 } from "../_t";
import { EntityCtrlRender } from "./EntityCtrlRender";
import { EntityMainRender } from "./EntityMainRender";
import { EntityNameRender } from "./EntityNameRender";
import { EntityShadowRender } from "./EntityShadowRender";
import { EntityStatRender } from "./EntityStatRender";
import { FrameIndicators } from "./FrameIndicators";
import { ENTITY_INDICATINGS } from "./INDICATINGS";
import type { WorldRenderer } from "./WorldRenderer";

export class EntityRenderer {
  lfw: LFW;
  world: World;
  entity: Entity;
  main: EntityMainRender;
  name: EntityNameRender;
  shad: EntityShadowRender;
  stat: EntityStatRender | null = null;
  indi: FrameIndicators | null = null;
  ctrl: EntityCtrlRender | null = null;
  readonly owner: WorldRenderer;
  protected _indicators: number = 0;
  readonly p0 = new Vector3()
  readonly p1 = new Vector3()
  readonly position = new Vector3();
  /** 当前是否已挂载进场景（离屏裁剪用） */
  mounted: boolean = false;
  get invisible() {
    const { invisible, frame } = this.entity;
    if (frame.id == FID.Gone) return true
    if (frame.state == SE.Gone) return true
    return invisible;
  }
  constructor(e: Entity) {
    this.owner = e.world.renderer as WorldRenderer;
    this.lfw = e.lfw;
    this.world = e.world;
    this._indicators = this.owner.indicators
    this.entity = e;
    this.main = new EntityMainRender(this);
    this.shad = new EntityShadowRender(this);
    this.name = new EntityNameRender(this);
  }
  ensure_ctrl() {
    if (!this.ctrl && this._indicators & ENTITY_INDICATINGS.ctrl) {
      this.ctrl = new EntityCtrlRender(this)
      this.ctrl.on_mount();
    } else if (this.ctrl) {
      this.ctrl.on_unmount();
      this.ctrl = null;
    }
  }
  ensure_stat() {
    // Criminal...?
    if (
      is_fighter(this.entity) ||
      this.entity.data.id === OID.Criminal
    ) {
      if (!this.stat) {
        this.stat = new EntityStatRender(this);
        this.stat.on_mount()
      }
    } else if (this.stat) {
      this.stat.on_unmount();
      this.stat = null
    }
  }
  ensure_indi() {
    if (this._indicators ^ ENTITY_INDICATINGS.ctrl) {
      if (!this.indi) this.indi = new FrameIndicators(this.entity);
      this.indi.flags = this._indicators
    } else if (this.indi) {
      this.indi.on_unmount();
      this.indi = null
    }
  }
  render(dt: number) {
    if (this._indicators !== this.owner.indicators) {
      this._indicators = this.owner.indicators
      this.ensure_indi()
      this.ensure_ctrl()
    }
    if (this.owner.dirty) {
      this.p0.copy(this.p1)
      this.p1.copy(this.entity.position)
    }
    this.position.lerpVectors(this.p0, this.p1, this.owner.dfactor)

    this.main.render();
    this.shad.render();
    this.name.render();
    this.stat?.render();
    this.indi?.render();
    this.ctrl?.render()
    this.entity.holding?.renderer.render(dt)
    this.entity.catching?.renderer.render(dt)
  }
  mount() {
    this.main.on_mount();
    this.name.on_mount();
    this.shad.on_mount();
    this.ensure_stat()
    this.ensure_indi()
    this.ensure_ctrl()
    this.p1.copy(this.entity.position)
    this.p0.copy(this.entity.position)
  }
  unmount() {
    this.main.on_unmount();
    this.name.on_unmount();
    this.shad.on_unmount();
    this.stat?.on_unmount();
    this.indi?.on_unmount();
    this.ctrl?.on_unmount();
    this.stat = null
    this.indi = null
    this.ctrl = null
  }
}
