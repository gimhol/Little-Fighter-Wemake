# ui/component/ScaleAnimation.ts

> 源文件: `src/LFW/ui/component/ScaleAnimation.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 63 |
| 大小 | 1992 bytes |
| import 数 | 4 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3 / 5 —— 中等** |

## 检测到的语言特征

- `any` 类型使用 1 处
- class 定义
- getter/setter
- static 成员
- Map/Set 容器
- 正则/字符串匹配
- 数组高阶方法
- 可选链 ?.
- 空值合并 ??
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/ui/component/ScaleAnimation.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 1 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- static 可变状态在 C++ 中需注意初始化顺序与线程安全。
- 展开运算符需展开为循环或可变参数模板。
