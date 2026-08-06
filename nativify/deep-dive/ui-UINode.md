# 深度分析：ui/UINode.ts

> UI 节点树的核心（816 行，`ui/` 层最重的文件）。自动评分 **5 / 5 极难** · 12 处 any

## 职责

- UI 节点：位置/缩放/尺寸/中心/透明度/颜色/样式（`Style`）
- 父子节点树、布局缓存（cross/rect/geo/global_pos 四级缓存）
- 指针/点击事件（`LF2PointerEvent`）、按键事件、焦点管理
- 文本（`TextInfo`）与图片（`ImageInfo`）渲染数据
- 组件（`UIComponent[]`）附着与更新
- 通过 `D.UINodeRenderer` 委托实际绘制

## 阻碍 C++ 移植的 JS 特性

| 特性 | 说明 | C++ 对策 |
| --- | --- | --- |
| 惰性缓存 getter | `get cross()` 首次计算后写 `_cache_cross`，依赖“属性可写回” | 显式 `ensureCross()` 方法 + `std::optional` 缓存；注意 JS 中 `_cache_cross` 被 getter 读写的模式需转成方法调用 |
| 回调注册 | `_callbacks = new Callbacks<IUICallback>()` | 事件订阅接口 |
| `any` 状态 | `_state: any = {}` 组件状态字典 | `std::variant` 或类型化子类状态 |
| 动态 Vector3 构造 | `new D.Vector3()` 几十处 | 值类型 `Vec3` 字段（直接成员，免堆分配） |
| 可空字段 | `_parent?: UINode`、`_focused_node?` | 裸指针 + 树生命周期约束（父存活则子存活） |
| 0/1 数值枚举 | `_pointer_over: 0 \| 1` | `enum class : uint8_t` |

## 移植策略

1. **决定 UI 层命运**：这是移植成本最高的一块（依赖 DOM 式树 + 回调 + 宿主渲染器）。三个选项：
   - **A. 保留 JS**：C++ 只移植逻辑，UI 继续跑在 JS（FFI 桥）。最快、风险最低。
   - **B. 全量 C++**：需实现布局引擎（Alignment/Flex/WrapContent 等 60+ 组件）+ 渲染器绑定，工作量巨大。
   - **C. 混合**：C++ 复刻 `UINode` 数据/布局计算，绘制仍回调宿主。
2. `UINode` 的几何计算（cross/rect/geo）是纯数学，可 1:1 移植，且是**确定性**的——适合先做。
3. 组件系统（`UIComponent`）采用“行为组件”模式，C++ 侧用接口 + 虚函数即可，模式本身很干净。

## 预估

- 仅几何/布局核心（无绘制）：1–2 周
- 完整 UI 系统 C++ 化：6–10 周（推荐先选方案 A）
