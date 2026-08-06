# 深度分析：collision/CollisionKeeper.ts

> 碰撞处理器的**查表分派器**。自动评分 **5 / 5 极难** · 311 行 · 25 个 handler

## 职责

- 把 (攻击方类型 × itr种类 × 受击方类型 × bdy种类 × 双方帧状态) 的笛卡尔积组合，映射到具体处理函数
- `product_keys`：生成组合键字符串（如 `"Fighter_Normal_Weapon_Bdy_0_5"`）
- `pair_map: Map<string, ICollisionFunc[]>`：组合键 → 处理器数组
- 运行时查表：`get(...)` 命中后执行一个或多个 handler

## 为什么难移植

| JS 模式 | 说明 | C++ 对策 |
| --- | --- | --- |
| **字符串组合键查表** | 6 维笛卡尔积用 `"_"` 拼接成字符串当键，运行时拼接+查找 | 核心性能点：`std::unordered_map<std::string,...>` 每碰撞都要拼字符串+哈希，很慢。**应改为整型编码键**（每个维度 ≤ 16/32 值 → 打包成 `uint64`），或 6 层嵌套 `switch` 展开 |
| 笛卡尔积生成 | `product_keys(...)` 用计数器进位模拟 | 可保留原算法生成编译期表，或手写 `switch` 表 |
| 高阶函数数组 | `ICollisionFunc[]` 处理器列表 | `std::vector<std::function<void(Collision&)>>` 或函数指针表 |
| `ALL_STATES` 默认参数 | 状态维度缺省 = 全状态 | 枚举位掩码（`std::bitset`/`uint64` 位）更优雅 |

## 移植要点

1. **这是性能敏感路径**：字符串键在 JS 里够用，C++ 里必须重新设计键编码。建议：
   `key = (aType<<48) | (itrKind<<40) | (vType<<32) | (bdyKind<<24) | (aState<<8) | vState`，一次 `uint64` 查表。
2. handler 函数本身（`collision/handle_*.ts` 25 个文件）逻辑独立、无平台依赖，是**高收益移植单元**——先移植 handler，再接查表器。
3. `Collision.ts`（290 行）是碰撞对象数据结构，先转成 struct。

## 预估

- 数据结构 + 查表器：3–5 天
- 25 个 handler：1–2 周（每个都是小纯函数，但细节多，需与 `entity/` 联动测试）
