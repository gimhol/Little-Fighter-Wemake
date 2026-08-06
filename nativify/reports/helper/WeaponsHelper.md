# helper/WeaponsHelper.ts

> 源文件: `src/LFW/helper/WeaponsHelper.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 50 |
| 大小 | 1655 bytes |
| import 数 | 5 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2.5 / 5 —— 较易** |

## 检测到的语言特征

- class 定义
- 箭头函数/回调
- getter/setter
- Map/Set 容器
- string 键 Map
- 数组高阶方法
- 回调注册/事件
- 可选链 ?.
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/helper/WeaponsHelper.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。
- string 键容器频繁使用，C++ 侧建议用 `std::string_view`/`const char*` 键或对象池优化。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- 展开运算符需展开为循环或可变参数模板。
