# base/Expression.ts

> 源文件: `src/LFW/base/Expression.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 182 |
| 大小 | 5920 bytes |
| import 数 | 3 |
| export 数 | 3 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★★☆ 4 / 5 —— 困难** |

## 检测到的语言特征

- `any` 类型使用 16 处
- `unknown` 使用 2 处
- class 定义
- type 别名
- function 声明
- 箭头函数/回调
- static 成员
- JSON 序列化
- 正则/字符串匹配
- 数组高阶方法
- 可选链 ?.
- 动态属性访问 obj[key]
- 模板字符串
- 可空联合类型
- 非空断言 !

## C++ 移植要点

- `src/LFW/base/Expression.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 16 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- JSON 处理需引入第三方库（nlohmann/json 等）或自定义解析。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
- 可空联合类型建议用 `std::optional` / 指针表达。
