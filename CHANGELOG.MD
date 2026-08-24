# Changelog

## [v0.1.46](https://lf.gim.ink/0.1.46)

by [**Gim**](https://gim.ink)

### 新特性

- 新武器：篮球 (“多精灵图叠加”、“精灵图旋转”的实验品)
- 新地图：像素尺（“用于测试一些东西”）

### 杂项

- Rudolf 来回变身逻辑现在应该与LF2一致
- Louis D^J+J..J 逻辑现在应该与LF2一致
- Freeze D>J 能被正确的打破了
- 回旋镖的表现现在更接近LF2了
- 护甲逻辑调整，现在Julian/Knight更像原版（也更弱了）
- 调整版本名生成，现在可以看见版本对应的 git 提交 ID
- 修复贴着地图上边缘时，影子挡住实体的问题
- 调整了UI文字的显示
- 调整相机在切换更短的地图时的表现
- 修复持有的武器无法救人质的问题
- 修复持有的武器无法反弹 ball 的问题
- 随机化Bot回中位置
- 调整武器触地反弹的表现
- 其他很多调整，不知有无更多问题

## [v0.1.45](https://lf.gim.ink/0.1.45)

by [**Gim**](https://gim.ink)  2026-07-18 08:11:51

Nekketsu!

### 新特性

- 现在可支持地形!
- 新增来自某平行世界的地图 Nekketsu F01

![image.png](https://lfwm.gim.ink/user/2/825/2d5932aa982e7d36e5fc21c77ca0b9c2 "image.png")
[Youtube 视频](https://www.youtube.com/watch?v=mM2UD2EEK5A)
[Bilibili 视频](https://www.bilibili.com/video/BV1BDTX6eEtq/)

### 杂项

- 修复v0.1.41~v0.1.44发现的问题
- 调整了非常多东西，不知有无BUG
- 优化了图片类资源的加载方式

## [v0.1.42](https://lf.gim.ink/0.1.42)

by [**Gim**](https://gim.ink)  2026-06-17 18:21:58

### 新特性

- Louis(Ex)的跑攻/冲跳攻将造成电击麻痹效果

![ltp1.webp](https://lfwm.gim.ink/user/2/797/bb0d676ae2726a32f52f670243f0fec1 "ltp1.webp")

### 杂项

- 修复了 v0.1.35 ~ v0.1.41 中发现的问题
- 微调“丢人”位置计算，让一些角色不再被自己丢出的敌人砸到。
- 修复“自定游戏”包无法下载的问题
- “自定游戏”的页面现在可以返回游戏
- 降低占用内存以及降低GC频率
- 稍微调整主页的待机自动游戏逻辑
- 修复结束语页无反应的问题
- 改进文本渲染效率

## v0.1.34

by [**Gim**](https://gim.ink)  2026-06-10 13:01:41

### 新特性

- Bat的蝙蝠命中后将能吸血

![bat_new_duj.webp](https://lfwm.gim.ink/user/2/754/9300b5c285d074e10b7099bb1c1dda36 "bat_new_duj.webp")

- 更高的FPS现在将看起来更流畅

    新增支持固定60FPS/120FPS

![Screenshot 2026-05-18 171130.png](https://lfwm.gim.ink/user/2/754/877c89b7d2f371c583d287e00114791a "Screenshot 2026-05-18 171130.png")

### 角色

- Rudolf
  - 修复变身的相关问题

### 杂项

- 调整了武器的表现 (回旋镖目前还不行)
- 修复一大堆下问题

## v0.1.27

by [**Gim**](https://gim.ink)  2026-05-31 22:38:34

“Bot Age 1”

### 新特性

- 新增指令Follow(DJJJ)

![bot_resp_follow.webp](https://lfwm.gim.ink/user/2/725/376d401aa631a0ec3d029184995ddf75 "bot_resp_follow.webp")

- 原版地图"Lee on Road"回归
    - 感谢 [Dan](https://github.com/Glooring) 提供的数据。
    - [Dan](https://github.com/Glooring)目前正在开发**LF2 Unified**，
    - **LF2 Unified**能更完美的还原原版游戏体验，敬请期待。

![lorbg.webp](https://lfwm.gim.ink/user/2/725/cf6f1c2a82a2347375063c522cf69397 "lorbg.webp")

### Bots

- [x] 队友Bot将能自动正确的远离闯关地图边缘
- [x] 队友Bot奔跑时将能通过“滚动/刹车后”拾取物品
- [x] 闯关时，当全部人类玩家HP0时，队友Bot将会解救人质
- [x] Bot的持械近战将变得更聪明
- [x] Bot将更高概率的丢出持有的小型武器
- [x] Bot近战时将不再会随机起跳
- [x] Bot将不会远离无起身无敌的倒地角色

### Fighters

- Common
    - [x] 提高出招概率
    - [x] 一些攻击将不再因为尝试防御“可反弹的Ball”或“可击破的Ball”或投掷武器而停下来
        - Example: Firen D>J | Dennis D>J | LouisEX Running
    - [x] 普攻需要MP时且MP<=0时，将仍能进行普攻
        - Example: Henry | Rudolf | Hunter
- Woody
    - [x] 将更低概率的使用瞬移
    - [x] 瞬移后将更高概率的使用(D>J)
-  Firen
    - [x] 烈火焚身(D>J)将不再能反弹Ball
- Roudolf
    - [x] 更高概率的分身(DvJ)
    - [x] 更高概率的隐身(D^J)
~~- Louis
    - [ ] DJA的爆甲时，盔甲不再会被自己气功击中~~
    
### Weapons

- Common
    - [x] 角色击中重武器将会使重武器的队伍变化
~~- 新武器: 
    - [ ] 篮球：用于展示新属性“弹性” ~~

~~### Backgrounds

- [ ] 新地图: 八角笼
    - 用于展示bg.zoom = 2~~
    
### Misc

- [x] 可能改进了碰撞检测效率
- [x] 场地实体超过355时，如下实体将不会被创建
    - Firzen D^A的尾巴、Jan D^A的尾巴、Jan D^J的尾巴、武器碎片、冰块碎片、火焰粒子
~~- [ ] 修复30UPS下的一些问题
    - 瓶子与棒球停不下来……~~

## v0.1.26

by [**Gim**](https://gim.ink)  2026-05-31 22:38:43

### 新特性

- Rudolf D<>A 将能直接使用他的“Super Punch”
  - 用于展示LFW与LF2的差异
  - LFW可以支持更长序列的搓招
    ![jkhgfd.gif](https://lfwm.gim.ink/user/2/687/3b726f48c299348391dccdb112ecb217 "jkhgfd.gif")

### 数值与逻辑

- 护甲相关
  - 修复对象的当前刻的护甲值<=0时，护甲仍有效的问题

        这问题导致了Julian和Knight护甲太硬

  - 修复箭在破甲命中时，仍被反弹而不是消失的问题

- 修复opint.spreading=OpointSpreading.FloatRange相关问题

    这问题导致Julian D>A的ball只能拥有向下的初速

- 修复opoint创造的物体会立刻离开第0帧的问题

    这问题导致有些Ball变弱了（如Henry/Monk/Louis/LouisEx D>A）

    这问题导致一些Ball行为与预期不一致

- 修复能瞬移到0HP的对象附近的问题(Woody D^J/DvJ)
- 当frame不存在itr时，立刻重置arest
  - 似乎LF2就是这样做的

### 操作性

- 修改按键判定的优先级，新顺序："D,<,>,^,v,J,A"

    原顺序为 "<,>,^,v,A,J,D", 这导致同时角色站立时，同时按下JA，无法跳越并攻击，而是普攻（跑跳攻同理）

- 修改双击起跑的逻辑

    不再能奔跑刹车后，再按一次就跑起来(这手感太奇怪了)

- 调整itr.dvy的计算, 让一些连招成立

- 除了倒地或击飞，其他受伤动作不再清除按键状态队列

### 其他

- 为Team5~Team8添加颜色
- 游戏示范调整
  - 会随机到Bot玩闯关模式
  - 会在结束后再次开始游戏示范
- 背景支持zoom属性
- 完全重写Bot逃避逻辑
- 修复入口菜单无法进入设置页的问题
- 允许在30UPS/90UPS/120UPS运行游戏

    ***但游戏的一些运算在不同UPS下会有差异***

- 联机游戏将在30UPS下进行
- 移动设备默认在30UPS下进行
- ~~尝试“渲染插值”（低UPS下，提高FPS保持流畅感~~

## v0.1.25

by [**Gim**](https://gim.ink)  2026-08-14 11:03:56

- 倒下后，按'攻/防'提前或延后起身
![padfssu.gif](https://lfwm.gim.ink/user/2/669/38aa82e326d62dd9607fda24a95b9861 "padfssu.gif")
- 设置页中提供更多设置选项
![Screenshot 2026-04-21 033948.png](https://lfwm.gim.ink/user/2/669/c03e3776bf0710ddb87302c7ac9145a9 "Screenshot 2026-04-21 033948.png")
- 默认降低移动设备下的渲染频率
- 修复需要切换窗口后才有声音的问题
- 可能优化了文字渲染性能
- 改进BOT行为
- 技能回血时，血条将会闪烁
- 修复Freeze(D>A)冰冻波能同化John(D>J)护盾的问题

## v0.1.24

by [**Gim**](https://gim.ink)  2026-04-24 17:04:01

“Bot Age 0”

- 调整Bot防御逻辑（不再总是防御了）
- 提高Bot出招概率
- 调整远程角色的行为（henry/rudolf/hunter）
- 被救Bot队友不再跟随至下个大关
- 修复被火烧/被冻结的角色未掉落其重武器的问题
- 修复Ball扩散逻辑（Firzen/Jan/Bat）
- F8将掉落全部可掉落武器（允许的话）

## v0.1.22

by [**Gim**](https://gim.ink)  2026-04-14 17:30:46

"Dead Men Tell No Tales"

- 玩家角色HP归0后，将无法发出STAY/MOVE/Come指令
- 现在将更容易发出指令：STAY(DDDD)、MOVE(DADA)，Come(DJDJ)
- 修复队友Bot无法响应Come指令的问题（且将会更贴近目标位置）
- 进入下一关时，将清除场景上的无关物品
- 修复队伍描边失效的问题
- 修复Ball命中时停顿时长不太对的问题
- 闯关模式中，敌人不再起身无敌
- 闯关模式中，不再默认显示敌人的浮动状态栏
- 调整了Bot的行动逻辑
- 调整了MP回复速度
- 加了些测试用例

## v0.1.21

by [**Gim**](https://gim.ink)  2026-04-11 00:50:55

- 对战模式下，初始蓝量为40%
- 修复 wpoint.kind 3 (Freeze DvJ)
- 修复 Henry D^J 的伤害（太高了）
- 修复 itr.kind 15,16 (Freeze D^J)
- 空瓶掉落将附带随机初速
- 进入游戏前的菜单，将默认聚焦“更新随机”
- 修复选角的一些逻辑
- 更多测试用例
![ebdrv.gif](https://lfwm.gim.ink/user/2/596/6eb9586b8710c1666661babb518d77aa "ebdrv.gif")
![hupgzv.gif](https://lfwm.gim.ink/user/2/596/65945a40218279bb1df17787e1f67b95 "hupgzv.gif")

## v0.1.20

by [**Gim**](https://gim.ink)  2026-05-31 22:39:00

漫无目的，走得更远

- 新增“测试用例”页

![image.png](https://lfwm.gim.ink/user/2/526/9749944b3c34185d210009172535cd20 "image.png")
- 新背景: Moon
- 允许背景覆盖世界参数（如：重力）

![bg_override_gravity.gif](https://lfwm.gim.ink/user/2/526/b2e4632972bcbde3340a0727446647bc "bg_override_gravity.gif")
- 页面隐藏时将禁音
- 移除图片素材中的分割线
- 音量不再因叠加而爆发
- Firen groud-fire/explosion fixed
- 修复武器丢出时的收到的重力
- 修复“闯关模式/对决模式/游戏示例”的结算窗
- Add field "ball_itr_motionless" to dataset
- Weapon State 3006(for Felix Jump Attack from RN)
- Change Logic of State 100 (for Aquila from RN)
- Fix Bot data preprocess logic
- Force set frames 220-225 to state 11 (for RN)
- Force set frames 226-229 to state 16 (for RN)
- Force set gone object hp to 0 (for RN)

## v0.1.19

by [**Gim**](https://gim.ink)  2026-05-31 22:39:12

一些新尝试

- 跳跃高度将受按键时长影响

![normal_jump_small_Jump.gif](https://lfwm.gim.ink/user/2/512/9e912642f3c7b772d5a64e2f22163ea8 "normal_jump_small_Jump.gif")

- 招式修复
    - Firzen D^A 
    - Jan D^A 
    - Jan D^J
- 闯关模式
    - 修复无法进入下一关的问题
    - 修复首波敌人数量没有根据玩家数来的问题
- 其他
    - 修改角色受击帧跳转逻辑
    - 修复Bot不太能出招的问题
    - 尝试修复浏览器奔溃的问题

## v0.1.18

by [**Gim**](https://gim.ink)  2026-04-01 02:12:20

***越优化越多BUG***

- fix: allow set touchscreen player in ctrl settings
![Screenshot 2026-03-12 225759.png](https://lfwm.gim.ink/user/2/499/2ae82287d8e3574d8ff00aacb744125d "Screenshot 2026-03-12 225759.png")

- fix: display fn keys counts
![fn_key_counts.gif](https://lfwm.gim.ink/user/2/499/937839997343f20094b463b561a81f03 "fn_key_counts.gif")

- fix: more variables in world-dataset
- fix: no longer converts certain data.
- fix: dash/jump/breakfall vy caculation
- fix: julian/kngiht armor, henry d^j, john d^a
- fix: touchpad ^^vv<><>dada
- fix: zwidth of itr & bdy
- fix: bgm-swithcer in vs-mode
- fix: minor adjustment about ball be hit

## v0.1.17

by [**Gim**](https://gim.ink)  2026-04-01 02:12:25

优化触摸屏操控体验，以及其他微调

![aaa.gif](https://lfwm.gim.ink/user/2/487/3768e3eb9731d41dd714144bd4d68539 "aaa.gif")
![bbb.gif](https://lfwm.gim.ink/user/2/487/155928adc4be6a436ba5a59405129fd9 "bbb.gif")

- fix: fall-in-air when fall_value <= dizzy_value
- fix: obj now stays at spawn point for a short while
- fix: vx calculation
- fix: gravity = 0.4375
- fix: weapon_throwing_gravity = 0.21875
- fix: throw_victim_vy_factor = 1.15
  - it is for the "henry throw + d>a"
  - uncertain it will cause other problems

## v0.1.16

by [**Gim**](https://gim.ink)  2026-04-01 02:12:32

速度计算仍有区别，且放它一马

- fix: change dvx calc method
- fix: vy = 0 when hit(not fall)
- fix: weapon drop will no longer 'follow_bearer' 
- fix: will enter next frame immediately when wait = 0
- fix: about ball.hit_Fa=3
- fix: ball.frame.landable = 0(allow ball fly to underground)
- fix: opoint & dvz 550
- fix: same id bg will be replace(allow mod to overwrite original data)
- fix: same id data will be replace(allow mod to overwrite original data)
- fix: when frame.state == 1001, it no longer ignore itr.kind != 5
- fix: allow load MersenneTwister
- fix: more FacingFlag (SameAsBearer, OpposingBearer)
- fix: more speed ctrl mode
- chore: fix FFMPEG_CMD
- fix: julian ball bug
- fix: gamepad bug

## v0.1.15

by [**Gim**](https://gim.ink)  2026-04-18 13:47:53

- fix: 修复按键跳转未消耗hp/mp的问题
- fix(dev): invisible_blinking
- fix(dev): arest_after_motionless/vrest_after_shaking
- fix: arest/vrest messing
- fix: wrong expression about back-dash
- fix: weapon_throwing_gravity
- fix: jump_x_f/jump_z_f/jump_h_f/dash_x_f/dash_z_f/dash_h_f
- fix: state 9998 will not itr
- fix: louis dja
- fix: firen+freeze
- fix: outline effect
- fix: itr effect 20 & Weapon
- fix: some object remove team outline
- fix: fragment_shader
- fix: drop_catching
- fix: caught falling

## v0.1.14

by [**Gim**](https://gim.ink)  2026-04-01 02:12:42

- fix(game): firzen的d^a无敌人时，不再分裂
- fix(tool): 支持负数mp消耗 
- fix(game): 修复stat显示异常问题
- fix(game): 修复敌人归降后，未移除攻击目标以及队伍描边颜色无变化的问题
- fix(game): 修复武器跟随延迟了一帧的bug
- fix(game): 修复丢人时，被丢者位置不对的问题
- fix(game): 受伤害时，护甲值归0
- fix(game): 重构了跟踪的实现，调整其效果
- fix(game): 修复 ball 2倍Z轴速度的问题
- fix(game/tool): ball不再默认与地面碰撞
- fix(game/tool): itr支持on_hit_ground (firzen/jan的ball原仅以centery来判断是否落地)
- fix(dev): 支持导出世界微调的数据
- fix(game): 修复防御值太高的问题（4下才破防）

- 感谢 酱油 与 Memento 的反馈

## v0.1.13

by [**Gim**](https://gim.ink)  2026-04-01 02:12:47

- feat(prel): '对战模式准备页'的左下角将能通过点击鼠标/左/中/右键切换背景音乐
- fix(game): 修复了无法切换难度的问题
- fix(game): 修复了两人同时捡一个武器时的表现
- fix(game): 修复了两人同时抓一个人时的表现
- fix(game): 支持多数据包下，背景音乐同名覆盖
- fix(game): 被抓者和被持有的武器，其 wait 不再减少
- fix(game): 将允许被抓者的 cpoint 或其坐标丢失，其表现对齐原版
- fix(game): 修复主页中战斗音效声道效果不正确的问题（将会更小声）
- fix(game): 离开主页后，将能正确清除场景中的对象
- fix(game): 将允许wpoint或其坐标丢失，其表现对齐原版（参考 Henry 持武器冲跳向后射箭）
- fix(data): 啤酒不再视为'关卡武器'（闯关不再随机掉啤酒）
- fix(data): 调整了LouisEX与Knight攻击触发范围
- fix(tool): [100,199]外的武器不再视为“闯关/对战武器”（闯关/对战不再掉落他们）

## v0.1.12

by [**Gim**](https://gim.ink)  2026-04-01 02:12:52

- fix: 修复MP恢复速度. (之前太快了)
- fix: 移除了主页上暂时还没支持其功能的按钮
- feat: 一些页面支持看版本号与额外数据文件名
- feat: 支持加载额外数据
- chore: 主页将会存在两个正在打交的小朋友:D

## v0.1.9

by [**Gim**](https://gim.ink)  2026-04-01 02:12:57

- fix: 被攻击者将正确的掉落其持有的重型武器
- fix: 调整棒球类武器击中与被击中的表现
- fix: 回旋镖现在能跟踪敌人了
- feat: 房间列表可以看见自己延迟
- feat: 房间中可以看见房间成员的延迟
- fix: 修复bot不出招以及太会防御的问题
- feat: 支持自定义游戏

## v0.1.5

by [**Gim**](https://gim.ink)  2026-04-01 02:13:01

- feat: 添加“队伍描边”效果
- fix: 修复背景与关卡按钮无法响应的问题
- fix: 修复分数版显示不正确的问题
- fix: 武器将具备更合理的效果
- fix: 改进了武器落地反弹的表现
- fix: 修复了武器投掷出发点不正确的问题
- fix: 修复空中武器无法被在此打中的问题
- feat: 房间现在可以设置密码
- fix: 无法再加入已经开始获全员已准备的房间
- fix: 生存模式将正确显示当前阶段数
- fix: 生存模式将不会显示"GO->"
- fix: 闯关模式的最后一小关将不会显示"GO->"
- fix: 修复闯关/生存模式，难度与敌人数量关系错误的问题（问题是敌人变多了）

### v0.1.4

2026-01-17

- fix: 修复背景与关卡按钮无法响应的问题
- fix: 修复分数版显示不正确的问题

### v0.1.3

2026-01-15

- fix: 武器将具备更合理的效果
- fix: 改进了武器落地反弹的表现
- fix: 修复了武器投掷出发点不正确的问题
- fix: 修复空中武器无法被在此打中的问题
- feat: 房间现在可以设置密码
- fix: 无法再加入已经开始获全员已准备的房间
- fix: 生存模式将正确显示当前阶段数
- fix: 生存模式将不会显示"GO->"
- fix: 闯关模式的最后一小关将不会显示"GO->"
- fix: 修复闯关/生存模式，难度与敌人数量关系错误的问题（问题是敌人变多了）

### v0.1.2

2026-01-15
