# Little Fighter Wemake

![title](docs/image/readme.title.png)

[中文](./README.MD) | [English](./README.EN.MD)  

try it at [https://lf.gim.ink/](https://lf.gim.ink/) | GitHub Pages preview: [https://gimhol.github.io/little-fighter-2-WEMAKE/](https://gimhol.github.io/little-fighter-2-WEMAKE/)

Think this project is pretty good? Consider starring it!

**gameplays, arts, and sounds are all from "Litter Fighter 2" basically, created by Marti Wong and Starsky Wong in 1999.

"Little Fighter Wemake" created by Gim in 2024."**

**The original author, Marti Wong, has now launched "[Little Fighter 2 Remastered](https://lf2.net/)". Please purchase it on [Steam](https://store.steampowered.com/app/3249650) to support the original author.**

## Links

- [CHANGELOG](./CHANGELOG.EN.MD)
- [Multiplayer Online Game](./docs/Multiplayer%20Online%20Game/README.EN.MD)
- [Building and Running](./docs/Build%20Instructions/README.EN.MD)
- [Custom Game](./docs/Custom%20Game/README.MD)
- [Feedback & Discussions](https://github.com/gimhol/little-fighter-2-WEMAKE/discussions)

## Screenshots

![入口页](./docs/image/custom_game_guide_0.en.png)
![主页](./docs/image/main_page_small_fighting.gif)
![闯关模式(生存)](./docs/image/team_outline_effect_stage_mode.png)
![对战模式](./docs/image/team_outline_effect_vs_mode.png)

## What's next?

- Support for 3D models and animations?
- Support for more diverse level functions?
- Continuing to implement other game modes of LF2?
- Video recording and playback?

## GitHub Actions Auto Deployment

The project is automatically built and deployed to GitHub Pages via [GitHub Actions](./.github/workflows/deploy-pages.yml). You can also play it directly at [https://gimhol.github.io/little-fighter-2-WEMAKE/](https://gimhol.github.io/little-fighter-2-WEMAKE/).

- **Trigger**: Pushing a new tag (e.g. `v0.1.46`) triggers the build automatically. You can also trigger it manually from the Actions tab (`workflow_dispatch`).
- **Build flow**: Checks out the latest tagged commit on main → installs dependencies → builds game data (`data.zip` / `prel.zip`) → builds the frontend → deploys to Pages.
- **Release steps**:

  ```bash
  git tag v0.1.47
  git push origin v0.1.47
  ```

  After pushing, wait for the Actions build to finish, then play the latest version at the URL above.

## Git LFS Usage

This project uses [Git LFS](https://git-lfs.com/) to manage binary resources (images, audio, archives, etc.). See [`.gitattributes`](./.gitattributes) at the repo root:

```text
*.bmp  *.png  *.wma  *.wav  *.zip  *.mp3  *.mp4  *.gif  *.docx   →  Git LFS
```

### Clone / Pull

Install git-lfs first (Windows: `winget install GitHub.GitLFS`; macOS: `brew install git-lfs`; Linux: see [official docs](https://github.com/git-lfs/git-lfs#installing)):

```bash
git lfs install

# Clone (LFS files are fetched automatically)
git clone https://github.com/gimhol/little-fighter-2-WEMAKE.git

# For an existing clone: make sure LFS files are materialized (real files, not pointers)
git lfs pull
```

### Adding New Binary Resources

Files are already tracked by extension, so just `git add` them — no need to run `git lfs track` manually. To track a new type:

```bash
git lfs track "*.dat"        # add this extension to LFS management
git add .gitattributes
git commit
```

### Notes

- **Pointer files**: LFS files show up on the GitHub web/API as a few-KB text "pointer". You must `git lfs pull` (or clone normally) to get the real content.
- **Quota**: The free GitHub plan includes **1 GB of LFS storage + 1 GB of download bandwidth per month**. Exceeding it will cause build/pull failures; you'll need to purge old LFS objects or upgrade.
- **CI**: GitHub Actions already enables `lfs: true` to fetch LFS files during builds (see `.github/workflows/deploy-pages.yml`), otherwise deployed images and other assets would be broken.
