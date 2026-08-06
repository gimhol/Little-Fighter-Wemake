# ui/component/UIProps.ts

> 源文件: `src/LFW/ui/component/UIProps.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 115 |
| 大小 | 4251 bytes |
| import 数 | 10 |
| export 数 | 2 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3.5 / 5 —— 中等偏难** |

## 检测到的语言特征

- `any` 类型使用 5 处
- `unknown` 使用 2 处
- class 定义
- interface 定义
- 箭头函数/回调
- getter/setter
- 正则/字符串匹配
- 数组高阶方法
- 回调注册/事件
- 可选链 ?.
- 空值合并 ??
- 动态属性访问 obj[key]
- 模板字符串
- 展开运算符 ...
- switch 分支
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/component/UIProps.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 5 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
