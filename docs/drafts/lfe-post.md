# LFW(open source web-based LF2)

[url](https://lf-empire.de/forum/showthread.php?tid=11552)

## Content

I've also made a remake version of LF2. Everyone is welcome to give it a try.

Play on https://lf.gim.ink/

[spoiler=Why is it called Wemake instead of Remake?]
This is because the "W" means "Web" and also represents "We". I hope this project can support the works created by everyone.
(And because of my bad English :p)
[/spoiler]

the data and pictures are processed and converted from the LF2 2.0a.

The advantages are as follows:

- Ideally, the game update frequency is 60 frames per second, which makes it look more fluent.
- Full-platform support (of course, this is due to modern browsers and technical standards).
- Touch-screen support
- The game's input method is different from that of LF2, and no key presses will be missed. (You can even press the 'right' twice in the same frame, and the character can still run...)
- Support higher-resolution textures.

The shortcomings are as follows

- Since the logic is implemented according to my own understanding(and some tutorial for modifying), many things are quite different from the LF2.
- Only VS Mode and Stage Mode are supported, with hardly any other modes
- The bot is a bit stupid

[spoiler=To developers who are interested (source code is here)]
Although I kind of hope someone can join me in the development,
considering that my personal development style is a bit erratic (I often make large-scale adjustments to some things),
I think I'll pass for now.

However, everyone is still welcome to run this project and give it a try.

Project repository: https://github.com/gimhol/Little-Fighter-Wemake
[/spoiler]

[spoiler=Some screenshots]
[img]https://lf.gim.ink/docs/image/custom_game_guide_0.en.png[/img]
[img]https://lf.gim.ink/docs/image/team_outline_effect_stage_mode.png[/img]
[img]https://lf.gim.ink/docs/image/team_outline_effect_vs_mode.png[/img]
[/spoiler]

[spoiler=Multiplayer Online Game]
I spent quite a bit of time resolving various issues regarding inconsistent calculation results.

Finally, the online multiplayer function has been added. If you're interested, you can give it a try (for testing purposes).

I haven't conducted a very thorough test, so I don't know if there will be any synchronization failures.

- Tested on Windows Chrome and Windows Firefox (sometimes the "connect" button doesn't respond in Firefox...).
- It can also be used on Android browsers, but there seem to be relatively significant performance issues.
- The server is on Alibaba Cloud (Guangzhou), and its performance is rather poor.

The server is based on nodejs. Through testing, it can also run on Bun and Deno.

If you want to run your own server, download "server.cjs" from the following link:

https://github.com/gimhol/Little-Fighter-Wemake/releases

Then run "node ./server.cjs".

more details: [url=https://github.com/gimhol/Little-Fighter-Wemake/blob/main/docs/Multiplayer%20Online%20Game/README.EN.MD]Multiplayer Online Game[/url]
[/spoiler]

[spoiler=What's Next?]
[list]
[*]Support for 3D models and animations?
[*]Support for more game mode?
[*]Continuing to implement other game modes of LF2?
[*]Video recording and playback?
[/list]

I don't know. Each one is difficult. :s
There are most likely a lot of potential problems to be fixed. :(
[/spoiler]

[spoiler=2025-01-31: Local Clients Supported(Windows) ]
I use [url=https://wails.io/]Wails[/url] to make this project run like a client. :D
Now you can download it from [url=https://lf.gim.ink/]lf.gim.ink[/url] by clicking the 'windows icon'
[img]https://lf.gim.ink/docs/image/click_for_win_app_downloading.png[/img]
[img]https://lf.gim.ink/docs/image/win_app_looklike.png[/img]
[/spoiler]

[spoiler=2025-01-28: v0.1.12 (Extra Data Supported)release]
changelog:

- fix: The MP recovery speed has been corrected. (It was too fast before...)
- feat: Extra Data supported
- fix: Removed the buttons on the main page whose functions are not yet supported.
- feat: Some pages now support viewing the version number and the file name of the extra data.
- chore: there will be some fighting on the 'Main Page' :D

[img]https://lf.gim.ink/docs/image/main_page_small_fighting.gif[/img]

About Extra Data, See Thread: [url=https://lf-empire.de/forum/showthread.php?tid=11556]lf2w-tool (Conversion Tool for Little Fighter Wemake)[/url]
[img]https://lf.gim.ink/docs/image/dnd_extra_data_in_main_page.gif[/img]
[/spoiler]

[spoiler=2025-01-21: v0.1.9 (Custom game supported) release]
changelog:

- feat: Custom game supported
- fix: The attacked will drop the heavy weapons they are holding correctly
- fix: Adjusted the performance of hitting and being hit by baseball-like weapons
- fix: The boomerang can track enemies now
- feat: You can see your own latency in the room list
- feat: In the room, you can see the latency of all room members
- fix: Fix the issues of bots not using moves and being overly defensive

About Custom game

"Custom game" actually means allowing the loading of other data packages
(but currently, apart from the original data package, no other packages are available for use).

[img]https://lf.gim.ink/docs/image/custom_game_guide_0.en.png[/img]
[img]https://lf.gim.ink/docs/image/custom_game_guide_1.en.png[/img]
You can download the "original data package" in Figure 2 to try out this feature.

more details: [url=https://github.com/gimhol/Little-Fighter-Wemake/blob/main/docs/Custom%20Game/README.EN.MD]Custom Game[/url]
[/spoiler]

[spoiler=2025-01-18: v0.1.5 release]
Sometimes it’s tricky to tell whether an object is an ally or an enemy.
Especially when there are too many entities on the field,
or when you spot a projectile flying toward you from afar.

That’s why I’m trying to add a “team outline” effect to LFW.（See figure below）

[img]https://lf.gim.ink/docs/image/team_outline_effect_stage_mode.png[/img]

[img]https://lf.gim.ink/docs/image/team_outline_effect_vs_mode.png[/img]

This feature will double the texture loading volume, which will result in slower loading speeds.

It will also double the number of rendered entities on the field,
which may affect the game performance as well.
However, it seems to run fine on my device for now.

changelog:

feat: add “team outline” effect
[/spoiler]

[spoiler=2025-01-17: v0.1.4 release]
changelog:

fix: fix the problem that the background and level buttons do not respond,
fix: fix the problem of incorrect display on the scoreboard
fix: weapon will have a more reasonable effect
fix: Improved the performance of the weapon's bounce when it hits the ground.
fix: Fixed the problem of incorrect starting point for weapon throwing.
fix: Fixed the issue that airborne weapons can't be hit again.
feat: Rooms can now be password - protected.
fix: It's no longer possible to join a room that has already started or where all players are ready.
fix: The survival mode will correctly display the current stage number.
fix: The "GO->" will no longer be displayed in the survival mode.
fix: The "GO->" will no longer be displayed in the last sub-level of the mission-passing mode.
fix: Fixed the problem of incorrect relationship between difficulty and the number of enemies in the mission-passing/survival mode
(the problem was that there were too many enemies).

Experiment: I've chosen a revised LF2 (RN-LF2) to test the data conversion.
Currently, there are still many problems. Now you can see it on the index page.
[/spoiler]

[spoiler=2025-01-15: new index page]
Considering that the current data and logic are not stable, and to conduct some version management,
the original address will be changed to a directory page, as shown in the figure below:

[img]https://lf.gim.ink/docs/image/index_page.png[/img]

You need to click on the title to enter the game of the specified version.
[/spoiler]