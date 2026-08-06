# ui/component/BGMSwitcher.ts

> 源文件: `src/LFW/ui/component/BGMSwitcher.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 54 |
| 大小 | 1812 bytes |
| import 数 | 3 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2.5 / 5 —— 较易** |

## 检测到的语言特征

- class 定义
- 箭头函数/回调
- getter/setter
- static 成员
- 正则/字符串匹配
- 可选链 ?.
- 空值合并 ??
- 展开运算符 ...
- switch 分支
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/component/BGMSwitcher.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
- 展开运算符需展开为循环或可变参数模板。
- 可空联合类型建议用 `std::optional` / 指针表达。
