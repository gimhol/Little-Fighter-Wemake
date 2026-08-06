# 深度分析：bot/BotController.ts

> 电脑对手 AI（FSM 驱动）。自动评分 **5 / 5 极难** · 768 行 · 6 个状态子类

## 职责

- 继承 `BaseController`，用 `FSM<BSE>` 组织 AI 状态：Idle / Chasing / Avoiding / Following / StageEnd / Dead
- 目标选择：`NearestTargets`（追击/躲避/防御三组最近目标池）
- 决策输出：按键模拟（`key_down`/`key_up`），行为参数由 `IBotData`/`BotDataSet` 驱动
- 走位（stand_atk_f_x / stand_atk_b_x 等距离计算）、`is_ray_hit` 视线检测

## 关键模式与 C++ 对策

| 模式 | 说明 | C++ 对策 |
| --- | --- | --- |
| `FSM<T>` 泛型状态机 | `new FSM<BSE>().add(...).use(BSE.Idle)` | 模板化 FSM 或状态接口 + `std::unique_ptr` 状态对象；模板可直接照搬 |
| 状态类持有控制器引用 | `new BotState_Idle(this)` | 构造函数注入 `BotController&`，注意非拷贝 |
| getter 密集计算 | `stand_atk_b_x`、`en`、`av` 等 | 普通成员函数 |
| 数据驱动行为 | `IBotData`（动作表 `actions{}` 字符串键） | `std::unordered_map<std::string, BotAction>` |
| 目标池排序 | `NearestTargets` 按距离维护 | `std::priority_queue` 或排序数组 |
| 时间窗口 | 攻击/躲避冷却用 `Times` | 复用 `Times` 的 C++ 移植 |

## 移植要点

1. `FSM`（`base/FSM.ts` 99 行）是通用设施，先移植，AI 才能落地。
2. AI 决策**无平台依赖**（只依赖实体数据与时间），是移植收益高、风险低的“逻辑类”模块——适合**第三批**（Entity 就绪后）。
3. 行为参数来自数据文件（`dat_translator/bots/*` 生成的 JSON），C++ 侧加载相同数据即可，行为一致。
4. 注意 `key_up(...Object.values(GK))` 这类“按枚举值展开”的调用——C++ 中 `for (auto k : allGameKeys()) ctrl->keyUp(k)`。

## 预估

- 3 周（含 FSM 与 6 个状态类；NearestTargets 目标池 1 天）
