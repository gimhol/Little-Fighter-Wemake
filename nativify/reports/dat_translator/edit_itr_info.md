# dat_translator/edit_itr_info.ts

> 源文件: `src/LFW/dat_translator/edit_itr_info.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 9 |
| 大小 | 175 bytes |
| import 数 | 1 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- function 声明
- Object.* 反射方法
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/dat_translator/edit_itr_info.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 展开运算符需展开为循环或可变参数模板。
- Object.* 反射方法需替换为显式代码或序列化框架。
