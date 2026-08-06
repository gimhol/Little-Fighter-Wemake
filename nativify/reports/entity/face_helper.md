# entity/face_helper.ts

> 源文件: `src/LFW/entity/face_helper.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 13 |
| 大小 | 421 bytes |
| import 数 | 2 |
| export 数 | 4 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- function 声明
- 可空联合类型

## C++ 移植要点

- `src/LFW/entity/face_helper.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 可空联合类型建议用 `std::optional` / 指针表达。
