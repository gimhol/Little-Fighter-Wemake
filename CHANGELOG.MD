# Changelog

## [v0.1.56](https://lf.gim.ink/0.1.56)

by [**Gim**](https://gim.ink)

<!-- git-range: d94a6368..2087ecaf9 -->

### 新东西

- 出招表（主菜单入口）：全部角色的招式现场演示
  - 每个招式按真实输入自动出招、循环播放，并显示招式名、按键、说明与 MP 消耗
  - 演示会现场打出伤害 / 回血，角色头顶显示当前按键指示
  - 招式列表可滚动（滚轮 / 拖拽），鼠标悬停或点击即可切换到该招；切换时列表自动滚到对应行
  - Template 基础教学：行走、防御（破防）、闪避（落地翻滚）、普攻连击、跑攻、跳攻、抓投、受身等
  - 隐藏角色（Mark / Jack / Sorcerer / Monk / Jan / Knight / Bat / Justin / LouisEX / Firzen / Julian）需开启作弊码后可见
- 新背景「八角笼」：笼斗场馆（链网、顶灯、看台观众、带 Logo 的格斗垫）
- 新背景「足球场」：全景大球场
  - 带纹理的草地与割草条纹；完整球场白线：中线、中圈、禁区、球门区、罚球点、罚球弧、角球弧、球门网
  - 球场外围配看台、观众、广告牌与天空
  - 八角笼与足球场均加入普通随机背景轮换
- 桌面版支持自动加载模组：程序目录与用户数据目录下 `mods/` 里的数据包启动时自动加载（后加载的覆盖先加载的），`mods.json5` 可调整顺序 / 禁用，`--mods <目录>` 临时追加、`--no-mods` 全部关闭

### 调整

- 数据转换：改用遮罩方式去除源图上的网格分割线（此前部分素材可能残留分割线痕迹）
- 桌面版：安装包默认安装目录改为产品名「Little Fighter Wemake」
- 桌面版：推送版本标签后由 GitHub Actions 自动构建并发布安装包 / 免安装版
- 修复：背景缩放不为 1 时（足球场 0.5、八角笼 2），自动镜头与角色跟随在水平 / 垂直方向上的偏移（角色会偏离到画面外）
- 附加数据包中的地图现在排在内置地图之后（背景列表与轮换顺序）
- 开发面板「预览器」重做：背景 / 实体 / 图片三个标签页，画布可拖拽平移、滚轮缩放
- 生存榜：单人榜按角色、双人榜按两名角色的组合分别记录最高分
- 检查更新统一读 `latest.json`，附带提交号并避免缓存导致始终提示旧版本

### 感谢

- 感谢 酱油、布利.白 以及我叫不出名字的QQ群友的反馈、支持与鼓励
- 感谢更多尝试过 LFW 的各位

## [v0.1.55](https://lf.gim.ink/0.1.55)

by [**Gim**](https://gim.ink)

<!-- git-range: 61e6ae33..9bfa1ac3 -->

### 新东西

- B站弹幕互动游戏：观众发弹幕即可加入战局
  - 三种模式：各自为战、八队混战、合作闯关
  - 进入直播间 / 发弹幕即可入局（合作闯关先认领未认领的 Template 占位，其他模式场上未满时直接入场），再发角色关键词（如「拳王」「奶妈」）即可换成本命角色
  - 合作闯关的敌人数量按场上人数缩放；队列上限 50、场上上限 32，超过 5 分钟无互动会自动移出
  - 应援关键词（默认 加油 / 666 / 应援）可为自己回复 15% 生命（3 秒冷却），礼物 / 上舰 / 醒目留言同样算应援
  - 游戏内面板会轮播提示，「发角色名换人」的提示每次随机展示 3 个角色昵称
  - 积分榜：出场 / 击败 / 阵亡 / 伤害 / 应援按权重累计（可配置），存档不丢；内置榜单页可直接当 OBS 浏览器源（10 秒自动刷新）
- LFW 桌面客户端（B站互动玩法）
  - 无系统标题栏窗口；托盘菜单：开关联机服务器、允许局域网访问游戏页面、复制联机地址、打开数据工具、复制数据工具命令、打开数据目录、显示游戏窗口、退出
  - 内置联机服务器、数据工具与转换器（ffmpeg 与 ImageMagick 随包附带），不需要另装 Node；把 LF2 目录（或 conf）拖到 start.exe 上会自动开始转换
  - 联机服务器端口被占用时自动向后寻找空闲端口
  - 独立安装包与自动更新：启动时自动检查，新版本后台下载，重启后生效
  - 菜单与提示文案多语言（跟随游戏语言，也可自定义）；配置文件 danmu.json5，完整说明见包内 help.md
- 音量按钮（BGM / 音效）悬停时弹出竖直滑条，可直接拖动调音量（鼠标环境）
- 联机时新增设置按钮与设置面板：键位与输入设备、主音量 / BGM / 音效、语言、队伍描边、渲染帧率、统计显示，不打断游戏
- 生成点（opoint）支持表达式：生成位置（`gen_x` / `gen_y` / `gen_z`）、发射初速度（`gen_dvx` / `gen_dvy` / `gen_dvz`）、扩散（`gen_spread_x` / `gen_spread_y` / `gen_spread_z`）
  - 变量 `w` / `h` / `cx` / `cy`，函数 `rand` / `pick` / `bag`（摸牌，抽完前不重复）/ `flip` / `round`
  - 例：`rand(-w/6, w/6)`、`round(rand(round(w/4), round(3*w/4)))`

### 调整

- 燃烧状态的冒烟效果改用生成点表达式控制
- 游戏示范（Demo）的对战阵容与标题修正
- 数据包（zip）改为按需解压读取

### 感谢

- 感谢 酱油、布利.白 以及我叫不出名字的QQ群友的反馈、支持与鼓励
- 感谢更多尝试过 LFW 的各位

## [v0.1.54](https://lf.gim.ink/0.1.54)

by [**Gim**](https://gim.ink)

<!-- git-range: 6f011c5a..2190304b -->

### 新东西

- 武器/角色数据新增「站立攻击距离死区」与「站立攻击最大距离」
  - Bot 贴得太近时会先拉开距离，再站定攻击
  - 超出最大距离时，Bot 不会站定攻击
  - 各类武器已配好默认值，数据里可自行覆盖
- 帧数据新增 `blinking`（闪烁帧数）字段，XML、编辑器与运行时均已支持

### 调整

- Bot 后退时 Z 轴会维持一小段距离（不再贴着同一条线退）
- Bot 被逼到墙角时会先绕开墙角
- Bot 无法拉开距离时改为进攻，不再贴着边缘空跑

### 修复

- 修复 Buff 特效偶发残留、有时出现在画面原点 (0,0) 的问题

### 感谢

- 感谢 酱油、布利.白 以及我叫不出名字的QQ群友的反馈、支持与鼓励
- 感谢更多尝试过 LFW 的各位

## [v0.1.53](https://lf.gim.ink/0.1.53)

by [**Gim**](https://gim.ink)

<!-- git-range: 6f70d033..1a5edbac -->

### 新东西

- 红书、蓝书、绿书拾取后会获得对应增益
  - 红书「群攻」：攻击可同时命中多个目标（身边有光环特效）
  - 蓝书「回蓝」：持续回复 MP，回蓝期间状态栏 MP 条会闪烁提示
  - 绿书「电击」：攻击命中的敌人会被电击（僵直 + 雷电特效）
- 书放在地上未被拾取时，过一阵会自动消散

### 调整

- 红蓝绿书的增益持续时间 1800 → 1080
- 书本捆破碎时，红书、绿书向外散射的速度提高（1.5 → 2.5）
- 回蓝效果在 MP 满时不再提前结束
- Bot 不再拾取红蓝绿书；Bot 拾取武器前会先刹车
- 红书光环、绿书闪电的特效贴图更新

### 感谢

- 感谢 酱油、布利.白 以及我叫不出名字的QQ群友的反馈、支持与鼓励
- 感谢更多尝试过 LFW 的各位

## [v0.1.52](https://lf.gim.ink/0.1.52)

by [**Gim**](https://gim.ink)

<!-- git-range: d91f1e79..2e6715d7 -->

### 新东西

- 电击效果：被电击（如 Louis 的跑攻）命中的敌人身上会显示雷电特效，特效跟随角色，状态结束后自动消失

### 调整

- 角色「Template」的头像换成 4 倍分辨率贴图，高分屏下更清晰
- 新增《问题反馈指南》（中文 / 英文），并为《对于与LF2表现差异的看法》补充英文版

### 感谢

- 感谢 酱油、布利.白 以及我叫不出名字的QQ群友的反馈、支持与鼓励
- 感谢更多尝试过 LFW 的各位

## [v0.1.51](https://lf.gim.ink/0.1.51)

by [**Gim**](https://gim.ink)

<!-- git-range: d3d6cb08..09697a3f -->

### 新东西

- 网页版会检查是否有新版本（仅在 lf.gim.ink 生效），发现后右下角提示「新版本 vX 已发布」，可一键前往
- 浏览器扩展检测到新版本时，图标会显示「!」，游戏内提示「重启浏览器后生效」

### 调整

- 生存单人榜（非 B站环境）按「客户端+角色名」分行，同一客户端的多个角色各占一行
- 生存排行的阶段编号与游戏内一致（不再 +1）
- 设置里的帧率选项下新增说明：渲染帧率受设备性能与屏幕刷新率限制，可能达不到所选值
- 空中角色更易被击倒
- 命中停顿与受伤摇晃时长提高（6 → 8），球类武器的命中停顿大幅提高（2 → 8）
- 笛子（MagicFlute）相关 Buff 加强：伤害 1 → 2、持续 2 → 3
- 书本类武器大幅变脆：书本捆耐久 800 → 400、落地扣 HP 200 → 180，三本书耐久 750 → 200、落地扣 HP 48 → 20；书本捆的击打伤害 60 → 50，手持书本的角度也作了调整
- 武器不再命中被击飞（坠落）中的角色
- Julian D>A 的追踪手感：「越过目标一定距离才反向」的悬停距离改为按轴设置、加速度提高；球与 AI 寻找目标更频繁（各自计时，每 2 帧一次）
- 计分板名字显示简化：人类玩家显示玩家名，其他角色显示角色名
- 构建工具：相同输入保证输出一致；PNG 统一压缩，数据包更小
- 活动范围梳理：玩家与敌人各按自己一侧的边界；饮料类道具使用关卡数据中的「饮料范围」，普通武器与投射物不再受其限制

### 修复

- 投掷出去的武器命中目标即进入掉落状态，落地后的攻击判定不再生效
- 被笛子命中后能否受身，改为检测身上的 Buff（不再依赖碰撞记录，飞远后判定不会失效）
- 修复「抓取后变身」的招式变身后，被抓的角色没能正确脱离被抓状态的问题
- 修正启动界面上 “Little Fighter 2” 的拼写（原为 “Litter Fighter 2”）
- 修复角色影子偶尔变成白色方块的问题（贴图不可用时先隐藏，可用后自动恢复）
- 修复超级重拳的条件：命中 1 次即可生效（此前要求多于 1 次）

### 感谢

- 感谢 酱油、布利.白 以及我叫不出名字的QQ群友的反馈、支持与鼓励
- 感谢更多尝试过 LFW 的各位

## [v0.1.49](https://lf.gim.ink/0.1.49)

by [**Gim**](https://gim.ink)

"榜上有名！"

### 新东西

- 新增生存排行模式
- 新增双人生存排行
- 数据包支持断点续传
- 背景支持前景层

### 调整

- 重做 UPS 控制，更接近设定也更稳定；UPS 只保留 30 / 60；设置页新增“性能数据”开关
- 联机新增“同步模式：自动 / 锁帧 / 延迟”（按房间最差延迟给出推荐），玩家名实时同步
- Julian D>A 削弱；Firzen AI强化；书本类武器不再出现在 VS 模式与随机武器池
- 被击落的武器不会再在下落途中打到人；滚动经过武器需要按住攻击键才会拾取
- 武器掉落更分散
- 新增罗马尼亚语、匈牙利语，新增文案合计已补上 12 种语言（未校验）：德语 / 西班牙语 / 法语 / 匈牙利语 / 意大利语 / 日语 / 韩语 / 荷兰语 / 波兰语 / 葡萄牙语 / 罗马尼亚语 / 俄语
- Tab 键不再触发浏览器默认的焦点切换，可正常用作游戏按键
- 其他调整与性能优化

### 修复

- 修复数据包被替换后客户端仍用旧缓存的问题
- 修复联机时键位名显示错位

## [v0.1.47](https://lf.gim.ink/0.1.47)

by [**Gim**](https://gim.ink)

"解压缩！"

### 新东西

- 现在可以切换语言 (未校对)
  ![switch_lang_w400.gif](docs/image/switch_lang_w400.gif)
- 新武器：书本捆 + 书x3（第一个 3D 模型重型武器，轻投掷 3D 模型武器）
- ![unzip_w400.gif](docs/image/unzip_w400.gif)

### 武器 / 手感

- 旋风甩出去的轻武器会算成旋风那方的，不会误伤自己人
- 投掷型武器不再因旋风造成超快的连续命中
- 重型武器砸中人时，被砸的人飞出去的速度方向将根据双方位置决定
- 只能捡到地面上的武器

### 修复

- 修了闯关模式里队伍存活判断不准的问题
- 闯关模式百叶窗动画改纯黑

## [v0.1.46](https://lf.gim.ink/0.1.46)

by [**Gim**](https://gim.ink)

### 新特性

- 新武器：篮球 (“多精灵图叠加”、“精灵图旋转”的实验品)
![davis & basketball 'playing'](docs/image/bskb_davis.gif)

- 新地图：像素尺（“用于测试一些东西”）
![test case in the Pixel Ruler](docs/image/px_rl.gif)

### 杂项

- 调整 Rudolf 来回变身逻辑，与LF2大概一致
- 调整 Louis D^J+J..J 逻辑，与LF2大概一致
- 调整 Freeze D>J 能被正确的打破了
- 调整回旋镖表现, 与LF2大概接近
- 调整护甲逻辑，现在Julian/Knight更像原版（也更弱了）
- 调整版本名生成，现在可以看见版本对应的 git 提交 ID
- 调整了 UI 文字的显示
- 调整相机在切换更短的地图时的表现
- 调整 Bot 回中位置(随机化)
- 调整武器触地反弹的表现
- 调整其他，不知有无更多问题
- 修复背景音乐结束随机下首导致的联机失败问题
- 修复贴着地图上边缘时，影子挡住实体的问题
- 修复持有的武器无法救人质的问题
- 修复持有的武器无法反弹 ball 的问题

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
- 微调“丢人”位置计算，让一些角色不再被自己丢出的敌人砸到
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
    - 感谢 [Dan](https://github.com/Glooring) 提供的数据
    - [Dan](https://github.com/Glooring)目前正在开发**LF2 Unified**，
    - **LF2 Unified**能更完美的还原原版游戏体验，敬请期待

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
- fix: no longer converts certain data
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
