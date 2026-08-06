# collision/handle_ball_frozen.ts

> 源文件: `src/LFW/collision/handle_ball_frozen.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 62 |
| 大小 | 1986 bytes |
| import 数 | 3 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- type 别名
- function 声明
- 箭头函数/回调
- 数组高阶方法
- 回调注册/事件
- 可选链 ?.

## C++ 移植要点

- `src/LFW/collision/handle_ball_frozen.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
