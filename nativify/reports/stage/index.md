# stage/index.ts

> 源文件: `src/LFW/stage/index.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 7 |
| 大小 | 200 bytes |
| import 数 | 0 |
| export 数 | 5 |
| 分类 | 纯类型声明 (interface/type) |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- （无特殊动态特征）

## C++ 移植要点

- `src/LFW/stage/index.ts` 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。
- C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。
