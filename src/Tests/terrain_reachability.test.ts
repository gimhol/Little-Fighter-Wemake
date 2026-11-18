import { TerrainEnum, terrain_info_new, type ITerrainInfo } from "../LFW/defines";
import { TerrainReachability } from "../LFW/terrain/TerrainReachability";
import { TerrainWorld } from "../LFW/terrain/TerrainWorld";

function seg(patch: Partial<ITerrainInfo>): ITerrainInfo {
  return { ...terrain_info_new(), ...patch };
}

/** 一块平地（默认 z: -20 ~ 20） */
function ground(
  x1: number,
  x2: number,
  h: number = 0,
  z1: number = -20,
  z2: number = 20,
): ITerrainInfo {
  return seg({ x1, x2, z1, z2, h1: h, h2: h });
}

function reach(...list: ITerrainInfo[]): TerrainReachability {
  return new TerrainWorld(list).reach;
}

describe("TerrainReachability", () => {
  describe("方向移动可达", () => {
    it("左右相接的平地互为可达", () => {
      const [a, b] = [ground(0, 100), ground(100, 200)];
      const r = reach(a, b);
      expect(r.move_reachable(a, b, "right")).toBe(true);
      expect(r.move_reachable(b, a, "left")).toBe(true);
      expect(r.neighbors(a, "move")).toContain(b);
    });

    it("前后相接的平地互为可达", () => {
      const a = ground(0, 100);
      const near = seg({ x1: 0, x2: 100, z1: 20, z2: 60, h1: 0, h2: 0 });
      const far = seg({ x1: 0, x2: 100, z1: -60, z2: -20, h1: 0, h2: 0 });
      const r = reach(a, near, far);
      expect(r.move_reachable(a, near, "near")).toBe(true);
      expect(r.move_reachable(a, far, "far")).toBe(true);
      expect(r.move_reachable(a, near, "far")).toBe(false);
    });

    it("台阶（高度差不超过 step）算直接走过去", () => {
      const [a, b] = [ground(0, 100), ground(100, 200, 8)];
      const r = reach(a, b);
      expect(r.move_reachable(a, b)).toBe(true);
      expect(r.jump_reachable(a, b)).toBe(false);
    });

    it("z 范围不重叠的两段不建立关系", () => {
      const a = ground(0, 100, 0, -20, 20);
      const b = ground(100, 200, 0, 40, 80);
      expect(reach(a, b).reachable(a, b)).toBe(false);
    });
  });

  describe("连接点", () => {
    it("平地 → 上坡：记录坡脚处的接缝点", () => {
      const flat = ground(0, 100, 0);
      const slope = seg({
        type: TerrainEnum.SlopeH,
        x1: 100, x2: 200,
        z1: -20, z2: 20,
        h1: 0, h2: 80,
      });
      const r = reach(flat, slope);
      const edge = r.edges_of(flat).find((e) => e.to === slope)!;
      expect(edge.move).toBe(true);
      expect(edge.dy).toBe(0);
      expect(edge.from_point).toEqual({ x: 100, y: 0, z: 0 });
      expect(edge.to_point).toEqual({ x: 100, y: 0, z: 0 });
    });

    it("台阶：两侧连接点高度不同", () => {
      const flat = ground(0, 100, 0);
      const step = ground(100, 200, 40);
      const edge = reach(flat, step).edges_of(flat).find((e) => e.to === step)!;
      expect(edge.from_point).toEqual({ x: 100, y: 0, z: 0 });
      expect(edge.to_point).toEqual({ x: 100, y: 40, z: 0 });
      expect(edge.dy).toBe(40);
    });
  });

  describe("跳跃可达", () => {
    it("高出一截的台子可以跳上去，反向是坠落", () => {
      const [a, b] = [ground(0, 100), ground(100, 200, 40)];
      const r = reach(a, b);
      expect(r.move_reachable(a, b)).toBe(false);
      expect(r.jump_reachable(a, b)).toBe(true);
      expect(r.drop_reachable(b, a)).toBe(true);
      expect(r.drop_reachable(a, b)).toBe(false);
    });

    it("太高的台子跳不上去", () => {
      const [a, b] = [ground(0, 100), ground(100, 200, 400)];
      const r = reach(a, b);
      expect(r.move_reachable(a, b)).toBe(false);
      expect(r.jump_reachable(a, b)).toBe(false);
      expect(r.reachable(a, b)).toBe(false);
    });

    it("同高度隔一道小缺口可以跳过去", () => {
      const [a, b] = [ground(0, 100), ground(200, 300)];
      const r = reach(a, b);
      expect(r.move_reachable(a, b)).toBe(false);
      expect(r.jump_reachable(a, b, "right")).toBe(true);
    });

    it("缺口太大跳不过去", () => {
      const [a, b] = [ground(0, 100), ground(400, 500)];
      const r = reach(a, b);
      expect(r.jump_reachable(a, b)).toBe(false);
      expect(r.reachable(a, b)).toBe(false);
    });
  });

  describe("上下叠放", () => {
    it("平地上的台子：跳得上去，也可以跳下来", () => {
      const [g, p] = [ground(0, 300), ground(100, 200, 40)];
      const r = reach(g, p);
      expect(r.jump_reachable(g, p, "up")).toBe(true);
      expect(r.drop_reachable(p, g, "down")).toBe(true);
      expect(r.move_reachable(g, p)).toBe(false);
      expect(r.path(g, p)).not.toBeNull();
    });

    it("叠放且同样高度时视为同一层", () => {
      const [g, p] = [ground(0, 300), ground(100, 200, 0)];
      const r = reach(g, p);
      expect(r.move_reachable(g, p)).toBe(true);
      expect(r.move_reachable(p, g)).toBe(true);
    });
  });

  describe("路径", () => {
    it("多段台阶能走出路径", () => {
      const a = ground(0, 100, 0);
      const b = ground(100, 200, 40);
      const c = ground(300, 400, 40);
      const r = reach(a, b, c);
      const path = r.path(a, c);
      expect(path).not.toBeNull();
      expect(path!.length).toBe(2);
      expect(path![0].from).toBe(a);
      expect(path![0].to).toBe(b);
      expect(path![1].from).toBe(b);
      expect(path![1].to).toBe(c);
    });

    it("不可达时返回 null", () => {
      const a = ground(0, 100);
      const b = ground(1000, 1100);
      expect(reach(a, b).path(a, b)).toBeNull();
    });
  });

  describe("悬崖", () => {
    it("悬崖不参与可达关系", () => {
      const a = ground(0, 100);
      const cliff = seg({
        x1: 100, x2: 200, z1: -20, z2: 20,
        h1: -400, h2: -400,
        cliff: true,
      });
      const r = reach(a, cliff);
      expect(r.solids.length).toBe(1);
      expect(r.reachable(a, cliff)).toBe(false);
      expect(r.reachable(cliff, a)).toBe(false);
    });
  });

  describe("加载时烘培", () => {
    it("构造 TerrainWorld 时就生成关系表", () => {
      const [a, b] = [ground(0, 100), ground(100, 200, 40)];
      const world = new TerrainWorld([a, b]);
      expect(world.reach.edges.length).toBeGreaterThan(0);
      expect(world.reach.jump_reachable(a, b)).toBe(true);
    });

    it("没有地形时关系表为空", () => {
      expect(new TerrainWorld(undefined).reach.edges.length).toBe(0);
      expect(new TerrainWorld([]).reach.edges.length).toBe(0);
    });
  });

  describe("斜坡", () => {
    it("斜坡边缘高度按实际顶面计算", () => {
      const a = ground(0, 100, 0);
      const slope = seg({
        type: TerrainEnum.SlopeH,
        x1: 100, x2: 200,
        z1: -20, z2: 20,
        h1: 80, h2: 0,
      });
      const r = reach(a, slope);
      expect(r.move_reachable(a, slope, "right")).toBe(false);
      expect(r.jump_reachable(a, slope, "right")).toBe(true);
      expect(r.drop_reachable(slope, a, "left")).toBe(true);
    });
  });
});




