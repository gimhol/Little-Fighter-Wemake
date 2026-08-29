# 1. 帧 frame

> 介绍 `<frame>` ~ `<frame_end>` 的结构、字段、state、next、mp、速度与气功专用指令。

## 目录

- [结构](#结构)
- [字段说明](#字段说明)
- [state 状态](#state-状态)
  - [气功、武器专用 state](#气功武器专用-state)
- [next 下一动作](#next-下一动作)
- [mp 消耗](#mp-消耗)
- [dvx / dvy / dvz 速度](#dvx--dvy--dvz-速度)
- [hit_xx 按键指令](#hit_xx-按键指令)
- [type 3 专用的 hit_a / hit_d / hit_j / hit_Fa](#type-3-专用的-hit_a--hit_d--hit_j--hit_fa)
- [附图](#附图)

## 结构

```text
<frame> (frame number) (frame name)
pic:
state:
wait:
next:
dvx:
dvy:
dvz:
centerx:
centery:
hit_a:
hit_d:
hit_j:
hit_Da:
hit_Fa:
hit_Ua:
hit_Dj:
hit_Fj:
hit_Uj:
hit_ja:
mp:
sound:
(其他如: itr:, bdy:, bpoint:, cpoint:, opoint:, wpoint:)
<frame_end>
```

## 字段说明

| 字段 | 说明 |
| ---- | ---- |
| frame number | 动作编号 |
| frame name | 动作名称 |
| pic | 图片（picture） |
| state | 状态 |
| wait | 等待时间 |
| next | 下一个动作 |
| dvx | x 方向速度 |
| dvy | y 方向速度 |
| dvz | z 方向速度 |
| centerx | 动作的 x 轴中心点 |
| centery | 动作的 y 轴中心点 |
| hit_a | 键入攻击（A, attack）的动作 |
| hit_d | 键入防御（D, defend）的动作 |
| hit_j | 键入跳跃（J, jump）的动作 |
| hit_Da | 键入 DvA 的动作 |
| hit_Fa | 键入 D>A 的动作 |
| hit_Ua | 键入 D^A 的动作 |
| hit_Dj | 键入 DvJ 的动作 |
| hit_Fj | 键入 D>J 的动作 |
| hit_Uj | 键入 D^J 的动作 |
| hit_ja | 键入 DJA 的动作 |
| mp | 消耗 MP 量 |
| sound | 声音 |

## state 状态

| state | 说明 |
| ----- | ---- |
| 0 | （standing）空中时跳到动作 212 |
| 1 | （walking） |
| 2 | （running） |
| 3 | 攻击性动作，会使电脑做防御 |
| 4 | （jump）空中时可左右转，落地动作 215 |
| 5 | （dash） |
| 6 | （rowing）落地时跳到动作 215 |
| 7 | （defend）损血量变成 1/10 |
| 8 | （broken_defend） |
| 9 | （catching）使 cpoint 可对被捉者移动位置 |
| 10 | （picked_caught）武器掉落，可被同盟攻击，但持武器的不行 |
| 11 | （injured） |
| 12 | （falling）武器掉落，不会被 fall 小于 40 的打中 |
| 13 | （ice）可被同盟攻击，落地扣 10 HP，链接到其他的 state 会有碎冰 |
| 14 | （lying）电脑会远离你 |
| 15 | 普通动作 |
| 16 | （injured）会被 walking 动作的 itr kind: 1 捉起来 |
| 17 | （weapon_drink）持在手上的 id 212、213 奶酒会损耗 HP |
| 18 | （fire）可攻击同盟，effect: 21、22 除外；不会被 effect: 20、21 烧到，不会被 state: 19 + itr kind: 0 的 effect: 2 烧到，冒火苗 |
| 19 | （burn_run 烈火焚身）不会被 effect: 20、21 烧到，冒火苗，z 方向移动 |
| 100 | （落雷霸）着地跳到动作 94 |
| 301 | （dash_sword 鬼哭斩）z 方向移动 |
| 400 | （teleport 瞬间移动）移动到最近敌人，敌人在 120 的位置 |
| 401 | （teleport 瞬间移动）移动到最远同盟，同盟在 60 的位置 |
| 500 | （transform）若没先变过身，会跳到动作 0 |
| 501 | （transform）变身成前一次变身的角色 |
| 1700 | （heal_self） |
| 80## | 变身成 id ## 的角色（图片读取方式要做调整） |
| 9995 | 变身成 id 50 的 louisEX，只有 type: 0 能用 |
| 9996 | 造出 id 217、218 的 louis_armour |
| 9997 | 没影子，图片可见 |
| 9998 | 消失 |
| 9999 | （broken_weapon） |

> 附图：防御（state: 9996）、火苗（state: 9997）、碎冰。

### 气功、武器专用 state

| state | 说明 |
| ----- | ---- |
| 1000 | （in_the_sky）移动速度大于 10，跳到动作 40（type: 4, 6） |
| 1001 | （on_hand） |
| 1002 | （throwing）打到东西时，跳到动作 0 ~ 15；type: 4、6 状况下，落地时速度小于 10，会跳到动作 70 |
| 1003 | （just_on_ground） |
| 1004 | （on_ground）可被 itr kind: 2、7 拾起 |
| 2000 | （in_the_sky）面向左边 |
| 2001 | （on_hand） |
| 2004 | （on_ground）可被 itr kind: 2 拾起 |
| 3000 | （flying）打到东西时，跳到动作 10 |
| 3001 | （hitting） |
| 3002 | （hit） |
| 3003 | （rebounding） |
| 3004 | （disappearing） |
| 3005 | 没影子；type: 3 状况下，攻击 state: 3005 的气功，跳到动作 20 |
| 3006 | type: 3 状况下，攻击 state: 3006 的气功，跳到动作 20 |

## next 下一动作

| next | 说明 |
| ---- | ---- |
| 0 | 原动作 |
| 999 | 回到动作 0 |
| 1000 | 消失 |
| 1100 ~ 1299 | 隐身（回到动作 0） |
| -# | 跳到 # 动作并反向 |

以 cpoint 丢人时的 next：

- -1 以下、400 以上：消失（包括 999）

## mp 消耗

- 以 `hit_xx:` 连结：值大于 1000 时会扣 HP（如 `mp: 1400` 指 10 hp 和 400 mp）；填负值会加 mp 或 hp。
- 以 `next:` 连结：用 next 连结动作的 mp，则要写负值才会扣魔力，此数值不会扣 HP。
- 在 next 连结会消耗 mp 的动作时（`mp: -#`），键入反方向键或 mp 用罄，会跳到 `hit_d:` 的动作（hit_d 不能为 999）。

## dvx / dvy / dvz 速度

| 数值 | 说明 |
| ---- | ---- |
| 550 | 固定位置不动 |
| 501 ~ 549 | x 向左移动、y 向上移动、z 上侧移动 |
| 551 ~ 以上 | x 向右移动、y 向下移动、z 下侧移动 |
| dvz: #（人物） | 按上下时（空）可 z 移动 |

## hit_xx 按键指令

- 负值：反向出招。

## type 3 专用的 hit_a / hit_d / hit_j / hit_Fa

| 字段 | 说明 |
| ---- | ---- |
| hit_a | 扣血量，每一单位时间就会扣一次血，血量扣到零后，会跳到 hit_d 的动作 |
| hit_d | 与 hit_a 一同使用，当 HP 扣到零，就会跳到 hit_d 的动作 |
| hit_j | z 轴上下漂移，值 49 以下是向上移动，值 51 以上是向下移动 |
| hit_Fa | 气功的模式（此功能 type: 1, 2, 4, 6 亦可使用） |

**hit_Fa 气功模式：**

| hit_Fa | 说明 |
| ------ | ---- |
| 1 | （john_biscuit）追踪敌人（y center 高度 10） |
| 2 | （dennis_chase）追踪敌人 |
| 3 | （回力镖）追踪敌人 |
| 4 | （jan_chaseh）不能直接使用 |
| 5 | （jan_chaseh）造出 id 219，追踪我方人物 |
| 6 | （jan_chase）造出 id 220，追踪敌方人物 |
| 7 | （jan_chase, firzen_chasef, firzen_chasei）不能直接使用 |
| 8 | （bat_chase）造出 id 225，追踪敌方人物 |
| 9 | （firzen_chasef, firzen_chasei）变成 id 221、222，追踪敌方人物 |
| 10 | （john_biscuit）移动加速效果 |
| 11 | （极地火山）造出 firzen 的招术效果 |
| 12 | （bat_chase）追踪敌人（y center 高度 40） |
| 13 | （julian_ball）造出 id 228，追踪敌方人物 |
| 14 | （julian_ball）追踪敌人 |

> [!NOTE]
> - hit_Fa: 2、3、4、7、12、14，当 HP 扣完时，会失去追踪效果。
> - hit_Fa: 4、7 需先以其他 hit_Fa 值，使其追踪敌人，才可使用。

**hit_Fa: 2 的动作分配：** 转向时跳到动作 1，追人时跳到动作 3，飞离时跳到动作 5。

**hit_Fa: 14 的动作分配：**

| 转向时 | 追人时 |
| ------ | ------ |
| 50 | 0 |
| 51 | 1 |
| 52 | 2 |
| 53 | 3 |
| 54 | 4 |
| 55 | 5 |
| 56 | 6 |
| 57 | 7 |
| 58 | 8 |
| 59 | 9 |

## 附图

![image1](1-frame_images/image1.gif)

![image2](1-frame_images/image2.gif)

![image3](1-frame_images/image3.gif)

![image4](1-frame_images/image4.gif)

![image5](1-frame_images/image5.gif)
