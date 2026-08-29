# 7. 关卡 stage

> 介绍关卡档 `<stage>` ~ `<stage_end>` 的结构与说明。

## 目录

- [结构](#结构)
- [stage / phase 关卡与阶段](#stage--phase-关卡与阶段)
- [bound 场地宽度](#bound-场地宽度)
- [id 物件 id](#id-物件-id)
- [hp 血量](#hp-血量)
- [act 初始动作](#act-初始动作)
- [x / y 初始位置](#x--y-初始位置)
- [ratio 比率](#ratio-比率)
- [reserve 复活次数](#reserve-复活次数)
- [soldier / boss 士兵与魔王](#soldier--boss-士兵与魔王)
- [times / join / join_reserve](#times--join--join_reserve)

## 结构

```text
<stage>
id:

<phase>
bound:

id:
  hp:
  act:
  x:
  y:
  ratio:
  reserve:
  <soldier>
  <boss>
  times:
  join:
  join_reserve:

<phase_end>

<stage_end>
```

## stage / phase 关卡与阶段

| 标签 | 说明 |
| ---- | ---- |
| `<stage>` / `id:` | 关卡，0 = 1-1 关，1 = 1-2 关，2 = 1-3 关，10 = 2-1 关，20 = 3-1 关，依此类推 |
| `<phase>` | 阶段。※ 放置超过 10 个阶段会出现问题 |

## bound 场地宽度

- 场地宽度。
- ※ 超过原地图的宽度会造成无法进入下一关。
- ※ 不能与前一个 bound 值相同，会造成无法进入下一关。

## id 物件 id

| id | 说明 |
| -- | ---- |
| 1000 | 随机出现 id 1、2、4、5、6、7、8、9、10、11 的角色 |
| 3000 | 随机出现 id 30、31 的角色 |

## hp 血量

- 难度 Easy，敌人血量 × 75%。
- 难度 CRAZY!，敌人血量 × 150%。

## act 初始动作

一开始的动作（只有对 type 0、5 有效）。

## x / y 初始位置

- **x**：一开始的位置（会有 +200 以内的随机位置）。默认值为 -300 或 bound+300 的位置。
- **y**：一开始的高度（只有对 type 0、5 有效）。type 1、2、3、4、6 会从高空 300 的地方出现。

## ratio 比率

- 敌人数量 = 玩家 × ratio。
- 一个 id，场上最多只能同时放 40 个物件。

## reserve 复活次数

- 复活次数。
- ※ 只能用在人质，用在敌人身上的话可能会出现错误。

## soldier / boss 士兵与魔王

- **`<soldier>` 士兵**：当设为 boss 的敌方角色还没被打死，则士兵会一直补充。注：默认补充次数为 50 次。
- **`<boss>` 魔王**：见上。

## times / join / join_reserve

| 字段 | 说明 |
| ---- | ---- |
| times | 补充次数 |
| join | 加入我方后的血量 |
| join_reserve | 加入我方后的复活次数 |
