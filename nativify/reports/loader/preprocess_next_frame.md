# loader/preprocess_next_frame.ts

> 源文件: `src/LFW/loader/preprocess_next_frame.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 20 |
| 大小 | 740 bytes |
| import 数 | 3 |
| export 数 | 4 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- function 声明
- 箭头函数/回调
- 数组高阶方法
- 回调注册/事件

## C++ 移植要点

- `src/LFW/loader/preprocess_next_frame.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
