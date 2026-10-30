# Rin（疾影·凛）

速度型格斗家。体力偏低，但移动与突进连招极快。

## 数据

- 角色数据：`rin.obj.json5`
- 精灵图：`sprite/0.png`、`sprite/1.png`（79x79 格，10 列 x 7 行，80px 步距）
- 头像：`sprite/face.png`（120x120）、`sprite/s.png`（40x45）
- 弹丸数据：`rin_gale.obj.json5`，贴图 `sprite/rin_gale.png`

## 数值

| 项目 | 值 |
| --- | --- |
| HP | 440 |
| MP | 620 |
| 行走速度 | 4.8 |
| 奔跑速度 | 9.6 |
| 强度(ce) | 1 |

## 招式

| 招式 | 输入 | 消耗 | 说明 |
| --- | --- | --- | --- |
| 疾影冲（Shadow Rush） | D + v + A | 45 MP | 近身判定 |
| 三连踢（Triple Kick） | D + ^ + A | 35 MP | 近身判定 |
| 风刃（Wind Blade） | D + > + A | 30 MP | 发射弹丸 |

输入里的 **D** 是防御键，方向按角色朝向理解（`>` 为前方）。数据里对应的按键序列：`Da / Ua / Fa`。

## 来源

精灵图与数据均由 `scripts/gen-fighters.mjs` 程序化生成，不使用任何第三方素材。
修改外观/数值请改脚本后重新运行：

```bash
node scripts/gen-fighters.mjs rin
npm run build:data
```
