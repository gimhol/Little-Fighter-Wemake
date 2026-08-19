# v0.1.27

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

