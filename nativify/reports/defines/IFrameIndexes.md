# defines/IFrameIndexes.ts

> 源文件: `src/LFW/defines/IFrameIndexes.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 73 |
| 大小 | 1313 bytes |
| import 数 | 1 |
| export 数 | 2 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- interface 定义
- function 声明

## C++ 移植要点

- `src/LFW/defines/IFrameIndexes.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
