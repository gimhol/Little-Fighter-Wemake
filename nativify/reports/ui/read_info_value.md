# ui/read_info_value.ts

> 源文件: `src/LFW/ui/read_info_value.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 103 |
| 大小 | 3968 bytes |
| import 数 | 2 |
| export 数 | 14 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★☆☆☆ 2.5 / 5 —— 较易** |

## 检测到的语言特征

- `any` 类型使用 12 处
- `unknown` 使用 12 处
- interface 定义
- type 别名
- function 声明
- 箭头函数/回调
- 可选链 ?.
- instanceof 类型判断
- 动态属性访问 obj[key]
- 模板字符串
- 展开运算符 ...
- 异常处理
- switch 分支
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/read_info_value.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 12 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- instanceof 运行时类型判断需改用 typeid / 虚函数 / 判别联合。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
