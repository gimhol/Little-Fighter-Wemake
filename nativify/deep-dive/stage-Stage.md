# 深度分析：stage/Stage.ts

> 关卡/章节状态机 + 阶段/对话驱动。自动评分 **5 / 5 极难** · 449 行

## 职责

- 关卡阶段推进（`IStagePhaseInfo` 数组）、章节/阶段结束判定
- 阶段表达式求值（`Expressions<Stage>`：`phase_end_tester` / `dialog_end_tester`）
- 对话系统（`IDialogState`）、物品生成（`Item[]`）
- 边界计算（left/right/near/far/width/depth）、玩家/相机/敌人边界

## 关键模式与 C++ 对策

| 模式 | 说明 | C++ 对策 |
| --- | --- | --- |
| `FSM` 状态机 | `fsm` 管理阶段状态 | 复用 `base/FSM` 的 C++ 移植 |
| `Expressions<T>` 表达式求值 | 从数据字符串解析条件表达式（如 `"hp < 0.3"`） | 见 `base/Expression.ts`（182 行）：需要**表达式解析器**，C++ 用递归下降解析 + 变量绑定 |
| `Set<Item>` | 物品集合 | `std::unordered_set<Item>`（Item 用对象池） |
| 回调 | `callbacks = new Callbacks<IStageCallbacks>()` | 观察者 |
| 可空 `_phase?` | 阶段可空 | `std::optional<const Phase&>` 或指针 |
| `_disposers: (()=>void)[]` | 资源释放回调列表（RAII 在 JS 里的手工版） | **C++ 直接 `std::vector<std::function<void()>>`，或更优：用 RAII 对象替代** |

## 移植要点

1. `Expressions` 是 Stage 的隐形复杂度来源——建议单独移植并写解析器测试。
2. 边界计算是纯几何，1:1 可移植。
3. 对话/物品逻辑无平台依赖（音频经 Ditto），逻辑完整。

## 预估

- 2–3 周（含 Expressions；与 World/Background 联动）
