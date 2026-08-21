# Little Fighter Wemake

![title](docs/image/readme.title.png)

[中文](README.MD) | [English](README.EN.MD)

觉得这个项目还不错？Star⭐支持一下吧！

直接开试 [https://lf.gim.ink/](https://lf.gim.ink/)

**玩法、美术、音效音乐来自"Litter Fighter 2", 原作：Marti Wong，Starsky Wong.**

**原作者Marti Wong现已推出《[Little Fighter 2 Remastered](https://lf2.net/)》，请在[Steam](https://store.steampowered.com/app/3249650)购买，以支持原作者。**

## 快捷链接

- [CHANGELOG](./CHANGELOG.MD)
- [多人联机游戏](./docs/Multiplayer%20Online%20Game/README.MD)
- [构建与运行](./docs/Build%20Instructions/README.MD)
- [自定义游戏](./docs/Custom%20Game/README.MD)
- [功能建议、体验反馈](https://github.com/gimhol/little-fighter-2-WEMAKE/discussions)

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

## Git LFS 使用说明

本项目使用 [Git LFS](https://git-lfs.com/) 管理仓库中的二进制资源（图片、音频、压缩包等），规则见根目录 [`.gitattributes`](./.gitattributes)：

```text
*.bmp  *.png  *.wma  *.wav  *.zip  *.mp3  *.mp4  *.gif  *.docx   →  Git LFS
```

### 克隆 / 拉取

首次使用前先安装 git-lfs（Windows：`winget install GitHub.GitLFS`；macOS：`brew install git-lfs`；Linux 见[官方文档](https://github.com/git-lfs/git-lfs#installing)）：

```bash
git lfs install

# 克隆（会自动拉取 LFS 文件）
git clone https://github.com/gimhol/little-fighter-2-WEMAKE.git

# 已克隆的仓库：确保 LFS 文件已物化（内容为真实文件而非指针）
git lfs pull
```

### 添加新的二进制资源

仓库已按扩展名自动纳入 LFS，直接 `git add` 即可，无需手动 `git lfs track`。若需纳入其他类型：

```bash
git lfs track "*.dat"        # 将该扩展名纳入 LFS 管理
git add .gitattributes
git commit
```

### 注意事项

- **指针文件**：LFS 文件在 GitHub 网页 / API 上只显示为几 KB 的文本"指针"，必须 `git lfs pull`（或正常 clone）后才是真实内容。
- **配额**：GitHub 免费账户 LFS 配额为 **1GB 存储 + 1GB/月下载流量**；超限会构建/拉取失败，需清理历史 LFS 对象或升级套餐。
- **CI**：GitHub Actions 构建时已启用 `lfs: true` 自动拉取 LFS 文件（见 `.github/workflows/deploy-pages.yml`），否则线上图片等资源会损坏。
