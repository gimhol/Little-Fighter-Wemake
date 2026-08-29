# LF2 完全改档教学

> 主题：人物 act（即 frame）的分布、state、itr / opoint / cpoint、变身与图档、气功波、武器、id 特性、闯关、LF 所有秘密解释与实用技巧。

## 目录

- [人物 act（frame）的分布](#人物-actframe的分布)
- [pic 与 wait](#pic-与-wait)
- [人物 state](#人物-state)
- [itr 解说](#itr-解说)
- [opoint 解说](#opoint-解说)
- [cpoint 解说](#cpoint-解说)
- [变身与图档](#变身与图档)
- [气功波](#气功波)
- [武器](#武器)
- [id 特性](#id-特性)
- [闯关](#闯关)
- [LF 所有秘密解释](#lf-所有秘密解释)
- [实用技巧](#实用技巧)

## 人物 act（frame）的分布

- **213**：普通冲跳，即 `>>J`。
- **214**：倒冲跳，即 `>>J<`（大家试一下就知道有的）。
- **215**：state：4、6 刚落地的动作。
- **219**：刚滚完的动作或刚爬起的动作，rowing（滚地）frame 230、231 的 next。特别地，既不是 state：4、6，也不是 state：100 时刚落地也跳到 frame 219。
- **232**：丢出被捉的人，可随便改，就是 frame 121 有 traction：232 或 -232。
- **399**：可利用。

> [!NOTE]
> - frame 120、122、130~144、232 不属系统预设的，可随便改。
> - 可利用的 frame：235~398、145~179、124~129、28、29、39、48、49、59、6X、7X、8X、95、207、399（X 是随人物 punch、super_punch、jump_attack、run_attack 等的 frame 数量决定的）。

## pic 与 wait

- **pic**：数值如果是 dat 中没载入的，就代表长宽各为 0 的空白图，通常用 `pic: 999`。
- **wait**：
  - 用 `next:` 接动作时：`wait: n` =（n + 1）单位时间
  - 用 `hit_x` 或 `opoint:` 接动作时：`wait: n` = n 个单位时间
  - 30 单位时间 = 1 秒

## 人物 state

- 落地跳到的 frame：state：13，落地不影响动作或跳到 next。
- `next: 999`：气功波跳到 frame 0；人物在地上也跳到 frame 0，在空中跳 frame 212。

## itr 解说

### kind

| kind | 说明 |
| ---- | ---- |
| 2 | 与 state：1004 作用时，自己跳到 act 115；与 state：2004 作用后，自己跳到 act 116。（捡武器） |
| 4 | 如果人物是被抓起丢出去的，可敌我通杀。 |
| 5 | 写在武器 on_hand 中，只有 wpoint attacking 不是 0 时才有效，仅表示范围，其他还靠 entry。 |
| 7 | 在此 frame 中不拿武器按 A 可捡 state：1004 的武器，但不影响动作。 |
| 10 | 无论敌人原始高度，也无视 dvy。 |
| 14 | 敌我都能阻挡。 |

### 快速回复 HP 的方法

1. `state: 1700`，补暗红色的血到满，不能补无色的部位。
2. `itr kind: 8`，若暗红色部分大于 injury，则补 injury 数量的 HP；若暗红色部分小于 injury，则把暗红色补满。
3. 喝 `id: 122` `type: 6` 的武器可回复，补多少不能改，补至 500 HP 为止（仅仅与第 4 点对比）。
4. 在 hit 到达的 frame 中写入 `mp: -x000`，则补 10x HP，无任何限制，甚至能在超过 500 HP 以后继续补，但不能用 F6（否则补不了）。

> 补充说明：
> - 500 HP ~ 600 HP 之间时，会出现红色棒超出外面的情况。
> - 600 HP ~ 1100 HP 之间时，所有血都变成暗红色，暗红色的多少是超过 600 的部分决定的。
> - 1100 HP 以上时，红色棒会像死后的一样，但蓝色棒正常不变。

### fall 的特殊说明

> [!NOTE]
> 当 itr 为冰火或 kind 不为 0、4、9 时，fall 的作用：
> 1. 当 fall ≤ 60 时，打不到 state：12 的人。
> 2. 当 fall = 70 时，打得到 state：12 的人。

### effect

> [!NOTE]
> effect 在 kind：0、4、9 时有效。
> - `effect: 23` 光柱时用上。
> - `effect: 25` 不着火的火焰。

## opoint 解说

### dvx、dvy 完全说明

这里只以 x 为例，y 与 X 一样。设 opoint dvx：a，object 本身的 dvx：b，实际气功波速度为 v：

| 条件 | v |
| ---- | - |
| a = 0 时 | v = b |
| b = 0 时 | v = a |
| b = 550 时 | v = 0 |
| a < b 时 | v = b |
| a = b 时 | v = a = b |
| a > b 时 | v = a |

一句话概括：取 a、b 中较快的是 v；a、b 中若有一个为 0，则 v 取另一个的值；若 b 为 550，则气功波不运动。

> [!NOTE]
> - 同一个 frame 中只能有一个 opoint。
> - 直接由 hit、catchingact、opoint action 到达的第一个 frame 中 opoint 无效。

## cpoint 解说

- **cover**：10 你盖住被抓者的图示，11 被抓者盖住你的图示。
- **injury**：只会打到被抓者。
- **hurtable**：无论它为 0 或 1，被抓者一定会被 cpoint injury 打到。
  - 如果 hurtable 为 1 且 vaction 为 130~132，那么当敌人被打到时自己跳到 frame 0。
  - 当 decrease 时间扣完时情况也是这样。
- **throwvz、throwinjury**：不丢人时写 `-842150451`，丢人时按实际情况写。
  - > [!NOTE] 丢人之前最后一个 frame 的 vaction 必须不含 cpoint kind：2。
- **throwinjury**：0 自己会消失，-1 是变化术。

## 变身与图档

1. 图档 file（?-?）数值只是记事本功能，pic 是从 0 开始根据每个图档 row × col 累加得到的。例如：

```text
file(0-69):    sprite\sys\XXX_0.bmp  w: 79  h: 79  row: 10  col: 7
file(70-150):  sprite\sys\XXX_1.bmp  w: 79  h: 79  row: 10  col: 7
file(151-160): sprite\sys\XXX_2.bmp  w: 149 h: 87  row: 5   col: 2
file(161-170): sprite\sys\XXX_3.bmp  w: 94  h: 64  row: 6   col: 1
```

则 pic：151 不是 XXX_2.bmp 的第一张图，而是 XXX_3.bmp 的第二张图，系统无视 file(?-?)。

2. 如果人物是变身后的，则实际使用的 pic 是 frame 中 pic + 140。
   例如：原本 frame 中设置 pic：142，则变身后使用的是 pic：282。

3. 变身设置后所对应的图片如果不同，就会造成 criminal 的效果，例如：

```text
file(0-69):    sprite\sys\xxx_0.bmp  w: 79  h: 79  row: 10  col: 7
file(70-139):  sprite\sys\xxx_1.bmp  w: 79  h: 79  row: 10  col: 7
file(140-209): sprite\sys\xxx_0b.bmp w: 79  h: 79  row: 10  col: 7
file(210-279): sprite\sys\xxx_1b.bmp w: 79  h: 79  row: 10  col: 7
file(280-349): sprite\sys\xxx_2.bmp  w: 79  h: 79  row: 10  col: 7
file(350-419): sprite\sys\xxx_2.bmp  w: 79  h: 79  row: 10  col: 7
file(420-489): sprite\sys\xxx_2b.bmp w: 79  h: 79  row: 10  col: 7
```

此时，如果人物是变身后的，则使用图档为 `xxx*?b.bmp`；如果是直接选的，则图档为 `xxx_?.bmp`。

4. 变身设置后 pic 数值都必须使 pic 与 pic + 140 两幅图对应。例如：

```text
file(0-69):    sprite\sys\xxx_0.bmp w: 79  h: 79  row: 10  col: 7
file(70-139):  sprite\sys\xxx_1.bmp w: 79  h: 79  row: 10  col: 7
file(140-209): sprite\sys\xxx_0.bmp w: 79  h: 79  row: 10  col: 7
file(210-279): sprite\sys\xxx_1.bmp w: 79  h: 79  row: 10  col: 7
file(280-349): sprite\sys\xxx_2.bmp w: 79  h: 79  row: 10  col: 7
file(350-419): sprite\sys\xxx_2.bmp w: 79  h: 79  row: 10  col: 7
file(420-489): sprite\sys\xxx_2.bmp w: 79  h: 79  row: 10  col: 7
```

则设置 pic 时只能是载入图档的第一个，这里即是 0~69、70~139、280~349。

5. 变身前最后一个 frame 中，pic 显示的是变身前人物的图档，next、hit 无效，一律 `next: 999`。
6. 变成 id：50 的人时用 state：8050，则 pic 会 +140；用 state：9995 则不会。

## 气功波

> [!NOTE]
> R-LouisEX 的凤凰羽毛中设了 weapon_hp：10000。气功波 HP 不是默认 500（501？）吗？

- **hit_a**：气功波的耗 HP 值。每个气功波有 500 MP，耗完后跳至 hit_d；`hit_d: 0` 则跳到 frame 20，且失去跟踪能力。F7 不但能使人物 HP、MP 归 500，也能使气功波 HP 归 500。
  - > [!NOTE] 气功波没 HP 时跳转 frame 的原则与 itr kind：9 打到人 HP 归 0 一样。
- **hit_j**：会强制移动。
- **hit_Fa**：
  - 5、6、8、9、13：按相应数量发出特定 id 和 frame 的气功波。例如：9：随机发出 id：221、222，frame 0 的气功波。
  - 10：没有追踪效果，只会加速。

### state（气功波）

- **15**：打中人物、武器自己无影响，被气功波打中后效果同 3000。
- **18**：与人物一样。
- **3005**：利用 `facing: X0` 只能使气功波平行飞行（不重合），但飞行时不能上下分叉。
- > [!NOTE] state：3006 的穿心强度还与 bdefend 有关（对于打中人、小波、武器而言）。穿心箭、恶魔炸弹能所向无敌，是因为它的 bdefend 有 60 或以上；气旋斩一下就会被反弹，这与它 bdefend 只有 20 有关。

### act 分布（气功波）

| act | 说明 |
| --- | ---- |
| 10 | state：3000 气功波用 itr kind：0 打到人。 |
| 20 | 被打中（只有 itr kind：0 才能打到气功波）。 |
| 30 | 被反弹。 |
| 40 | 见下面「itr 能反弹气功波原则」。 |

> [!NOTE]
> 气功波的反弹是在 rebounding 中设置 `opoint action: 0 oid: [自己的 id]` 反弹回去。有些气功波一反弹就爆是把这个 opoint 删除。

### itr 能反弹气功波原则

itr 打波反弹与否，分很多情况的。`itr kind: 0` 的话，要看攻击物的 type 和被攻击波的 state：如 type 0 的这种打 state 3000、3002 就可以反弹，其他的 type 都不会反弹波；但是有一个特殊的 `itr kind: 9`，任何 type 的 object 装上它都能反弹 state 3000、3002、3006（打 3005 会跳到 frame 40）。（这里所谓反弹波，是使波跳到 frame 30）

## 武器

攻击表：怎样设置武器的攻击范围？

**轻型武器 act：**

- 20~35：可以随便更改，是人物 wpoint 的 weaponact。
- 60：刚落地。
- 70：貌似无用。
- 64：可随便更改，是 frame 60、70 用 next 跳转几个 frame 后到达的。

**重型武器 act：**

- 0：重型武器被投掷或从天上掉下都是这个 frame。
- 10：同轻型武器，是人物 wpoint 的 weaponact。

> 特别发现：武器的投掷方法是由 id 决定的。

## id 特性

1. `id: 201、202` 的武器不受 itr kind：10、15 影响。
   1.1 `id: 201、202` 能与 bdy kind：1XXX 作用。
2. `id: 6` HP ＜ 1/3 时才能 `hit_ja: 300`。`id: 7、8` HP 各小于 1/5 时才能合体为 id：51 的人，跳到 frame 290。
   - > [!NOTE] 在没有 hit_ja：的 frame 中按 DJA 就能解除。HP 限制「lf2.net」解除。
3. `id: 6` 一次盔甲防御；`id: 37` 二次盔甲防御；`id: 52` 二次强力防御。
   - 盔甲防御：
     1. 只能防御 kind：0、effect：0、1、5~9。
     2. bdefend 必须小于等于 60 才能防御。
   - 强力防御：
     1. 只能防御 itr kind：0。
     2. 同上，bdefend 必须小于等于 60 才能防御。
4. `id: 8、209、213` 所有 itr kind：0 能使 state：3000 的气功波反弹成 id：209 的气功波。
   - `id: 213` 的武器被挥动（wpoint attacking 不为 0）时也能使 state：3000 的气功波反弹成 id：209 的气功波。
   - `id: 210、220、221~226、228` 以及 3xx 不受 id：8、209、313 影响。
5. `id: 223、224` 只能直发，且没有影子（除了穿透效果外，其他与 state：3005 同）。
6. (1) `id: 122` 的武器能使人回复 HP、MP；`id: 123` 的武器能使人快速回复 MP。
   (2) 闯关时遇到敌人的 id 如果为 30~37 及 39，则敌人影子下不会写「com」。
   (3) `id: 100~199` 会掉落的物品。不能更改。

## 闯关

- id：闯关的实际顺序，`#stage x-x` 只是记事本功能用的。如果 id 与编号配合的话，stage x-y 的 id 应为 [x-1][y-1]（两位数）。例如，stage 2-4 的 id 是 13。每大关最多 10 小关。
- 人物没有的 id：3000：id：30 或 31 的人（随机）。

## LF 所有秘密解释

1. 开启游戏成功后，打入「lf2.net」即可使用隐藏人物，切记不要按到右边的数字键。
   - `id: 30~39、50~59` 的人物必须打「lf2.net」才能使用。
2. Deep MP 少于 15、Bat MP 少于 10 MP 时，在地上打滚，往反方向出 `D>J` 会往回滚。
   - 在 hit 到达的 frame 中若 MP 不足则不会影响动作，但这个 hit 若是 `D>A`、`D>J` 的则会影响方向。第 23 同。
3. Rudolf 被击上天，适当时机下按 `D>J` 可在空中使用刺虎。
   - 在 rowing（受身）中有 `hit_Fj: 274`（即刺虎的第二个 frame）。因为 `D>J` 中含有 J，所以会进入受身状态，再利用 hit 发刺虎。
4. 战争模式的牛奶与啤酒选项弄反了。
   - exe 有 bug，与改档无关。
5. Louis 在落地的前一个影格受到某些攻击，会停顿在空中。
   - 与盔甲防御有关。
6. F7 可以使 Rudolf 分身变成 500 HP。
   - F7 的作用是所有人 HP 归 500，分身出来的也一样。
   - 按着 F7 还可让招式持久，例如让防护盾永不消失。F7 可以使气功波的 HP 归 500。
7. 四个飞弹同时击中气旋斩可抵销。
   - 见前面气功波 state 解说的下面，与气旋斩 bdefend 太低有关。
8. Bat 秘密招式：捉人 + DvA。
   - frame 121 中有 `hit_Da: 274`。
9. Firen 跟 Freeze 同队伍，双方 HP 都少于 1/5，两人面对面奔跑会融合成 Firzen，DJA 解除。
   - id 特性。
10. Louis 当 HP 少于 1/2 按下 DJA 可脱下盔甲成为 LouisEX。
    - HP 限制是 id 特性，至于他按 DJA 干什么是 frame 设的，变身是 state：9995。
11. 某些角色拿着武器到墙边，使其手上的武器完全受到视窗遮蔽，会发现武器自动消失。
    - 武器、气功波到达场外会消失，但角色拿武器必须足够远（wpoint 的 x 足够大），所以只有部分角色能做到。
12. Rudolf 可用变化术提早起身（还可爆冰）。
    - 必须是变回来才行。state：501 无论处于哪个 frame 都会强制变身。
13. 旋风摔在捉人瞬间遇到对方攻击（但有捉到），会有意想不到的效果。
    - 效果是：不影响动作，但自己会根据对方攻击 itr 的 dvx、dvy 运动。任何 itr kind：3 都会这样。
14. Rudolf 变成 Freeze，再与 Firen 合体，Rudolf 用变化术变回原体，Firen 消失了。
    - state：501 是强制变身，且变化术仍会识别为自己变成的是 Freeze，所以变回去后自己是 Freeze，Firen 消失了。
15. 百烈拳第三～四拳受到某些攻击，使出升龙霸会升很高。
    - 好象是惯性问题.....
16. 百烈腿、百烈拳、旋风腿、无影脚在打人时候，如果另一人突然加进来给你打，你会从头第一击起。
    - vrest 原因。
17. 当 Rudolf 要变身为对方的瞬间，对方如果在这时候遭受特定攻击，就会悬浮在空中。（此条谁能解释？）
18. Davis 跑步时候可以不滚地而出任何招式。
    - 在 rowing（滚地）中有 hit。
19. 用 Rudolf 变化成 Julian 后使用镜像，此时变回本尊 Rudolf 发现镜像变成你的分身。
    - 镜像是人物的分身，他的 frame 是人物无法跳到的，最后会消失。state：501 是强制变身，对分身也是。
20. Knight 拿着武器按 `D>A` 可以挥剑。
    - standing、walking、defend 中有 `hit_Fa: 240`，此 frame 与 frame 60 的 next 是一样的，也是挥剑。
21. Rudolf 拿着轻型武器会藏在衣里。
    - wpoint 中写入 cover：1。
22. Davis 的 `>>A` 可中途按下 A 提早收拳，此时无法攻击到敌方，但是可以反弹一些东西。
    - 在 run_attack 的第三个 frame 中有 `hit_a: 89`，frame 89 中有 itr effect：4。

## 实用技巧

### 1. 使某一招式在 hp < 某一上限时才可使用

增加它的 mp 使用量，并且攒招时持续消耗 mp，使消耗的 mp > 500，并且在 hp < 某一上限时可回复得过来。

### 2. 使某一招式在某些关不能使用

在人质档（criminal.dat）里增加一个 frame，`pic: 999`，`state: 3005`。再在里面增加一个 itr，范围如下：

```text
X: 0   y: 特殊位置（自己设定）  w: 10000  h: 100
```

然后找到想要改的人物，在那一招式中加上 bdy：

```text
X: 0   y: 特殊位置  w: 10000  h: 100
```

最后打开关卡档（stage.dat），在需要使招式失效的关卡里放置那个人质。

### 3. 使招式减少敌人的 mp

在所有人的档中都加入一个 frame（比如 398），设定扣的 mp。然后做招：如果是近身的就在人的 frame 中加 `cpoint vaction: 398`（`caughtact: 398` 也行）；如果是远的就在气功波的 frame 中加入抓人招。

### 4. 加背景音乐

在人质档（criminal.dat）里增加一个 frame，`sound: xxx`（背景音乐），`pic: 999`，`state: 3005`。在下一个 frame 里设置 `wait: 0`，然后跳到刚才的 frame。另外，在关卡档（stage.dat）里横向每隔 700-800 个单位长度放置一个人质，目的是让你不论在哪里都能听到音乐。

### 5. 令 Firzen 冰盾具有 Freeze 或冷冻波效果

把 frame 110 改为 `wait: 0`，再新建一个与 110 完全相同的 frame（如 235，用复制粘贴再改编号），把这个 frame 改成 `wait: 11`。同时，在 id：209 加一个与 Firzen 的 frame 235 完全相同的 frame（如 50），其中 `pic: 999`，`state: 3005`，并让 Firzen 在 frame 235 在 center 位置发一个 opoint，`action: 50`，`oid: 209`。这样就可以了。

### 6. 在某关删除所有人质及分身

在人质档（criminal.dat）里增加 2 个 frame，内容如下：

```text
<frame> 90 ???
pic: 999 state: 3005 wait: 75 next: 91 dvx: 0 dvy: 0 dvz: 0 centerx: 0 centery: 0 hit_a: 0 hit_d: 0 hit_j: 0
itr:
kind: 0 x: -10000 y: -11000 w: 20000 h: 22000 dvx: 0 fall: 70 vrest: 300 bdefend: 100 injury: 10000 zwidth: 1000
effect: 6
itr_end:
<frame_end>

<frame> 91 ???
pic: 999 state: 3005 wait: 5 next: 1000 dvx: 0 dvy: 0 dvz: 0 centerx: 0 centery: 0 hit_a: 0 hit_d: 0 hit_j: 0
itr:
kind: 0 x: -10000 y: -11000 w: 20000 h: 22000 dvx: 0 fall: 70 vrest: 300 bdefend: 100 injury: -500 zwidth: 1000
effect: 6
itr_end:
<frame_end>
```

- `wait: 75` = 比死人质消失时间稍长
- `effect: 6` = 无火花、声音
- 范围：全场
- `injury: 10000` = 必死无疑
- `injury: -500` = 立即补满

> 另外，配合一些爆炸、声音等进行障眼，效果会比较好。

---

特此鸣谢：裂影 Felix，Tseyinhei，拖鞋，Jerry Hawk，58.30.54.*
