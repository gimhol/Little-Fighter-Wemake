# 深度分析：entity/Entity.ts

> 全 LFW 最核心、最复杂的文件。移植难度的基准锚点。
> 自动评分：**5 / 5 极难** · 2558 行 · 83480 bytes · 31 个 import

## 职责

`Entity` 是所有游戏对象（角色/武器/球/特效）的基类与运行时载体：

- 保存全部帧数据（`IFrameInfo`）、碰撞体集合（`bdy`/`itr`/`wpoint`/`bpoint`/`opoint`/`cpoint`）
- 维护生命值/魔法值/韧性/防御/眩晕等数值体系（通过 `Times` 计时器）
- 驱动帧状态机（`States` / `State_Base`），按帧执行 `enter_frame` / `next_frame`
- 管理出生/死亡/回收、影分身（`copies`）、合体（`fuse_bys`）、变身
- 处理队友/敌人关系、队伍归属、改名、丢弃武器等

## 关键依赖

- `LFW` / `World` / `Factory` / `Ditto`（全局单例与宿主注入）
- `defines` 全家桶：`IFrameInfo`(449行) `IEntityData` `IItrInfo` `IOpointInfo` 等大型接口
- `state/` 目录 30+ 个状态类；`collision/` 全套碰撞处理器
- `Callbacks<IEntityCallbacks>` 事件系统、`Times` 计时器、`Graves` 缓存池

## 阻碍 C++ 移植的 JS 特性（按严重度）

| 特性 | 位置示例 | C++ 对策 |
| --- | --- | --- |
| string 键 `Map`/`Set`（几十处） | `vrests`, `blockers`, `superpunchs`, `copies` | `std::unordered_map<std::string,...>`；热路径考虑 `std::string_view`/对象池 |
| 回调注册与广播 | `callbacks = new Callbacks<IEntityCallbacks>()` | 观察者接口 + `std::function` 列表 |
| 可空字段泛滥（`X \| null`） | `_landing_frame!`、`fuse_bys`、`dismiss_data` | `std::optional` 或裸指针 + 生命周期文档 |
| `any` 动态类型 | 属性 `_state: any` 等 | 逐一收敛为具体类型或 `std::variant` |
| getter/setter 计算属性 | `get hp()`、`set team()` | 访问器方法（无法复用 JS 的属性语义） |
| 帧对象共享/只读引用 | `Readonly<IFrameInfo>` 传引用 | `const T&` / `std::shared_ptr`（注意别名问题） |
| 运行时类型收窄 | `is_fighter`, `is_ball_ctrl`, `is_human_ctrl` | 用类型字段 + `switch`/虚函数替代 `instanceof` |

## 移植策略建议

1. **先固化数据模型**：把 `defines` 里的 `IFrameInfo`/`IEntityData` 等先转成 C++ POD/struct，再做逻辑。
2. **Entity 拆层**：不要 1:1 一个 2500 行大类的映射。建议拆为
   `EntityCore`（id/位置/速度/朝向/队伍）、`EntityStats`（hp/mp/韧性/防御）、
   `FrameDriver`（帧推进/状态机）、`CollisionOwner`（碰撞体集合）。
3. **对象池**：JS 靠 GC 无痛创建/销毁；C++ 需要显式 `EntityPool`，与 `Graves` 语义对齐。
4. **回调系统**：先实现 `Callbacks<T>` 的 C++ 等价物（`std::vector<std::function<void(...)>>` + 订阅/退订），否则大量代码无法落地。
5. **确定性**：帧循环是确定性的，移植时要保持浮点运算顺序一致（`round_float` 等已显式处理）。

## 风险点

- 文件过大、内部状态耦合深（30+ 字段互相影响），拆分时易破坏行为一致性
- `Times` 的“加满回绕”语义（`add` 返回值与 `remains` 递减）容易被简单实现带偏
- 帧数据大量使用字符串 id 关联，C++ 侧建议保留字符串或改为 int 索引并做映射表

## 预估

- 只做数据结构映射：2–3 天
- 完整逻辑移植 + 行为对齐测试：4–6 周（含 `state/` 30 个状态类联动）
- 建议作为**第二批**移植（在 `defines` 与 `utils` 完成后）
