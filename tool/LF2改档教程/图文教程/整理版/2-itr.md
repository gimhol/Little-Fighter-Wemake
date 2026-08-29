# 2. 攻击框 itr

> 介绍 `<itr>` ~ `<itr_end>` 的结构、kind、effect、fall、bdefend。

## 目录

- [结构](#结构)
- [字段说明](#字段说明)
- [kind 种类](#kind-种类)
- [effect 效果](#effect-效果)
- [fall 击倒系数](#fall-击倒系数)
- [bdefend 破防系数](#bdefend-破防系数)
- [附图](#附图)

## 结构

```text
itr:  (interaction)
kind:
x:
y:
w:
h:
arest:
vrest:
dvx:
dvy:
fall:
bdefend:
injury:
zwidth:
effect:
catchingact:
caughtact:
pickingact:
itr_end:
```

## 字段说明

| 字段 | 说明 |
| ---- | ---- |
| kind | 种类 |
| x / y / w / h | 范围 |
| arest | 攻击一单位后，多久时间才能再攻击，此时 vrest 无效 |
| vrest | 可攻击多人，多久时间后才能再攻击；与 fall 大于 41 使用时，vrest 小于 4 会导致动作无法进行 |
| dvx / dvy | 被攻击者向后弹的速度 |
| fall | 被攻击者的倒地值 |
| bdefend | （break defence）被攻击者的破防值 |
| injury | 攻击力（受伤量） |
| zwidth | z 轴范围 |
| effect | 效果，与 kind: 0 使用 |
| catchingact | 捉人后的动作，与 kind: 1、3 使用 |
| caughtact | 被捉者的动作，与 kind: 1、3 使用 |
| pickingact | 捉人后的动作，功能与 catchingact 相同 |

## kind 种类

| kind | 说明 |
| ---- | ---- |
| 0 | 一般攻击 |
| 1 | 捉住 state: 16 的人，与 walking 动作使用 |
| 2 | 捡武器 |
| 3 | 捉住敌人 |
| 4 | 被敌人用 cpoint 丢出去时才有功用 |
| 5 | 用于武器，与 `<weapon_strength_list>` 有关 |
| 6 | 让敌人按攻击时会跳到动作 70 |
| 7 | 捡轻型武器不影响动作 |
| 8 | 治疗，injury 为回复多少 HP，跳至 dvx 的动作 |
| 9 | 打到 type: 0，自己 HP 变成零；打气功，气功不损血 |
| 10 | （flute）henry 魔王之乐章效果 |
| 11 | （无说明） |
| 14 | 阻挡其他物件做 x、z 方向移动 |
| 15 | （whirlwind）freeze 白色龙卷效果，飞起来 |
| 16 | （whirlwind）freeze 白色龙卷效果，结冻 |

> 附图：kind: 10、kind: 14、kind: 15、kind: 16。

## effect 效果

| effect | 说明 |
| ------ | ---- |
| 0 | 拳击 |
| 1 | 流血 |
| 2 | 火焰 |
| 20 | 火焰，打不到气功，打不到 state: 18、19 |
| 21 | 火焰，打不到 state: 18、19 |
| 22 | 火焰，左右攻击方向向内 |
| 23 | 拳击（火焰音效），左右攻击方向向内 |
| 3 | 结冰 |
| 30 | 结冰，打不到 state: 13 |
| 4 | 打不到 type: 0 |
| 负值、其他数值 | 击中无音效 |

## fall 击倒系数

| fall | 说明 |
| ---- | ---- |
| 0 ~ 20 | 敌人被打的动作是 220 |
| 21 ~ 40 | 敌人被打的动作是 222、224 |
| 41 ~ 60 | 敌人被打的动作是 226 |
| 61 以上 | 敌人被打的动作是 180、186 |
| 负值 | 不会影响敌人的动作（但可能会导致定身火） |

> [!NOTE]
> - 人物有 fall 值，被攻击会减少，会随时间回复；被抓取或死亡，fall 值会重置。
> - fall 值会累积。

## bdefend 破防系数

（敌人在 state: 7 的状态下）

| bdefend | 说明 |
| ------- | ---- |
| 30 以下 | 敌人被打不影响动作 |
| 31 ~ 60 | 敌人被打的动作是 112 |
| 61 以上 | 直接伤害 |
| 100 | 直接伤害，摧毁武器 |

> [!NOTE]
> - 人物有 bdefend 值，被攻击会减少，会随时间回复。
> - bdefend 值会累积。

## 附图

![image1](2-itr_images/image1.gif)

![image2](2-itr_images/image2.gif)

![image3](2-itr_images/image3.gif)

![image4](2-itr_images/image4.gif)
