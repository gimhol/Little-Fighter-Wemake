# base/Debugging.ts

> 源文件: `src/LFW/base/Debugging.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 34 |
| 大小 | 1053 bytes |
| import 数 | 1 |
| export 数 | 2 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- `any` 类型使用 6 处
- interface 定义
- function 声明
- 箭头函数/回调
- 动态属性访问 obj[key]
- 模板字符串
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/base/Debugging.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 6 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 展开运算符需展开为循环或可变参数模板。
