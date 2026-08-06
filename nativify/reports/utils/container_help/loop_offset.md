# utils/container_help/loop_offset.ts

> 源文件: `src/LFW/utils/container_help/loop_offset.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 10 |
| 大小 | 314 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- function 声明
- 数组高阶方法
- 动态属性访问 obj[key]
- 可空联合类型

## C++ 移植要点

- `src/LFW/utils/container_help/loop_offset.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 可空联合类型建议用 `std::optional` / 指针表达。
