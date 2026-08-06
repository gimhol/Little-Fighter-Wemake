# 深度分析：ui/component/UIComponent.ts

> UI 行为组件基类 + 注册表（`ui/component/` 60+ 组件的根）。自动评分 **5 / 5 极难** · 254 行

## 职责

- `UIComponent` 是附着在 `UINode` 上的“行为组件”：每帧更新、事件钩子
- 组件注册/工厂（按类名查表创建，`component/_.ts` + `index.ts`）
- 与 `UIComponentExpressionBuilder`（从数据字符串构建组件表达式）协作
- 派生 60+ 组件：布局（Alignment/Flex/WrapContent/VerticalLayout/HorizontalLayout）、
  交互（LabelButton/ScaleClickable/TextInput/IntegerPicker）、
  动画（Opacity*/Scale*/PositionAnimation/SmoothNumber）、
  游戏逻辑（SettingsLogic/StageModeLogic/DemoModeLogic 等）

## 关键 JS 模式与 C++ 对策

| 模式 | 说明 | C++ 对策 |
| --- | --- | --- |
| 字符串类名 → 组件实例 | 从 `ICookedUIInfo` 的字符串 `type` 反射出组件类 | `std::unordered_map<std::string, std::function<UIComponent*(UINode&)>>` 注册表（与 Factory 模式一致） |
| 泛型组件工厂 | `UIComponentExpressionBuilder` | 模板工厂 |
| `any` 配置数据 | 组件配置字典 | 类型化配置 struct（每组件一个） |
| 事件回调链 | 节点事件 → 组件 | 事件分发表 |

## 移植要点

1. 组件模式本身干净（接口 + 注册表 + 每帧 tick），C++ 很契合。
2. 真正的工作量在 60+ 个具体组件的**数量**，而非模式。每个组件 15–170 行。
3. 布局类组件（Flex/Alignment 等）是确定性算法，可批量移植+快照测试。
4. **前提决策**：若 UI 层整体保留 JS（见 `ui/UINode` 深度分析方案 A），本文件无需移植。

## 预估

- 组件框架（基类+注册表+Builder）：3–5 天
- 60+ 组件逐个移植：3–5 周（取决于 UI 层最终方案）
