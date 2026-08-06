# ui/IUIInfo.dat.ts

> 源文件: `src/LFW/ui/IUIInfo.dat.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 80 |
| 大小 | 2110 bytes |
| import 数 | 5 |
| export 数 | 7 |
| 分类 | 纯类型声明 (interface/type) |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- `any` 类型使用 3 处
- interface 定义
- type 别名
- 动态属性访问 obj[key]
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/IUIInfo.dat.ts` 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。
- C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。
- 存在 3 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 可空联合类型建议用 `std::optional` / 指针表达。
