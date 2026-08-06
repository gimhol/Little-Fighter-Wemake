# dat_translator/CondMaker.ts

> 源文件: `src/LFW/dat_translator/CondMaker.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 92 |
| 大小 | 2865 bytes |
| import 数 | 2 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2.5 / 5 —— 较易** |

## 检测到的语言特征

- `any` 类型使用 8 处
- class 定义
- function 声明
- 箭头函数/回调
- static 成员
- 正则/字符串匹配
- 数组高阶方法
- 可选链 ?.
- 模板字符串
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/dat_translator/CondMaker.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 8 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
- 展开运算符需展开为循环或可变参数模板。
