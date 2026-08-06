# IWorldCallbacks.ts

> 源文件: `src/LFW/IWorldCallbacks.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 57 |
| 大小 | 1358 bytes |
| import 数 | 4 |
| export 数 | 1 |
| 分类 | 纯类型声明 (interface/type) |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- interface 定义
- 动态属性访问 obj[key]

## C++ 移植要点

- `src/LFW/IWorldCallbacks.ts` 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。
- C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
