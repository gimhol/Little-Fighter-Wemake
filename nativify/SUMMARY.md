# LFW TS → C++ 移植难度分析 — 汇总

> 生成时间: 2026-08-06T03:12:04.086Z · 由 `nativify/analyze.mjs` 生成

## 总体统计

| 指标 | 值 |
| --- | --- |
| 文件数 | 821 |
| 总行数 | 47367 |
| 总大小 | 1455.9 KB |
| 平均行数 | 57.7 |
| 平均难度 | 1.58 / 5 |

## 按分类分布

| 分类 | 文件数 |
| --- | --- |
| 纯函数工具 | 355 |
| 类+函数+数据混合 | 191 |
| 纯类型声明 (interface/type) | 168 |
| 常量/静态数据 | 54 |
| 类实现 | 48 |
| 枚举定义 | 5 |

## 按难度分布

| 难度 | 文件数 |
| --- | --- |
| 5 (极难) | 4 |
| 4.5 (很困难) | 4 |
| 4 (困难) | 9 |
| 3.5 (中等偏难) | 13 |
| 3 (中等) | 38 |
| 2.5 (较易) | 61 |
| 2 (容易) | 127 |
| 1.5 (极易) | 184 |
| 1 (微不足道) | 381 |

## 按目录分布

| 目录 | 文件数 |
| --- | --- |
| dat_translator | 188 |
| ui | 188 |
| defines | 124 |
| utils | 64 |
| ditto | 48 |
| state | 35 |
| collision | 31 |
| loader | 29 |
| (根) | 17 |
| bot | 16 |
| controller | 15 |
| entity | 15 |
| base | 14 |
| animation | 11 |
| helper | 9 |
| buff | 6 |
| stage | 6 |
| bg | 3 |
| types | 2 |

## 最困难的文件 (难度 ≥ 4)

| 难度 | 文件 | 行数 | 分类 |
| --- | --- | --- | --- |
| 5 | `entity/Entity.ts` | 2558 | 类+函数+数据混合 |
| 5 | `World.ts` | 1043 | 类+函数+数据混合 |
| 5 | `ui/UINode.ts` | 874 | 类+函数+数据混合 |
| 5 | `LFW.ts` | 816 | 类+函数+数据混合 |
| 4.5 | `stage/Stage.ts` | 477 | 类+函数+数据混合 |
| 4.5 | `controller/BaseController.ts` | 444 | 类+函数+数据混合 |
| 4.5 | `loader/DatMgr.ts` | 385 | 类+函数+数据混合 |
| 4.5 | `ui/component/UIComponent.ts` | 276 | 类+函数+数据混合 |
| 4 | `bot/BotController.ts` | 768 | 类+函数+数据混合 |
| 4 | `dat_translator/make_fighter_data.ts` | 594 | 纯函数工具 |
| 4 | `ui/component/DemoModeLogic.ts` | 453 | 类+函数+数据混合 |
| 4 | `collision/CollisionKeeper.ts` | 335 | 类+函数+数据混合 |
| 4 | `ui/component/CharMenu/CharMenuLogic.ts` | 298 | 类+函数+数据混合 |
| 4 | `base/Expression.ts` | 182 | 类+函数+数据混合 |
| 4 | `utils/schema/validate_schema.ts` | 181 | 类+函数+数据混合 |
| 4 | `PlayerInfo.ts` | 137 | 类+函数+数据混合 |
| 4 | `dat_translator/bots/BotMaker.ts` | 96 | 类+函数+数据混合 |

## 深度分析文件（人工复核）

| 源文件 | 深度分析 |
| --- | --- |
| `entity/Entity.ts` | [entity-Entity.md](./deep-dive/entity-Entity.md) |
| `World.ts` | [World.md](./deep-dive/World.md) |
| `LFW.ts` | [LFW.md](./deep-dive/LFW.md) |
| `ditto/Instance.ts` | [ditto-Instance.md](./deep-dive/ditto-Instance.md) |
| `ui/UINode.ts` | [ui-UINode.md](./deep-dive/ui-UINode.md) |
| `ui/component/UIComponent.ts` | [ui-component-UIComponent.md](./deep-dive/ui-component-UIComponent.md) |
| `bot/BotController.ts` | [bot-BotController.md](./deep-dive/bot-BotController.md) |
| `controller/BaseController.ts` | [controller-BaseController.md](./deep-dive/controller-BaseController.md) |
| `collision/CollisionKeeper.ts` | [collision-CollisionKeeper.md](./deep-dive/collision-CollisionKeeper.md) |
| `stage/Stage.ts` | [stage-Stage.md](./deep-dive/stage-Stage.md) |
| `loader/DatMgr.ts` | [loader-DatMgr.md](./deep-dive/loader-DatMgr.md) |
| `utils/schema/validate_schema.ts` | [utils-schema-validate_schema.md](./deep-dive/utils-schema-validate_schema.md) |
| `dat_translator/make_fighter_data.ts` | [dat_translator-make_fighter_data.md](./deep-dive/dat_translator-make_fighter_data.md) |
| `ui/component/DemoModeLogic.ts` | [ui-component-DemoModeLogic.md](./deep-dive/ui-component-DemoModeLogic.md) |

## 总体建议

1. **优先移植纯逻辑层**（`utils`、`defines`、`math`、`string_parser`），它们多为纯函数与类型声明，难度低、收益高。
2. **核心模拟层**（`entity`、`world`、`collision`、`state`）是移植主战场，需先设计数据模型与对象生命周期，建议先做 `defines` 数据结构的 C++ 化，再移植 `Entity` / `World`。
3. **Ditto 接口层**是 JS 宿主（渲染、音频、输入、网络）与逻辑层的桥，C++ 侧需要定义抽象接口并让平台实现，先定接口再实现。
4. **UI 层**（`ui`）依赖大量 DOM/浏览器能力与回调式组件树，C++ 移植成本最高，建议优先考虑保留 JS 或做 FFI 桥接，而非整体重写。
5. **dat_translator** 是离线构建工具链（LF2 数据 → JSON），可在 C++ 侧复用同一套解析逻辑，但优先级低于运行时逻辑。
