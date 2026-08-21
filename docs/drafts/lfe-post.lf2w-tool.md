# lf2w-tool (Conversion Tool for Little Fighter Wemake)

[url](https://foo.bar)

## Content
"lf2w-tool" is Conversion Tool for Little Fighter Wemake

You can use this tool to convert LF2 data into "extra data packages" that can be used by LF2W.

[url=https://lf-empire.de/forum/showthread.php?tid=11552]What is Little Fighter Wemake[/url](hereinafter referred to as LF2W)

================================================================================

Finally, I improved the "Conversion Tool" to make it easier to use.

(Let's tentatively call the "Conversion Tool" lf2w-tool)

And then I enabled "Extra Data" loading in LF2W, Unlike "Custom Game" it requires "Full Data"

================================================================================

I tested out the characters from these two forum posts listed below:

[url=https://lf-empire.de/forum/showthread.php?tid=11546][Char] Neno and Nano[/url] By [url=https://lf-empire.de/forum/member.php?action=profile&uid=752]Memento[/url]
[url=https://lf-empire.de/forum/showthread.php?tid=11398][Char] DeepRV (Remixed version)[/url] By [url=https://lf-empire.de/forum/member.php?action=profile&uid=4488]rewlf2[/url]

Sorry for trying these out without asking first.
A big thank you to the creators who shared these characters in the threads.
(How can I mention someone here?) :D 

I'm too lazy to write a Usage for now, so I'll provide two screen recordings below.
(Sadly, I don't want to upload the videos to any video websites now, so you can only download and watch them.) :( 

[url=https://lf.gim.ink/docs/drafts/how_to_gen_extra_data_zip.mp4]Video: How To Gen Extra Data Zip[/url]
[url=https://lf.gim.ink/docs/drafts/how_to_use_extra_data_zip.mp4]Video: How To Use Extra Data Zip[/url]
[url=https://lf.gim.ink/docs/drafts/extra_data.data.zip]extra_data.data.zip(What I generated in the video)[/url]

Or you can drag & drop 'extra data zip' in 'Entry Page'(page before loading) or 'Main Page'(page after loading)。
You can see the file name you want to load at the bottom-right corner of the page.
[spoiler= Gif: Drag & Drop the 'extra data zip']
[img]https://lf.gim.ink/docs/image/dnd_extra_data_in_main_page.gif[/img]
[/spoiler]

It's the same principle as adding new characters. You can add new stages and backgrounds. 
(However, the situation of ID duplication hasn't been tested yet. :( )

[spoiler=Screenshots from Video]
[img]https://lf.gim.ink/docs/drafts/screenshot_of_extra_data_button.png[/img]
[img]https://lf.gim.ink/docs/drafts/screenshot_of_extra_data_playing.png[/img]
[/spoiler]

[spoiler=Other development details]
Thanks to "Bun", I can turn the typescript code into an executable file easily.
But, due to that, the size is relatively large.

[b]Notice: File names and directory names are case-sensitive.[/b]

[b]You will need "ffmpeg" & "magick" to help you convert the audio and picture. 
Make sure they can run correctly in the command line.[/b]

Otherwise, you will have to figure out how to convert the pictures and audio into PNG and MP3 by yourself, so technically speaking, you can also do this by yourself and zip it in...

I will try to package and upload "lf2w-tool" in each release. 
You can find them in the [url=https://github.com/gimhol/Little-Fighter-Wemake/releases]Github release[/url].

[/spoiler]