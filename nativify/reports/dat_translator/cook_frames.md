# dat_translator/cook_frames.ts

> 源文件: `src/LFW/dat_translator/cook_frames.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 212 |
| 大小 | 7200 bytes |
| import 数 | 23 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- `any` 类型使用 5 处
- type 别名
- function 声明
- 正则/字符串匹配
- 可选链 ?.
- 空值合并 ??
- 动态属性访问 obj[key]
- 模板字符串
- 展开运算符 ...
- 可空联合类型
- 非空断言 !

## C++ 移植要点

- `src/LFW/dat_translator/cook_frames.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 5 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
