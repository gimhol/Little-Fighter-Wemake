# utils/type_check/instance_of.ts

> 源文件: `src/LFW/utils/type_check/instance_of.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 5 |
| 大小 | 189 bytes |
| import 数 | 0 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- `any` 类型使用 2 处
- type 别名
- function 声明
- 箭头函数/回调
- instanceof 类型判断
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/utils/type_check/instance_of.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 2 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- instanceof 运行时类型判断需改用 typeid / 虚函数 / 判别联合。
- 展开运算符需展开为循环或可变参数模板。
