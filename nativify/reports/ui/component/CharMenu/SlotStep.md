# ui/component/CharMenu/SlotStep.ts

> 源文件: `src/LFW/ui/component/CharMenu/SlotStep.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 7 |
| 大小 | 77 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 枚举定义 |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- enum 定义

## C++ 移植要点

- `src/LFW/ui/component/CharMenu/SlotStep.ts` 为 TS enum，运行时生成双向映射对象（在 C++ 中无此概念）。
- C++ 侧建议用 `enum class` + 显式整型值，若需 name↔value 映射则额外提供查找表。
