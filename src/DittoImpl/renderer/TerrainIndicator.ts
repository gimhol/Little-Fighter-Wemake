import type { Background } from "@/LFW/bg/Background";
import { TerrainEnum, type ITerrainInfo } from "@/LFW/defines/ITerrainInfo";
import * as T from "../_t";
import type { WorldRenderer } from "./WorldRenderer";

const TERRAIN_COLORS: Record<number, number> = {
  [TerrainEnum.Flat]: 0x00ff88,
  [TerrainEnum.SlopeH]: 0xff8800,
  [TerrainEnum.SlopeV]: 0x4488ff,
};

export class TerrainIndicator {
  readonly world_renderer: WorldRenderer;
  protected bg: Background | null = null;
  protected groups: T.Object3D[] = [];
  visible: boolean = true;

  constructor(world_renderer: WorldRenderer) {
    this.world_renderer = world_renderer;
  }

  get world_node() {
    return this.world_renderer.world_node;
  }

  set_visible(v: boolean): void {
    if (this.visible === v) return;
    this.visible = v;
    if (v) this.rebuild();
    else this.clear();
  }

  clear(): void {
    for (const g of this.groups) g.removeFromParent();
    this.groups.length = 0;
  }

  rebuild(): void {
    this.clear();
    if (!this.visible) return;

    const { world } = this.world_renderer;
    const { terrain } = world.bg.data;
    if (!terrain?.length) return;

    for (const seg of terrain) {
      const color = TERRAIN_COLORS[seg.type] ?? 0xffffff;

      const h11 = this._y(seg, seg.x1, seg.z1);
      const h21 = this._y(seg, seg.x2, seg.z1);
      const h22 = this._y(seg, seg.x2, seg.z2);
      const h12 = this._y(seg, seg.x1, seg.z2);

      // 游戏坐标 → Three.js: (gx, gy - gz/2, gz)
      const v = [
        seg.x1, h11 - seg.z1 / 2, seg.z1,
        seg.x2, h21 - seg.z1 / 2, seg.z1,
        seg.x2, h22 - seg.z2 / 2, seg.z2,
        seg.x1, h12 - seg.z2 / 2, seg.z2,
      ];

      // 填充面：两个三角形组成四边形
      const fill_geo = new T.BufferGeometry();
      fill_geo.setAttribute("position", new T.BufferAttribute(
        new Float32Array([
          v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8],
          v[0], v[1], v[2], v[6], v[7], v[8], v[9], v[10], v[11],
        ]), 3,
      ));
      fill_geo.computeBoundingSphere();
      const fill_mat = new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        depthTest: false,
        side: T.DoubleSide,
      });
      const fill_mesh = new T.Mesh(fill_geo, fill_mat);
      fill_mesh.frustumCulled = false;
      fill_mesh.renderOrder = 1;

      // 轮廓线
      const line_geo = new T.LineGeometry();
      line_geo.setPositions([
        v[0], v[1], v[2], v[3], v[4], v[5],
        v[3], v[4], v[5], v[6], v[7], v[8],
        v[6], v[7], v[8], v[9], v[10], v[11],
        v[9], v[10], v[11], v[0], v[1], v[2],
      ]);
      const line = new T.Line2(line_geo, new T.LineMaterial({ color, linewidth: 4 }));

      // 高度线：从四角垂直到 y=0
      const hline_geo = new T.LineGeometry();
      hline_geo.setPositions([
        v[0], v[1], v[2], seg.x1, -seg.z1 / 2, seg.z1,
        v[3], v[4], v[5], seg.x2, -seg.z1 / 2, seg.z1,
        v[6], v[7], v[8], seg.x2, -seg.z2 / 2, seg.z2,
        v[9], v[10], v[11], seg.x1, -seg.z2 / 2, seg.z2,
      ]);
      const hline = new T.Line2(hline_geo, new T.LineMaterial({ color: 0xffffff, linewidth: 1 }));

      const group = new T.Object3D();
      group.name = `TerrainIndicator:${seg.id ?? seg.name ?? 'unnamed'}`;
      group.add(fill_mesh);
      group.add(line);
      group.add(hline);
      this.world_node.add(group);
      this.groups.push(group);
    }
  }

  private _y(seg: Readonly<ITerrainInfo>, x: number, z: number): number {
    return this.world_renderer.world.ground.y(seg, x, z);
  }

  render(): void {
    const { bg } = this.world_renderer.world;
    if (bg !== this.bg) {
      this.bg = bg;
      this.rebuild();
    }
  }

  release(): void {
    this.clear();
    this.bg = null;
  }
}
