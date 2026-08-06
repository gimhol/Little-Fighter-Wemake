# defines/ISchema.ts

> 源文件: `src/LFW/defines/ISchema.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 44 |
| 大小 | 1070 bytes |
| import 数 | 0 |
| export 数 | 5 |
| 分类 | 纯类型声明 (interface/type) |
| **移植难度** | **★☆☆☆☆ 1 / 5 —— 微不足道** |

## 检测到的语言特征

- `any` 类型使用 5 处
- `unknown` 使用 1 处
- interface 定义
- type 别名
- 展开运算符 ...
- 泛型默认 any

## C++ 移植要点

- `src/LFW/defines/ISchema.ts` 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。
- C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。
- 存在 5 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 展开运算符需展开为循环或可变参数模板。
