# utils/type_check/is_arr.ts

> 源文件: `src/LFW/utils/type_check/is_arr.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 4 |
| 大小 | 84 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- `any` 类型使用 2 处
- function 声明
- 泛型默认 any

## C++ 移植要点

- `src/LFW/utils/type_check/is_arr.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 2 处 `any`，需逐一推断真实类型或引入 variant/泛型。
