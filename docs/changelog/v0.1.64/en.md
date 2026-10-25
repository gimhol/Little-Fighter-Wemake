# [v0.1.64](https://lf.gim.ink/0.1.64)

by [**Gim**](https://gim.ink)

<!-- git-range: 6a084794f..b51be4294 -->

"Bots that know when to stop"

### Added

- New `ENTITY` console command: prints one entity's full state (frame / state / position / velocity / hp, mp /
  flags) and edits it in place — position, frame, state, name, plus properties like `hp` / `shaking` / `team`;
  `--holding=#102` links two entities by id

### Tweaks

- Bots stop chasing and return to following once the target leaves `AI_STAY_CHASING_RANGE`
- The watched target is dropped when it dies, disappears, or leaves the chase range
