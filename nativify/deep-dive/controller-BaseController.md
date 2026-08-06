# 深度分析：controller/BaseController.ts

> 输入控制器基类（人类/机器人/球共用的按键状态机）。自动评分 **5 / 5 极难** · 408 行

## 职责

- 按键状态机：`ControllerKeyStatus`（UP/DOWN/HOLD）与双击检测 `ControllerDoubleClicks`
- 序列按键识别：`SeqKeys`（如 `djdj`→抓人、`dddd`→冲刺）
- 方向合成：`LR`/`RL`/`UD`/`DU`/`jd`/`dj` 六个 getter（左/右/上/下方向输出 ±1/0）
- 按键事件队列 `queue: (readonly [Status, LGK])[]`
- 追捕目标位置 `chase_pos`、`key_list` 可读按键串

## 关键 JS 模式与 C++ 对策

| 模式 | 说明 | C++ 对策 |
| --- | --- | --- |
| `.bind(this)` | `ku = this.key_up.bind(this)` 把方法当值传递 | `std::bind` / lambda 捕获 `this` / 成员函数指针；或改接口回调 |
| `Map<string, SeqKeys>` | 序列键表（`seqKeyMap`） | `std::unordered_map<std::string, SeqKeys>` |
| 元组队列 | `queue: (readonly [Status, LGK])[]` | `std::vector<std::pair<Status, GameKey>>` 或小 struct |
| 可空 `_chase_pos` | 惰性初始化 | `std::optional<Vec3>` |
| getter 运算密集 | `LR`/`UD` 用 `keys.L.is_end()` 组合 | 普通方法，逻辑 1:1 |
| 数值枚举 | `Status { UP=0, DOWN=1, HOLD=2 }` | `enum class` |

## 移植要点

1. **输入是纯逻辑**（键盘数据 → 状态机 → 动作意图），无平台依赖；平台只负责喂原始按键。非常适合移植。
2. `SeqKeys`（`controller/SeqKeys.ts` 49 行）是字符串匹配的小状态机，C++ 直接照搬。
3. 方向合成 getter 是“行为契约”，移植后必须用**相同的输入序列做回归测试**（否则手感漂移）。
4. `BallController` / `LocalController` / `InvalidController` 都是它的子类，`BaseController` 就绪后它们顺带完成。

## 预估

- 1–2 周（含 KeyStatus/DoubleClicks/SeqKeys 三个支持类）
