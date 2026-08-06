# 深度分析：ui/component/DemoModeLogic.ts

> 演示模式（Demo）逻辑：自动播放的假比赛。自动评分 **5 / 5 极难** · 431 行

## 职责

- 构造并驱动一场“AI 对 AI”的演示比赛：随机选角、生成控制器、推进比赛、计分
- 内部包含完整的比赛编排（`ComponentsPlayer` 协作）、随机数使用（`MersenneTwister`）、
  每帧决策逻辑

## 特征与对策

| 特征 | 说明 | C++ 对策 |
| --- | --- | --- |
| 大函数 + 状态字段 | 431 行集中在类内 | 拆为 `DemoDirector` / `DemoPlayer` / `DemoScoring` |
| 随机性 | `MersenneTwister` 决定选角/行为 | 确定性 RNG 直接复用（`utils/math/MersenneTwister.ts` 132 行，经典 MT19937，C++ 有标准等价或直接照搬） |
| 依赖组件播放器 | `ComponentsPlayer` | 与 UI 层方案绑定 |
| 回调/定时 | 演示流程用 `Times` 与回调 | 复用 Times 移植 + 显式 tick |

## 移植要点

1. **DemoModeLogic 是“逻辑×UI”混合体**：比赛编排部分（选角、胜负、计分）是纯逻辑可移植；播放控制部分依赖 UI 组件。
2. 建议：若 UI 保留 JS，本文件整体留 JS；若 UI 全 C++，则拆出 `DemoMatchDirector` 纯逻辑部分移植。
3. 随机序列必须与 JS 版一致（同种子同输出），否则演示回放行为漂移。

## 预估

- 纯逻辑部分：1 周；全量：2–3 周
