# Little Fighter Wemake

![title](docs/image/readme.title.png)

[中文](README.MD) | [English](README.EN.MD)

[玩正式版](https://lf.gim.ink/latest) | [玩预览版](https://gimhol.github.io/Little-Fighter-Wemake/) | [其他？](https://lf.gim.ink/)

觉得这个项目还不错？Star 支持一下吧.

**玩法、美术、音效音乐来自"Litter Fighter 2", 原作：Marti Wong，Starsky Wong.**

**原作者Marti Wong现已推出《[Little Fighter 2 Remastered](https://lf2.net/)》，请在[Steam](https://store.steampowered.com/app/3249650)购买，以支持原作者。**

## 快捷链接

- [CHANGELOG](./CHANGELOG.MD)
- [多人联机游戏](./docs/Multiplayer%20Online%20Game/README.MD)
- [构建与运行](./docs/Build%20Instructions/README.MD)
- [自定义游戏](./docs/Custom%20Game/README.MD)
- [功能建议、体验反馈](https://github.com/gimhol/Little-Fighter-Wemake/discussions)

## 截图

![入口页](./docs/image/custom_game_guide_0.en.png)
![主页](./docs/image/main_page_small_fighting.gif)
![闯关模式(生存)](./docs/image/team_outline_effect_stage_mode.png)
![对战模式](./docs/image/team_outline_effect_vs_mode.png)

## 进行中

- 支持XML格式的数据[(为什么?)](./docs/dev/why_xml.MD)
- frame支持多图叠加以及图片旋转[(为什么?)](./docs/dev/frame_with_multi_pic.MD)

## 接下来是？

- 支持3d模型与动画?
- 更丰富的关卡功能支持？
- 继续实现LF2的其他游戏模式？
- 录像与回放？

## GitHub Actions 自动部署

项目通过 [GitHub Actions](./.github/workflows/deploy-pages.yml) 自动构建并部署到 GitHub Pages，[https://gimhol.github.io/Little-Fighter-Wemake/](https://gimhol.github.io/Little-Fighter-Wemake/) 也能直接游玩。

- **触发方式**：推送新 tag（如 `v0.1.46`）时自动触发，也可以在 Actions 页面手动触发（`workflow_dispatch`）。

## Git LFS 使用说明

本项目使用 [Git LFS](https://git-lfs.com/) 管理仓库中的二进制资源（图片、音频、压缩包等），规则见根目录 [`.gitattributes`](./.gitattributes)
