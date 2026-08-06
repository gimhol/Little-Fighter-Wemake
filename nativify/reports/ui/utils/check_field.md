# ui/utils/check_field.ts

> 源文件: `src/LFW/ui/utils/check_field.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 71 |
| 大小 | 2017 bytes |
| import 数 | 1 |
| export 数 | 5 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★★☆☆ 3.5 / 5 —— 中等偏难** |

## 检测到的语言特征

- `any` 类型使用 6 处
- class 定义
- type 别名
- function 声明
- 箭头函数/回调
- JSON 序列化
- 正则/字符串匹配
- 数组高阶方法
- 回调注册/事件
- 可选链 ?.
- instanceof 类型判断
- 动态属性访问 obj[key]
- 模板字符串
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/ui/utils/check_field.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 6 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- JSON 处理需引入第三方库（nlohmann/json 等）或自定义解析。
- 正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。
- instanceof 运行时类型判断需改用 typeid / 虚函数 / 判别联合。
- 展开运算符需展开为循环或可变参数模板。
