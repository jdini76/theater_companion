# RehearseLines tutorial recorder

## Tutorial 01 · Introduction to RehearseLines

`intro.json` is the production definition. It contains chapter narration, timed Playwright actions, and the original fictional scene. `capture-intro.ts` records a clean Chromium session and a separate clean Edge session. Both the POC and Tutorial 01 use the same cursor and click overlay.

```powershell
node --experimental-strip-types capture-intro.ts intro.json out/intro-capture
node --experimental-strip-types render-intro.ts out/intro-capture out/intro-emily.mp3 out/intro-words.json out/tutorial-01-introduction
node --experimental-strip-types intro-thumbnail.ts out/tutorial-01-introduction.mp4 78 out/tutorial-01-thumbnail.png
```

Generate the narration as one ElevenLabs take using Emily and the paragraphs in `intro-narration.md`. Supply the downloaded audio and a word-alignment JSON array of `[text, startSeconds, endSeconds]` entries. The renderer places each paragraph over its matching app footage, trims excess idle time, and creates both embedded captions and an SRT. Captures need Windows Edge for the browser-isolation chapter. Playwright's page recording supplies the picture track.

This Windows proof of concept records the real RehearseLines app with Playwright and combines the footage, narration, and English captions with FFmpeg. The default walkthrough creates the fictional production **The Clockwork Curtain**.

## Run

Use Windows with Node.js 22.13 or newer, Windows PowerShell, and an installed English Windows speech voice. From this directory, run:

```powershell
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run inspect
npm.cmd run record
```

The inspection command checks that the app responds and opens on an empty dashboard. Recording opens a new, dark-preference Playwright context with no stored cookies or profile. It uses the public app by default. To use a local copy of the real app or a demo deployment, set `$env:TUTORIAL_URL` to its URL before running. The fixtures in the JSON file assume an empty production list and a route that opens on the dashboard.

The recorder uses a local Windows speech voice and never sends the narration to an external service. It writes the 1920 × 1080, 30 fps MP4 and an English SRT to `out/`. The MP4 also includes a selectable English caption track. Temporary capture files are removed after each run.

## Record another walkthrough

### Default narration style

Write each tutorial as if you know the app and are showing it to someone beside you. Use contractions, everyday words, and a mix of short reactions and longer explanations. A few natural transitions or hesitations, such as “okay,” “so,” “alright,” or “um,” are enough. Leave a beat after a click or while a result appears. Use phrases like “let’s take a look,” “I’m going to go ahead and,” or “there we go” when the action gives you a reason to say them.

Say the real control name near the click, then describe the result once it appears. Vary delivery with punctuation, short pauses, and small changes in speed. Keep the energy relaxed and leave room for the viewer to follow the cursor. Caption the words you actually record, including any spoken fillers.

To give an existing capture a neural voiceover, run `npm.cmd run revoice` after recording. This uses Kokoro locally, with a model download on the first run. It copies the original video track and writes a separate `-neural.mp4` and `-neural.srt` beside it. Set `TUTORIAL_VOICE` to a Kokoro voice ID to change the voice. For another capture pass its MP4 path and matching JSON with `npm.cmd run revoice -- path/to/tutorial.mp4 my-tutorial.json`. The source SRT must sit beside the MP4.

For a conversational rewrite over the same footage, use a timeline like `clockwork-voiceover.json`. Each beat has `start` and `end` times in seconds, the spoken `say` text, and an optional `speed`. Shorten a line or give it more room if it needs to be rushed. The recorder generates captions based on each rendered beat and estimates timing for line breaks within it.

```powershell
npm.cmd run revoice -- --timeline clockwork-voiceover.json
```

This creates a separate `-conversational.mp4` and matching SRT. Pass a source MP4 path after the timeline file to revoice a different capture. Use the example phrasing as a reference when writing the `say` fields for new recordings.

Copy `clockwork.json`, edit the narration and actions, and run `npm.cmd run record -- my-tutorial.json`. Each step starts a narration cue and performs its actions in order. Captions use the measured duration of each spoken cue and approximate the timing of lines within it. Keep the narration and actions short enough for the 90-second duration limit.

Action types are `click`, `optionalClick`, `type`, and `visible`. Selectors use `role:button:Exact accessible name`, `text:Exact visible text`, or `css:selector`. The `$project` token expands to the JSON project name in selectors and typed values. For a different flow, update the dashboard checks and the final visible success check to match what the real app displays.

The package includes FFmpeg and FFprobe. Set `FFMPEG` or `FFPROBE` to another executable path if needed. Set `PLAYWRIGHT_CHANNEL` to use a supported installed Chromium channel instead of the bundled browser.
