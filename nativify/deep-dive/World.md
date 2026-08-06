# 深度分析：World.ts

> 游戏世界容器 + 主更新/渲染调度。自动评分 **5 / 5 极难** · 1043 行

## 职责

- 持有全部实体（`entity_map`）、碰撞（`collisions`）、Buff、背景、关卡、相机
- 主循环：每帧 `update`（物理/碰撞/状态推进）与 `render` 的调度
- 相机控制（目标/当前/锁定/距离模式）、地面（`Ground`）、血量/胜负判定
- 数据集合 `dataset: WorldDataset`

## 关键 JS 模式

| 模式 | 说明 | C++ 对策 |
| --- | --- | --- |
| `Ditto.Render.add` / `Ditto.Interval.add` | 由宿主注入的渲染/定时服务，返回 worker id 用于移除 | 平台抽象接口（见 ditto 深度分析）；C++ 侧由引擎主循环驱动 |
| `Callbacks<IWorldCallbacks>` | 世界事件（开始/结束/生成等） | 观察者接口 |
| `Map<string, Entity>` 大容器 | 实体按 id 索引 | `std::unordered_map<std::string, Entity*>`；实体内存需池化避免失效 |
| `Set<Entity>` / `Set<BallController>` | `_gones` 待移除、`_chasers` | `std::unordered_set` |
| 排序函数 | `x_sorter`/`z_sorter`（按 AABB 排序做碰撞优化） | `std::sort` + 比较器 lambda |
| `pair_key(a,b)` 字符串拼接 | 碰撞对去重键 `a.id\|b.id` | 改为 `uint64` 对键或直接索引比较，避免字符串开销 |

## 移植要点

1. **主循环所有权**：JS 中 `World` 通过 `Ditto.Interval.add(update)` 自注册；C++ 侧建议由引擎/GameLoop 显式调用 `world.update(dt)` / `world.render()`，把调度权外移。
2. **实体生命周期**：`_gones` 延迟删除集合 → 用 `std::vector<Entity*> pending_kill` 或标记-清扫，注意迭代中删除的经典问题。
3. **相机逻辑**（`target/current/dist/lock` 四种位置模式 + 缩放）逻辑独立，可先抽成 `CameraController` 结构体。
4. **FPS/UPS**：`FPS(0.9)` 是 EMA 平滑统计，C++ 用 `std::chrono` 轻松复刻。

## 预估

- 3–4 周（在 Entity 移植之后；与 Entity 强耦合，先 Entity 后 World 顺序不可逆）
