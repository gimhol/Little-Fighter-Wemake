# 4. 抓人框 cpoint

> 介绍 `<cpoint>` ~ `<cpoint_end>` 的结构与说明。

## 目录

- [结构](#结构)
- [字段说明](#字段说明)
- [kind 种类](#kind-种类)
- [injury 伤害值](#injury-伤害值)
- [cover 遮盖](#cover-遮盖)
- [hurtable 可被攻击](#hurtable-可被攻击)
- [throwinjury 着地伤害](#throwinjury-着地伤害)
- [decrease 可抓时间](#decrease-可抓时间)

## 结构

```text
cpoint:  (catch point)
kind:
x:
y:
injury:
cover:
vaction:
aaction:
jaction:
taction:
throwvx:
throwvy:
throwvz:
hurtable:
throwinjury:
fronthurtact:
backhurtact:
decrease:
dircontrol:
cpoint_end:
```

## 字段说明

| 字段 | 说明 |
| ---- | ---- |
| kind | 种类 |
| x / y | 位置 |
| injury | 伤害值 |
| cover | 遮盖 |
| vaction | 被捉者的动作 |
| aaction | 按攻击的动作 |
| jaction | 按跳跃的动作 |
| taction | 按方向攻击的动作 |
| throwvx / throwvy / throwvz | 被捉者被丢出去的速度 |
| hurtable | 被捉者是否可被攻击 |
| throwinjury | 着地伤害值 |
| fronthurtact | 被捉者前面被打的动作 |
| backhurtact | 被捉者后面被打的动作 |
| decrease | 能捉的时间减少值（负值） |
| dircontrol | （direction control）控制方向 |

## kind 种类

| kind | 说明 |
| ---- | ---- |
| 1 | 当没捉到人，跳到动作 0 |
| 2 | 当没被捉着，跳到动作 212 |

## injury 伤害值

- 正值：有停格效果。
- 负值：无停格效果。
- 正值负值皆会使被捉者损血。

## cover 遮盖

| cover | 说明 |
| ----- | ---- |
| 0 | 被捉者在后（上侧） |
| 1 | 被捉者在前（下侧） |
| 10 | 被捉者在后（上侧） |
| 11 | 被捉者在前（下侧） |

> 10、11 会使被捉者转向。

## hurtable 可被攻击

- 0：被捉者不会被他人打到。
- 1：被捉者会被他人打到，被捉者脱离手中时，自己会跳到动作 0。
- ※ 被捉者的被捉动作若未使用 fronthurtact 及 backhurtact，被攻击会跳至 injured 动作。

## throwinjury 着地伤害

> [!NOTE]
> - throwvx 不为 0 时，可使用 throwinjury。
> - throwinjury 不能在 -2 以下，否则自己会消失。
> - -1 变身成被捉者的 id，可按 DJA 变回来（变回来的动作是 245）。
> - 被捉对象的动作 0 不得 `next: 1000`，否则程序出错。

## decrease 可抓时间

能抓住的时间大约是 = 266 / -#（266 / 7 = 38 TUs）。
