# ui/component/Tests/Others/MoveStayCome.ts

> 源文件: `src/LFW/ui/component/Tests/Others/MoveStayCome.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 44 |
| 大小 | 1590 bytes |
| import 数 | 6 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- class 定义
- 箭头函数/回调
- 正则/字符串匹配
- 数组高阶方法
- 回调注册/事件
- 模板字符串
- 可空联合类型

## C++ 移植要点

- `src/LFW/ui/component/Tests/Others/MoveStayCome.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- 可空联合类型建议用 `std::optional` / 指针表达。
