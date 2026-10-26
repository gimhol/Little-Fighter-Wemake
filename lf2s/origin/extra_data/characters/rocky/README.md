# Rocky（铁拳·洛奇）

重拳型斗士。血厚、拳重、起手慢，靠一记重拳翻盘。

## 数据

- 角色数据：`rocky.obj.json5`
- 精灵图：`sprite/0.png`、`sprite/1.png`（79x79 格，10 列 x 7 行，80px 步距）
- 头像：`sprite/face.png`（120x120）、`sprite/s.png`（40x45）
- 弹丸数据：`rocky_shock.obj.json5`，贴图 `sprite/rocky_shock.png`

## 数值

| 项目 | 值 |
| --- | --- |
| HP | 640 |
| MP | 500 |
| 行走速度 | 3.6 |
| 奔跑速度 | 7.2 |
| 强度(ce) | 2 |

## 招式

| 招式 | 输入 | 消耗 | 说明 |
| --- | --- | --- | --- |
| 崩山重拳（Crush Punch） | D + v + A | 45 MP | 近身判定 |
| 震地波（Quake Wave） | D + ^ + A | 35 MP | 发射弹丸 |
| 铁壁冲（Iron Charge） | D + > + A | 40 MP | 近身判定 |

输入里的 **D** 是防御键，方向按角色朝向理解（`>` 为前方）。数据里对应的按键序列：`Da / Ua / Fa`。

## 来源

精灵图与数据均由 `scripts/gen-fighters.mjs` 程序化生成，不使用任何第三方素材。
修改外观/数值请改脚本后重新运行：

```bash
node scripts/gen-fighters.mjs rocky
npm run build:data
```
