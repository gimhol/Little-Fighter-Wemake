# v0.1.26

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
