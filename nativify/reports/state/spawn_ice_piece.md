# state/spawn_ice_piece.ts

> 源文件: `src/LFW/state/spawn_ice_piece.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 77 |
| 大小 | 2160 bytes |
| import 数 | 4 |
| export 数 | 2 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- `unknown` 使用 4 处
- type 别名
- function 声明
- 箭头函数/回调
- 可空联合类型

## C++ 移植要点

- `src/LFW/state/spawn_ice_piece.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 可空联合类型建议用 `std::optional` / 指针表达。
