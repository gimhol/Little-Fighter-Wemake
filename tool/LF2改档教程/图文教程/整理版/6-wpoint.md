# 6. 武器点 wpoint 与武器攻击表

> 介绍 `<wpoint>` ~ `<wpoint_end>` 的结构与说明，以及 `<weapon_strength_list>` 武器攻击表。

## 目录

- [结构](#结构)
- [字段说明](#字段说明)
- [kind 种类](#kind-种类)
- [cover 遮盖](#cover-遮盖)
- [weaponact 武器动作](#weaponact-武器动作)
- [武器攻击表 weapon_strength_list](#武器攻击表-weapon_strength_list)

## 结构

```text
wpoint:  (weapon point)
kind:
x:
y:
weaponact:
attacking:
cover:
dvx:
dvy:
dvz:
wpoint_end:
```

## 字段说明

| 字段 | 说明 |
| ---- | ---- |
| kind | 种类 |
| x / y | 位置 |
| weaponact | 武器动作 |
| attacking | 攻击状态（请查询该武器的 `<weapon_strength_list>`） |
| cover | 遮盖 |
| dvx / dvy / dvz | 武器丢出去的速度 |

## kind 种类

| kind | 说明 |
| ---- | ---- |
| 1 | 人物在使用的 |
| 2 | 武器在使用的 |
| 3 | 手持武器掉落 |

## cover 遮盖

- 0：武器显示在人物前面。
- 1：武器显示在人物后面。

## weaponact 武器动作

| weaponact | 说明 |
| --------- | ---- |
| -1 | 错误跳出 |
| -2 以下、400 以上 | 消失 |
| 1100 ~ 1299 | 手持物件隐身 |

## 武器攻击表 weapon_strength_list

武器的 `<weapon_strength_list>` 查看：

```text
entry: %d %s
dvx:  dvy:  fall:  arest:  vrest:  bdefend:  injury:  effect:
...
```

| 字段 | 说明 |
| ---- | ---- |
| dvx / dvy | 被攻击弹飞速度（dvy 要击倒才有效） |
| fall | 击倒值 |
| arest | 击中后，多久后才能再攻击（若设置此值，则 vrest 无效） |
| vrest | 可攻击复数敌人，同一个敌人被击中后，多久才会被攻击 |
| bdefend | 破防值 |
| injury | 攻击力（伤害值） |
| effect | 效果 |

**effect 效果：**

| effect | 说明 |
| ------ | ---- |
| 0 | 打击 |
| 1 | 利器 |
| 2 | 着火 |
| 20 | 着火 |
| 21 | 着火 |
| 22 | 着火，左右攻击方向向内 |
| 23 | 打击，火焰音效，左右攻击方向向内 |
| 3 | 结冰 |
| 30 | 结冰 |
| 4 | 无音效 |
| 其他数值 | 无音效 |

> [!NOTE]
> - 攻击范围的部分是在动作 20 ~ 35 的 `itr kind: 5` 中设定。
> - 可以自行添加 entry，如 `entry: 5 MyEntry` 等词条，设定人物的 attacking 来增加攻击方式。
> - 若此处 fall 设负值，对象不累积负 fall 值（参阅 Little Fighter 2 Official Forum 改档讨论）。
