# utils/utf8.ts

> 源文件: `src/LFW/utils/utf8.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 81 |
| 大小 | 2730 bytes |
| import 数 | 0 |
| export 数 | 2 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- function 声明
- 数组高阶方法
- 二进制/字节数组

## C++ 移植要点

- `src/LFW/utils/utf8.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 二进制/字节处理需映射到 `std::vector<uint8_t>` 等原生类型。
