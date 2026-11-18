import { TerrainEnum, terrain_info_new, type ITerrainInfo } from "../LFW/defines";
import { TerrainWorld } from "../LFW/terrain/TerrainWorld";
import { BotTerrain } from "../LFW/bot/terrain/BotTerrain";

function seg(patch: Partial<ITerrainInfo>): ITerrainInfo {
  return { ...terrain_info_new(), ...patch };
}

function bot(...list: ITerrainInfo[]): BotTerrain {
  return new BotTerrain(new TerrainWorld(list));
}

/** 一整块平地 */
const ground = (x1: number, x2: number, h: number = 0) =>
  seg({ x1, x2, z1: -20, z2: 20, h1: h, h2: h });

describe("BotTerrain", () => {
  describe("probe", () => {
    it("平地上没有阻挡", () => {
      const t = bot(ground(0, 1000));
      const p = t.probe(100, 0, 0);
      expect(p.cliff).toBe(false);
      expect(p.blocked).toBe(false);
      expect(p.dy).toBe(0);
      expect(p.top).toBe(0);
    });

    it("没有地形时按默认平台处理", () => {
      const t = bot();
      const p = t.probe(123, 4, 0);
      expect(p.cliff).toBe(false);
      expect(p.blocked).toBe(false);
      expect(p.dy).toBe(0);
    });

    it("更高的平台会挡住去路", () => {
      const t = bot(ground(0, 300), ground(100, 200, 40));
      const p = t.probe(150, 0, 0);
      expect(p.blocked).toBe(true);
      expect(p.dy).toBe(40);
    });

    it("同段斜坡上，近处的坡度不算墙", () => {
      const t = bot(seg({
        type: TerrainEnum.SlopeH,
        x1: 0, x2: 200,
        z1: -20, z2: 20,
        h1: 0, h2: 100,
      }));
      const near = t.probe(8, 0, 0);
      expect(near.blocked).toBe(false);
      expect(near.dy).toBeCloseTo(4, 6);
      // 远处的高度差会超过 step —— 这就是远探只查悬崖、不查 blocked 的原因
      expect(t.probe(28, 0, 0).blocked).toBe(true);
    });

    it("悬崖会被标记出来（enterable 并不认为它不可进入）", () => {
      const t = bot(
        ground(0, 300),
        seg({ x1: 300, x2: 400, z1: -20, z2: 20, h1: -400, h2: -400, cliff: true }),
        ground(400, 600, 200),
      );
      const p = t.probe(350, 0, 0);
      expect(p.cliff).toBe(true);
      expect(p.blocked).toBe(false);
      expect(p.dy).toBe(-400);
    });

    it("大落差只体现为 dy，由调用方决定敢不敢下", () => {
      const t = bot(ground(0, 300, 200), ground(300, 600, 40));
      const p = t.probe(340, 0, 200);
      expect(p.cliff).toBe(false);
      expect(p.dy).toBe(-160);
    });

    it("站在穿透平台下方时，脚下仍是地面", () => {
      const t = bot(
        ground(0, 300),
        seg({ x1: 100, x2: 200, z1: -20, z2: 20, h1: 60, h2: 60, through: true }),
      );
      const below = t.probe(150, 0, 0);
      expect(below.blocked).toBe(false);
      expect(below.top).toBe(0);
      const on = t.probe(150, 0, 60);
      expect(on.blocked).toBe(false);
      expect(on.top).toBe(60);
    });
  });

  describe("standable", () => {
    it("平地可站，悬崖和墙里不可站", () => {
      const t = bot(
        ground(0, 300),
        ground(100, 200, 40),
        seg({ x1: 300, x2: 400, z1: -20, z2: 20, h1: -400, h2: -400, cliff: true }),
      );
      expect(t.standable(50, 0, 0)).toBe(true);
      expect(t.standable(150, 0, 0)).toBe(false); // 站台侧面，等于在墙里
      expect(t.standable(150, 0, 40)).toBe(true); // 站台上
      expect(t.standable(350, 0, 0)).toBe(false); // 悬崖
    });
  });

  describe("climbable_top", () => {
    it("够得着的台子返回顶面高度", () => {
      const t = bot(ground(0, 300), ground(100, 200, 60));
      expect(t.climbable_top(150, 0, 0, 100)).toBe(60);
    });

    it("够不着时返回 null", () => {
      const t = bot(ground(0, 300), ground(100, 200, 60));
      expect(t.climbable_top(150, 0, 0, 40)).toBeNull();
    });

    it("一步就能走上去的不算跳台", () => {
      const t = bot(ground(0, 300), ground(100, 200, 8));
      expect(t.climbable_top(150, 0, 0, 100)).toBeNull();
    });
  });
});

describe("TerrainWorld.column", () => {
  it("按顶面从高到低返回该点的地形段", () => {
    const world = new TerrainWorld([
      ground(0, 300),
      seg({ x1: 100, x2: 200, z1: -20, z2: 20, h1: 60, h2: 60, through: true }),
      seg({ x1: 100, x2: 200, z1: -20, z2: 20, h1: 120, h2: 120, through: true }),
    ]);
    const col = world.column(150, 0);
    expect(col.length).toBe(3);
    expect(col[0].h1).toBe(120);
    expect(col[1].h1).toBe(60);
    expect(col[2].h1).toBe(0);
  });

  it("范围外的地形段不会出现", () => {
    const world = new TerrainWorld([ground(0, 100), ground(200, 300, 40)]);
    expect(world.column(150, 0).length).toBe(0);
  });
});

describe("BotTerrain.can_step", () => {
  const NEAR = 8;
  const FAR = 28;
  /** 与 BotController.MAX_STEP_DOWN 保持一致 */
  const DROP = 160;
  const step = (
    t: BotTerrain, x: number, z: number, y: number,
    dx: -1 | 0 | 1, dz: -1 | 0 | 1,
  ) => t.can_step(x, z, y, dx, dz, NEAR, FAR, DROP);

  it("平地两个方向都能走", () => {
    const t = bot(ground(0, 300));
    expect(step(t, 150, 0, 0, 1, 0)).toBe(true);
    expect(step(t, 150, 0, 0, 0, 1)).toBe(true);
  });

  it("没有方向时恒为 true", () => {
    const t = bot(ground(0, 300), ground(5, 200, 40));
    expect(step(t, 0, 0, 0, 0, 0)).toBe(true);
  });

  it("面前是更高的台子时不硬走", () => {
    const t = bot(ground(0, 300), ground(5, 200, 40));
    expect(step(t, 0, 0, 0, 1, 0)).toBe(false);
  });

  it("同一段陡斜坡不算墙", () => {
    const t = bot(seg({
      type: TerrainEnum.SlopeH,
      x1: 0, x2: 200,
      z1: -20, z2: 20,
      h1: 0, h2: 400,
    }));
    // 8px 处已高出 16（超过 step），但它是同一段斜坡，角色走上去没问题
    expect(step(t, 0, 0, 0, 1, 0)).toBe(true);
  });

  it("远处是悬崖时提前停下", () => {
    const t = bot(
      ground(0, 300),
      seg({ x1: 300, x2: 400, z1: -20, z2: 20, h1: -400, h2: -400, cliff: true }),
    );
    expect(step(t, 290, 0, 0, 1, 0)).toBe(false);
  });

  it("落差过大时不往下走", () => {
    const t = bot(ground(0, 300, 200), ground(300, 600, -50));
    expect(step(t, 290, 0, 200, 1, 0)).toBe(false);
  });

  it("能跳下去打的落差可以走下（城堡地牢那种）", () => {
    const t = bot(ground(0, 300, 200), ground(300, 600, 80));
    expect(step(t, 290, 0, 200, 1, 0)).toBe(true);
  });

  it("落差在允许范围内可以走下去", () => {
    const t = bot(ground(0, 300, 200), ground(300, 600, 140));
    expect(step(t, 290, 0, 200, 1, 0)).toBe(true);
  });

  it("背后有墙时不影响其他方向", () => {
    const t = bot(ground(0, 300), ground(5, 200, 40));
    expect(step(t, 0, 0, 0, -1, 0)).toBe(true);
    expect(step(t, 0, 0, 0, 0, 1)).toBe(true);
  });
});
