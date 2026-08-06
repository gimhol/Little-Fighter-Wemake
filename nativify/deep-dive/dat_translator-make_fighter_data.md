# 深度分析：dat_translator/make_fighter_data.ts

> 离线数据构建：把角色基础数据“烹饪”成完整 `IEntityData`。自动评分 **5 / 5 极难** · 576 行

## 职责

- 从简化配置生成完整角色数据（帧、技能、攻击框、AI、音效、变身等）
- 与 `dat_translator/bots/*`（24 个角色 AI 生成器）、`make_ball_special`、`make_weapon_special`、`make_fighter_special` 联动
- 输出供运行时 `loader/` 消费的数据（最终序列化进 data.zip.json）

## 关键特征

| 特征 | 说明 | C++ 对策 |
| --- | --- | --- |
| 大规模数据表 | 大量 `export const XXX = {...}` 配置 | **无需运行时移植**——这是**构建期工具链**，可用脚本/原工具生成数据，C++ 运行时只消费结果 JSON |
| 泛型 + `any` | `make_fighter_data` 内泛型辅助与 `any` 收窄 | 若坚持 C++ 实现工具链：大量泛型元编程，成本高 |
| 与 XML 转换器耦合 | `xml_to_*` / `xml_from_*` | 见 dat_translator 综述 |

## 移植建议（重要）

`dat_translator/`（188 个文件）本质是**离线构建管线**：LF2 原始数据 → JSON。它不在游戏运行时执行。

- **推荐**：不移植到 C++ 运行时。保留在 Node/脚本层，或复用原 JS 工具链在 CI/发布时生成 `data.zip.json`，C++ 只加载 JSON。**收益/成本比最高**。
- 若必须在 C++ 内生成：XML 解析（pugixml）+ 数据烘焙逻辑，约 4–6 周，且维护成本高，不推荐。
- 运行时只依赖 `preprocess_*`（`loader/`）的部分最终结果，那些属于 `DatMgr` 职责。

## 预估

- 推荐路线：0 天（构建期保留 JS）
- 全 C++ 化：4–6 周（不推荐）
