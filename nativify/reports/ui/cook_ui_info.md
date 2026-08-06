# ui/cook_ui_info.ts

> 源文件: `src/LFW/ui/cook_ui_info.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 317 |
| 大小 | 11079 bytes |
| import 数 | 18 |
| export 数 | 3 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★★☆☆ 3.5 / 5 —— 中等偏难** |

## 检测到的语言特征

- function 声明
- 箭头函数/回调
- 正则/字符串匹配
- Object.* 反射方法
- 数组高阶方法
- 回调注册/事件
- 可选链 ?.
- 空值合并 ??
- 动态属性访问 obj[key]
- async/await/Promise
- 模板字符串
- 展开运算符 ...
- 异常处理
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/cook_ui_info.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- async/await 异步逻辑需重构为回调、协程或状态机。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
- Object.* 反射方法需替换为显式代码或序列化框架。
