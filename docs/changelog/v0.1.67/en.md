# [v0.1.67](https://lf.gim.ink/0.1.67)

by [**Gim**](https://gim.ink)

<!-- git-range: 784b7a94f..HEAD -->

### What's New

- New "Resolution" setting in the settings page (still being adapted)
- New "Any idea?" suggestion entry
- Double-tap a direction while down to roll back up
- Bots' while-down behavior adjusted accordingly
- Frame data gains the `on_leave_ground` / `on_caught_end` / `on_sudden_death` properties
- Entity data gains the `ghosted` property

### Tweaks

- UI layout rewrite: percentage alignment and XML descriptions, better suited to different resolutions and aspect ratios
- Local settings are no longer synced over netplay
- Double-tap running rules: both taps must be made while standing/walking, or if the first tap is in another state, matching facing also counts
- Bots are more likely to throw knife-type weapons
- Freeze bot's D>J no longer targets enemies that are already frozen

### Fixes

- Fixed some numbers not being rounded
