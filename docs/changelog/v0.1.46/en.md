# [v0.1.46](https://lf.gim.ink/0.1.46)

by [**Gim**](https://gim.ink)

### News

- New weapon: Basketball (an experiment in "multi-sprite overlay" & "sprite rotation")
![davis & basketball 'playing'](../../image/bskb_davis.gif)

- New map: Pixel Ruler ("for testing some things")
![test case in the Pixel Ruler](../../image/px_rl.gif)

### Misc

- Adjusted Rudolf's back-and-forth transform logic to roughly match LF2
- Adjusted Louis D^J+J..J logic to roughly match LF2
- Adjusted Freeze D>J so it can be broken correctly now
- Adjusted boomerang behavior to be closer to LF2
- Adjusted armor logic; Julian/Knight are now closer to the original (and weaker)
- Adjusted version name generation; you can now see the git commit ID for the version
- Adjusted UI text rendering
- Adjusted camera behavior when switching to shorter maps
- Adjusted Bot return-to-center position (randomized)
- Adjusted weapon bounce-on-landing behavior
- Various other adjustments; unknown if there are more issues
- Fixed a multiplayer failure caused by playing a random next BGM track when the current one ends
- Fixed an issue where the shadow blocks entities when they hug the top edge of the map
- Fixed an issue where a held weapon couldn't rescue hostages
- Fixed an issue where a held weapon couldn't bounce balls
