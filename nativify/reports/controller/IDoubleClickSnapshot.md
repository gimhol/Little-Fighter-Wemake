# controller/IDoubleClickSnapshot.ts

> 源文件: `src/LFW/controller/IDoubleClickSnapshot.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 8 |
| 大小 | 159 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 纯类型声明 (interface/type) |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- interface 定义
- 可空联合类型

## C++ 移植要点

- `src/LFW/controller/IDoubleClickSnapshot.ts` 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。
- C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。
- 可空联合类型建议用 `std::optional` / 指针表达。
