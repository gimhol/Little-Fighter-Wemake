# 8. id 与 type

> 介绍各 id 的特性、各 type 物件的特性与 frame 分布。

## 目录

- [id 特性](#id-特性)
- [type 物件种类](#type-物件种类)
  - [type 0 人物](#type-0-人物)
  - [type 1 轻型武器（棍棒类）](#type-1-轻型武器棍棒类)
  - [type 2 重型武器](#type-2-重型武器)
  - [type 3 气功类](#type-3-气功类)
  - [type 4 轻型武器（球类）](#type-4-轻型武器球类)
  - [type 5 其他](#type-5-其他)
  - [type 6 轻型武器（饮品类）](#type-6-轻型武器饮品类)
- [附图](#附图)

## id 特性

**人物 id：**

| id | 说明 |
| -- | ---- |
| 1 | deep 的战斗模式 |
| 2 | john 的战斗模式 |
| 4 | henry 的战斗模式 |
| 5 | rudolf 的战斗模式，造出时 HP 只有 10 |
| 6 | louis 的战斗模式，非攻击状态下，有 1 次防御，不会防冰火和 id: 208、214 的攻击，HP 少于 1/3 时才能使用 DJA 指令 |
| 7 | firen 的战斗模式 |
| 8 | freeze 的战斗模式，攻击气功，气功会变成冷冻波弹回去 |
| 7、8 | 双方 HP 少于 1/5，跑步互撞会变身成 id 51 |
| 9 | dennis 的战斗模式 |
| 10 | woody 的战斗模式 |
| 11 | davis 的战斗模式 |
| 30 | bandit |
| 31 | hunter |
| 32 | mark |
| 33 | jack |
| 34 | sorcerer |
| 35 | monk |
| 36 | jan |
| 37 | knight，有 2 次防御，不会防冰火和 id: 208、214 的攻击 |
| 38 | justin |
| 39 | bat |
| 50 | louisEX 的战斗模式 |
| 51 | firzen 的战斗模式，MP 回复速度快，闯关敌人数量 × 2 |
| 52 | julian 的战斗模式，MP 回复速度快，闯关敌人数量 × 3，造出时 HP 只有 10，有 2 次防御，但不防 id: 208、214 的攻击 |

**武器 id：**

| id | 说明 |
| -- | ---- |
| 100 | weapon0 #stick |
| 101 | weapon2 #hoe |
| 120 | weapon4 #knife |
| 121 | weapon5 #baseball |
| 122 | weapon6（milk）人物以 state 17 将牛奶持在手上时，可恢复 HP、MP |
| 123 | weapon8（beer）人物以 state 17 将啤酒持在手上时，可恢复 MP |
| 124 | weapon9 #< |
| 150 | weapon1 #stone |
| 151 | weapon3 #wooden_box |

**气功 id：**

| id | 说明 |
| -- | ---- |
| 200 | john_ball |
| 201 | （henry_arrow1）打到人（type 0），自己会消失 |
| 202 | rudolf_weapon |
| 203 | deep_ball |
| 204 | henry_wind |
| 205 | dennis_ball |
| 206 | woody_ball |
| 207 | davis_ball |
| 208 | henry_arrow2 |
| 209 | （freeze_ball）攻击特定气功会变成冷冻波弹回去 |
| 210 | firen_ball |
| 211 | firen_flame |
| 212 | （freeze_column）可被同盟攻击，不会被 id 212 打到 |
| 213 | weapon7（ice_sword）攻击特定气功会变成冷冻波弹回去 |
| 214 | （john_biscuit）打到人（type 0），自己 HP 变成 0 |
| 215 | dennis_chase |
| 216 | jack_ball |
| 217 | weapon10 #louis_armour |
| 218 | weapon11 #louis_armour |
| 219 | jan_chaseh |
| 220 | jan_chase |
| 221 | firzen_chasef |
| 222 | firzen_chasei |
| 223 | （firzen_ball）没有影子，造出时，无法用上下键控制方向 |
| 224 | （bat_ball）没有影子，造出时，无法用上下键控制方向 |
| 225 | bat_chase |
| 226 | justin_ball |
| 228 | julian_ball |
| 229 | julian_ball2 |
| 300 | （criminal）可用 bdy kind 来控制被打后的动作 |
| 998 | etc |
| 999 | broken_weapon |

> 附图：自动防御（id 201）、弹回冷冻波、弹回冷冻波 2。
>
> 可变 freeze_ball 的特定 id：200、203、205、206、207、215、216。

## type 物件种类

| type | 说明 |
| ---- | ---- |
| 0 | （人物） |
| 1 | （轻型武器 - 棍棒类） |
| 2 | （重型武器） |
| 3 | （气功类） |
| 4 | （轻型武器 - 球类） |
| 5 | （其他） |
| 6 | （轻型武器 - 饮品类） |

### type 0 人物

简单来说就是玩家可选择的人物，电脑会分配 AI 去控制它。

- 重力效果：1.7
- 落地动作跳到 219
- 空中且 state: 0 会跳到动作 212
- 被攻击跳到动作 220、222、224、226、180、186
- 被 effect: 2、20、21、22 攻击跳到动作 203
- 被 effect: 3、30 攻击跳到动作 200

**frame 分布：**

```text
0 standing
5, 6, 7, 8 walking
9, 10, 11 running
12, 13, 14, 15 heavy_obj_walk
16, 17, 18 heavy_obj_run
19 heavy_stop_run
20, 25 normal_weapon_atck
30 jump_weapon_atck
35 run_weapon_atck
40 dash_weapon_atck
45 light_weapon_thw
50 heavy_weapon_thw
52 sky_lgt_wp_thw
55 weapon_drink
60, 65 punch
70 super_punch
80 jump_attack
85 run_attack
90 dash_attack
100, 108 rowing（受身）
102 rowing（run+D，滚地）
110 defend
111 defend
112 broken_defend
115 picking_light
116 picking_heavy
120 (catching)
130 ~ 144 (picked_caught)
180, 186 falling
200 ice
203, 204, 205, 206 fire
210 jump
212 jump
213, 214, 216, 217 dash
215 crouch
218 stop_running
219 crouch2
220, 222, 224, 226 injured
230, 231 lying
232 (throw_lying_man)
245 transform_b（用 throwinjury: -1 变身后，以 DJA 变回来的动作）
```

### type 1 轻型武器（棍棒类）

玩家拾取并挥击的武器。

- 重力效果：1.7
- 可使用 hit_Fa 功能
- 落地会跳转到 60
- 被攻击会跳到随机动作 0 ~ 15
- state: 1002，且落地 y 速度 < 10，跳到动作 70
- state: 1002，且落地 y 速度 >= 10，跳到动作 7，转方向，弹跳

**frame 分布：**

```text
0 ~ 15 flying
20 ~ 35 on_hand
40 ~ 55 throw
60 on_ground
70 just_on_ground
```

### type 2 重型武器

人物拾取并投掷的道具。

- 重力效果：1.7
- 可使用 hit_Fa 功能
- 人物受到攻击即掉落
- 被 fall: 61 以上攻击，跳到随机动作 0 ~ 5
- 落地 y 速度 < 10，动作跳到 20
- 落地 y 速度 >= 10，转方向，弹跳（不跳转动作）

**frame 分布：**

```text
0 ~ 5 in_the_sky
10 on_hand
20 on_ground
```

### type 3 气功类

气功波大多为此类。

- 无重力效果
- 无落地动作跳转
- 可使用 hit_a、hit_d、hit_j、hit_Fa 功能
- 人物可反方向攻击气功

**条件：**

1. 受气功、道具类攻击会跳到 20。
2. 受人物攻击会跳到 30。

**特殊规则：**

- state: 3005、3006，fall 总值 80，被攻击，fall 值刚好扣到 0 时才会跳到条件 1、2（(80 - fall) % (fall - vrest) = 0 时，且须 fall > vrest）。
- state: 3005，受 state 3005 攻击会跳到 20（不改队伍），其他不会。
- state: 3006，受 state 3005 攻击会跳到条件 1、2。
- state: 3006，受 state 3006 攻击会跳到 20（不改队伍），其他不会。
- state: 3005，受 itr kind: 9 攻击，会跳到 40（不改队伍）。
- state: 3006，受 itr kind: 9 攻击，会跳到 30。
- （3005 打 3005 的气功，或 3006 打 3006 的气功，跳到 20）
- （3000 打到东西跳到 10）

**frame 分布：**

```text
20 hit
30 rebounding
40 disappearing
```

### type 4 轻型武器（球类）

- 人物拾取后，按攻击，跳到丢武器动作
- 落地会跳转到 60
- 可使用 hit_Fa 功能
- state: 1000，且 x 速度 >= 10，会跳到动作 40
- state: 1002，且落地 y 速度 < 9，会跳到动作 70
- state: 1002，且落地 y 速度 >= 9，会跳到动作 0，弹跳
- 重力效果：0.85

**frame 分布：**（原文未列出）

### type 5 其他

（原文未详述）

### type 6 轻型武器（饮品类）

（原文未详述）

## 附图

![image1](8-id-type_images/image1.gif)

![image2](8-id-type_images/image2.gif)

![image3](8-id-type_images/image3.gif)

![image4](8-id-type_images/image4.gif)
