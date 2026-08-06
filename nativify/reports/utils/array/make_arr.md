# utils/array/make_arr.ts

> 源文件: `src/LFW/utils/array/make_arr.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 6 |
| 大小 | 160 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- function 声明
- 箭头函数/回调
- 数组高阶方法

## C++ 移植要点

- `src/LFW/utils/array/make_arr.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
