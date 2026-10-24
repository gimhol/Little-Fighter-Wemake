# Legacy Flame War

![title](docs/image/readme.title.png)

[中文](./README.MD) | [English](./README.EN.MD)  

[Play Release Version](https://lf.gim.ink/latest) | [Play Preview Version](https://gimhol.github.io/Little-Fighter-Wemake/) | [Others](https://lf.gim.ink/)

Think this project is pretty good? Consider starring it!

**gameplays, arts, and sounds are all from "Little Fighter 2" basically, created by Marti Wong and Starsky Wong in 1999.

"Legacy Flame War" created by Gim in 2024.**

**The original author, Marti Wong, has now launched "[Little Fighter 2 Remastered](https://lf2.net/)". Please purchase it on [Steam](https://store.steampowered.com/app/3249650) to support the original author.**

**As [LF2R](https://store.steampowered.com/app/3249650) is about to release LF2 2.0 assets, this project will no longer publish releases involving LF2 assets from that point on, and already published versions containing LF2 assets will be removed as well.**

## Links

- [CHANGELOG](./CHANGELOG.EN.MD)
- [Multiplayer Online Game](./docs/Multiplayer%20Online%20Game/README.EN.MD)
- [Building and Running](./docs/Build%20Instructions/README.EN.MD)
- [Custom Game](./docs/Custom%20Game/README.MD)
- [Copyright Notice](./COPYRIGHT.MD)
- [Feedback & Discussions](https://github.com/gimhol/Little-Fighter-Wemake/discussions)
- [How to Report a Problem](./docs/问题反馈指南.EN.MD)

## Screenshots

![入口页](./docs/image/custom_game_guide_0.en.png)
![主页](./docs/image/main_page_small_fighting.gif)
![闯关模式(生存)](./docs/image/team_outline_effect_stage_mode.png)
![对战模式](./docs/image/team_outline_effect_vs_mode.png)

## 进行中

- 支持XML格式的数据[(Why?)](./docs/dev/why_xml.MD)
- 支持3d模型与动画

## What's next?

- Support for more diverse level functions?
- Continuing to implement other game modes of LF2?
- Video recording and playback?
- Removing the assets taken from LF2?

## GitHub Actions Auto Deployment

The project is automatically built and deployed to GitHub Pages via [GitHub Actions](./.github/workflows/deploy-pages.yml). You can also play it directly at [https://gimhol.github.io/Little-Fighter-Wemake/](https://gimhol.github.io/Little-Fighter-Wemake/).

- **Trigger**: Pushing a new tag (e.g. `v0.1.46`) triggers the build automatically. You can also trigger it manually from the Actions tab (`workflow_dispatch`).

## Git LFS Usage

This project uses [Git LFS](https://git-lfs.com/) to manage binary resources (images, audio, archives, etc.). See [`.gitattributes`](./.gitattributes) at the repo root.
