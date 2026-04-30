"use client";

import React, { useState } from "react";

type MainTab = "general" | "productions" | "rehearse";
type RehearseSub = "scenes" | "cast" | "run-lines" | "settings";

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "productions", label: "Productions" },
  { id: "rehearse", label: "Rehearse" },
];

const REHEARSE_SUBS: { id: RehearseSub; label: string }[] = [
  { id: "scenes", label: "Scenes" },
  { id: "cast", label: "Cast" },
  { id: "run-lines", label: "Run Lines" },
  { id: "settings", label: "Settings" },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-light mt-6 mb-2">{children}</h3>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-base font-semibold text-accent-cyan mt-4 mb-1">
      {children}
    </h4>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-dark-panel border border-border rounded-lg px-4 py-3 text-muted text-sm mt-3">
      {children}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-accent-cyan/10 text-accent-cyan text-xs font-semibold px-2 py-0.5 rounded">
      {children}
    </span>
  );
}

// ─── Tab content components ────────────────────────────────────────────────

function GeneralTab() {
  return (
    <div className="space-y-2 text-muted text-sm leading-relaxed">
      <div className="flex items-start gap-3 pb-4 border-b border-border">
        <div>
          <p className="text-light font-semibold text-base">
            Theater Rehearsal Manager — v0.1.0
          </p>
          <p className="mt-1">
            A personal rehearsal tool for actors. Load your script, assign
            voices to every other character, and let the app read those parts
            aloud so you can practice your own lines in context — no scene
            partner required.
          </p>
        </div>
      </div>

      <SectionHeading>Quick Start</SectionHeading>
      <ol className="list-decimal list-inside space-y-3">
        <li>
          <span className="text-light font-medium">Create a Production</span> —
          Go to <Tag>Productions</Tag> in the top nav and click{" "}
          <Tag>+ Production</Tag>. Give it the name of your show. Each
          production stores its own scenes, cast, and rehearsal settings
          independently.
        </li>
        <li>
          <span className="text-light font-medium">
            Select it from the header
          </span>{" "}
          — Use the project selector dropdown in the top bar to make your new
          production active. All work in Rehearse is scoped to whichever
          production is active.
        </li>
        <li>
          <span className="text-light font-medium">Import your script</span> —
          Go to <Tag>Rehearse</Tag> → <Tag>Scenes</Tag>. Paste your script text
          or upload a PDF. The parser extracts character names and dialogue
          automatically.
        </li>
        <li>
          <span className="text-light font-medium">Configure voices</span> — Go
          to <Tag>Rehearse</Tag> → <Tag>Cast</Tag> to assign a TTS voice to each
          character. Voice settings are saved per character and reused every
          time you rehearse.
        </li>
        <li>
          <span className="text-light font-medium">Run your lines</span> — Go to{" "}
          <Tag>Rehearse</Tag> → <Tag>Run Lines</Tag>. Select your character,
          pick a scene, and press Start. The app reads every other
          character&apos;s lines aloud and pauses on yours.
        </li>
      </ol>

      <SectionHeading>Tips</SectionHeading>
      <ul className="list-disc list-inside space-y-2">
        <li>
          Use <Tag>Cue Only</Tag> mode in Run Lines when you already know the
          scene well — it skips to just the line immediately before each of
          yours.
        </li>
        <li>
          Voices set in the Cast tab are automatically loaded in Run Lines. You
          can also tweak them directly in Run Lines and save them back to Cast
          with the <Tag>Save</Tag> button.
        </li>
        <li>
          For the best voice quality, connect an external TTS API (like a local
          Kokoro server or any OpenAI-compatible endpoint) under{" "}
          <Tag>Rehearse</Tag> → <Tag>Settings</Tag>.
        </li>
        <li>
          Export your productions regularly from <Tag>Rehearse</Tag> →{" "}
          <Tag>Settings</Tag> → <Tag>Data Management</Tag>. All data lives in
          your browser&apos;s local storage and will be lost if you clear it.
        </li>
        <li>
          Scene import understands standard script format: character names in
          ALL CAPS followed by a colon and their line. Scene breaks use headings
          like <code className="text-accent-cyan text-xs">SCENE 1:</code> or{" "}
          <code className="text-accent-cyan text-xs">ACT 2, SCENE 3:</code>.
        </li>
      </ul>

      <SectionHeading>Privacy &amp; Data</SectionHeading>
      <Note>
        All your data — scripts, characters, voice settings — is stored locally
        in your browser&apos;s{" "}
        <code className="text-accent-cyan">localStorage</code>. Nothing is sent
        to any server except the TTS endpoint you explicitly configure. API keys
        never leave your machine.
      </Note>

      <SectionHeading>Contact &amp; Feedback</SectionHeading>
      <div className="bg-dark-panel rounded-lg p-4 mt-2">
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-accent-cyan flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <div>
            <div className="text-light font-medium">Email</div>
            <p className="text-xs mt-0.5">
              Bug reports, feature requests, or general feedback
            </p>
            <a
              href="mailto:joe@dinicola.com?subject=Theater%20Companion%20Feedback"
              className="text-accent-cyan hover:underline text-xs"
            >
              joe@joedinicola.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductionsTab() {
  return (
    <div className="space-y-2 text-muted text-sm leading-relaxed">
      <p>
        A <span className="text-light font-medium">Production</span> is the
        top-level container for a single show. All scenes, characters, and voice
        assignments are scoped to the production that is currently active.
        Switching productions resets the work area to that production&apos;s
        data.
      </p>

      <SectionHeading>Creating a Production</SectionHeading>
      <p>
        Navigate to <Tag>Productions</Tag> in the top nav and click the{" "}
        <Tag>+ Production</Tag> button. A form will appear asking for:
      </p>
      <ul className="list-disc list-inside space-y-1 mt-2">
        <li>
          <span className="text-light font-medium">Name</span> — The title of
          the show (e.g. &quot;Hamlet&quot;, &quot;Into the Woods&quot;).
        </li>
        <li>
          <span className="text-light font-medium">Description</span> — Optional
          notes about the production.
        </li>
      </ul>
      <p className="mt-2">
        Click <Tag>Create</Tag> to save. The production will appear in the list
        below and in the header dropdown.
      </p>

      <SectionHeading>Selecting the Active Production</SectionHeading>
      <p>
        The{" "}
        <span className="text-light font-medium">
          project selector dropdown
        </span>{" "}
        in the top header controls which production is active. All work in{" "}
        <Tag>Rehearse</Tag> — importing scenes, configuring cast, running lines
        — operates on whichever production is selected here. You can switch
        productions at any time; your work is auto-saved per production.
      </p>
      <Note>
        The project selector is always visible in the header so you can quickly
        switch context without navigating away from the Rehearse section.
      </Note>

      <SectionHeading>Managing Productions</SectionHeading>
      <p>Each production in the list supports the following actions:</p>
      <ul className="list-disc list-inside space-y-2 mt-2">
        <li>
          <span className="text-light font-medium">Select</span> — Makes this
          production active. The active production is highlighted and mirrored
          in the header dropdown.
        </li>
        <li>
          <span className="text-light font-medium">Edit</span> — Rename the
          production or update its description inline.
        </li>
        <li>
          <span className="text-light font-medium">Delete</span> — Permanently
          removes the production along with all its scenes and character
          configs. This cannot be undone. Export a backup first if needed.
        </li>
      </ul>

      <SectionHeading>Production Isolation</SectionHeading>
      <p>
        Productions are fully isolated. Scenes imported for one show do not
        appear in another. Character voice assignments are per-production. This
        means you can have multiple shows in progress simultaneously without any
        data mixing.
      </p>

      <SectionHeading>Backup &amp; Restore</SectionHeading>
      <p>
        You can export one or more productions as a{" "}
        <code className="text-accent-cyan">.json</code> backup file at any time
        from <Tag>Rehearse</Tag> → <Tag>Settings</Tag> →{" "}
        <Tag>Data Management</Tag>. Importing a backup file never overwrites
        existing productions — conflicting names can be renamed before import is
        confirmed.
      </p>
    </div>
  );
}

function ScenesSubTab() {
  return (
    <div className="space-y-2 text-muted text-sm leading-relaxed">
      <p>
        The <span className="text-light font-medium">Scenes</span> tab is your
        script library for the active production. Each scene stores a segment of
        your script as raw text. Once imported, scenes are parsed into
        individual character lines and stage directions that power the Run Lines
        rehearsal player.
      </p>

      <SectionHeading>Importing Scenes</SectionHeading>
      <p>There are two ways to get your script into the app:</p>

      <SubHeading>Paste Text</SubHeading>
      <p>
        Click <Tag>Import Scene</Tag> (or the equivalent add button), then paste
        your script directly into the text area. The parser reads character cues
        in the format:
      </p>
      <div className="bg-dark-panel border border-border rounded-lg px-4 py-3 font-mono text-xs text-accent-cyan mt-2 space-y-1">
        <div>CHARACTER NAME: Their dialogue goes here.</div>
        <div>OTHER CHARACTER: Their reply goes here.</div>
        <div className="text-muted mt-2">
          # Scene headings split the text into separate scenes
        </div>
        <div>SCENE 1: OPENING</div>
        <div>CHARACTER: First line of scene one.</div>
      </div>
      <p className="mt-2">
        Character names must be in{" "}
        <span className="text-light font-medium">ALL CAPS</span> followed by a
        colon. Lines without a character prefix are treated as stage directions
        or narration.
      </p>

      <SubHeading>Upload PDF</SubHeading>
      <p>
        If your script is a PDF, use the <Tag>Upload PDF</Tag> option. The app
        uses <code className="text-accent-cyan">pdf.js</code> to extract the
        text layer directly, or falls back to{" "}
        <code className="text-accent-cyan">Tesseract OCR</code> for scanned
        documents. OCR is slower and accuracy depends on the scan quality.
      </p>
      <Note>
        PDF extraction works best with digitally-created PDFs (exported from
        Word, Final Draft, etc.). Scanned pages may require some manual cleanup
        after import.
      </Note>

      <SectionHeading>Multiple Scenes</SectionHeading>
      <p>
        A single import can contain multiple scenes. The parser looks for
        headings like:
      </p>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <li>
          <code className="text-accent-cyan">SCENE 2:</code> or{" "}
          <code className="text-accent-cyan">SCENE 2, ...</code>
        </li>
        <li>
          <code className="text-accent-cyan">ACT 1, SCENE 3:</code>
        </li>
        <li>
          Any all-caps line ending in a colon with no dialogue following it
        </li>
      </ul>
      <p className="mt-2">
        Each detected heading creates a separate scene entry in your library
        with its own title.
      </p>

      <SectionHeading>Managing Scenes</SectionHeading>
      <ul className="list-disc list-inside space-y-2">
        <li>
          <span className="text-light font-medium">View</span> — Click a scene
          to expand its content and see the parsed character list.
        </li>
        <li>
          <span className="text-light font-medium">Edit</span> — Correct any
          parsing errors by editing the raw scene text directly. Re-saving
          re-parses the content.
        </li>
        <li>
          <span className="text-light font-medium">Delete</span> — Removes the
          scene from the library. This does not affect any saved rehearsal
          sessions for that scene.
        </li>
        <li>
          <span className="text-light font-medium">Reorder</span> — Drag scenes
          to rearrange them. The order here matches the scene list shown in Run
          Lines.
        </li>
      </ul>

      <SectionHeading>Character Detection</SectionHeading>
      <p>
        When a scene is saved, the parser records every unique character name it
        finds. These names feed the <Tag>Cast</Tag> tab automatically — any new
        character detected in a scene will appear there ready to have a voice
        assigned.
      </p>
    </div>
  );
}

function CastSubTab() {
  return (
    <div className="space-y-2 text-muted text-sm leading-relaxed">
      <p>
        The <span className="text-light font-medium">Cast</span> tab lists every
        character detected across all scenes in your active production. Here you
        assign a text-to-speech voice to each character. These assignments are
        saved permanently and automatically loaded when you open Run Lines.
      </p>

      <SectionHeading>How Characters Are Added</SectionHeading>
      <p>
        Characters are created automatically when the Scenes parser detects a
        new name. You do not add characters manually — import a scene and any{" "}
        <code className="text-accent-cyan">CHARACTER NAME:</code> found in the
        script will appear in the Cast list. Deleting a scene does not delete
        its characters in case they appear in other scenes.
      </p>

      <SectionHeading>Assigning Voices</SectionHeading>
      <p>
        Each character row shows the following controls depending on your TTS
        provider:
      </p>

      <SubHeading>Browser TTS</SubHeading>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <li>
          <span className="text-light font-medium">Voice</span> — Dropdown of
          all voices installed on your device via the Web Speech API.
        </li>
        <li>
          <span className="text-light font-medium">Rate</span> — Playback speed
          (0.5×–2×).
        </li>
        <li>
          <span className="text-light font-medium">Pitch</span> — Voice pitch
          (0–2, where 1 is neutral).
        </li>
      </ul>

      <SubHeading>Kokoro AI</SubHeading>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <li>
          <span className="text-light font-medium">Voice</span> — Select from
          the built-in Kokoro voice list. Each voice has a distinct style.
        </li>
        <li>
          <span className="text-light font-medium">Speed</span> — Playback rate
          for that character.
        </li>
      </ul>

      <SubHeading>External API</SubHeading>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <li>
          <span className="text-light font-medium">Voice</span> — Dropdown
          populated from your API&apos;s{" "}
          <code className="text-accent-cyan">/voices</code> endpoint, or enter a
          voice ID manually.
        </li>
        <li>
          <span className="text-light font-medium">Speed</span> — Sent as the{" "}
          <code className="text-accent-cyan">speed</code> field in the request
          payload.
        </li>
      </ul>

      <SectionHeading>Previewing Voices</SectionHeading>
      <p>
        Each character row has a <Tag>Preview</Tag> button. Clicking it speaks
        the preview text configured in <Tag>Rehearse</Tag> → <Tag>Settings</Tag>{" "}
        → Voice Settings using that character&apos;s current voice and speed.
        Click again to stop.
      </p>

      <SectionHeading>Sync with Run Lines</SectionHeading>
      <p>
        Voice configs set here are automatically applied in Run Lines.
        Conversely, if you adjust a voice directly inside the Run Lines
        character panel and click <Tag>Save</Tag>, those changes write back to
        the Cast record here. Both views stay in sync.
      </p>
      <Note>
        If a character name in your script is slightly different from the cast
        record (e.g. &quot;MOM&quot; vs &quot;Mom&quot;), the app uses a fuzzy
        first-name match to link them. For reliable matching, keep character
        names consistent across scenes.
      </Note>
    </div>
  );
}

function RunLinesSubTab() {
  return (
    <div className="space-y-2 text-muted text-sm leading-relaxed">
      <p>
        <span className="text-light font-medium">Run Lines</span> is the main
        rehearsal player. It reads every other character&apos;s lines aloud
        using text-to-speech, then pauses (or counts down) when it reaches one
        of your lines, so you can deliver it live.
      </p>

      <SectionHeading>Loading Scenes</SectionHeading>
      <p>Choose how to load the script for this session:</p>

      <SubHeading>From Scene Library</SubHeading>
      <p>
        This is the recommended workflow. Any scenes you&apos;ve imported in the{" "}
        <Tag>Scenes</Tag> tab are available here. Check one or more scenes to
        load them, use the search bar to filter by title, character name, or
        keyword, then click <Tag>Load selected scenes</Tag>. Leave all unchecked
        to load the entire library at once.
      </p>

      <SubHeading>Paste Script</SubHeading>
      <p>
        Alternatively, paste script text directly into the text area and click{" "}
        <Tag>Load script</Tag>. Use <Tag>Single scene</Tag> mode if the text is
        one continuous scene, or <Tag>Multiple scenes</Tag> to split on scene
        headings. This does not save to your library — it&apos;s a quick one-off
        load.
      </p>
      <Note>
        Click <Tag>Load sample</Tag> to see a two-scene example with the
        expected format, useful if you&apos;re testing the player for the first
        time.
      </Note>

      <SectionHeading>Role Setup</SectionHeading>

      <SubHeading>My character</SubHeading>
      <p>
        Select the character you are playing from the dropdown. The player
        pauses on every line belonging to this character so you can say it
        yourself.
      </p>

      <SubHeading>Rehearsal mode</SubHeading>
      <ul className="list-disc list-inside space-y-2 mt-1">
        <li>
          <span className="text-light font-medium">Full Scene</span> — Every
          line in the scene is read in order. This is the default and works well
          for learning a scene from scratch.
        </li>
        <li>
          <span className="text-light font-medium">Cue Only</span> — The player
          silently skips ahead and only speaks the single line immediately
          before each of your lines. Use this when you already know the scene
          and just need to practice picking up your cue.
        </li>
      </ul>

      <SubHeading>On my line</SubHeading>
      <ul className="list-disc list-inside space-y-2 mt-1">
        <li>
          <span className="text-light font-medium">
            Wait for manual continue
          </span>{" "}
          — Playback pauses indefinitely when it reaches your line. Press{" "}
          <Tag>Resume</Tag> when you&apos;re ready to move to the next line.
          Good for careful, deliberate practice.
        </li>
        <li>
          <span className="text-light font-medium">
            Countdown then continue
          </span>{" "}
          — Your line is displayed with a countdown timer. When it hits zero,
          the player automatically advances. Set the number of seconds in the{" "}
          <Tag>Countdown seconds</Tag> field. Good for pacing practice or
          hands-free rehearsal.
        </li>
      </ul>

      <SubHeading>Additional options</SubHeading>
      <ul className="list-disc list-inside space-y-2 mt-1">
        <li>
          <span className="text-light font-medium">Speak character names</span>{" "}
          — Before each line, a narrator voice announces the character&apos;s
          name. Useful when learning a scene with many characters. You can pick
          the narrator voice separately.
        </li>
        <li>
          <span className="text-light font-medium">Read my lines too</span> —
          The app reads your own lines aloud instead of pausing. Use this for a
          full read-through pass where you want to hear the complete scene
          without stopping.
        </li>
        <li>
          <span className="text-light font-medium">Skip narration</span> — Omits
          lines tagged as narration (lines without a character speaker). Useful
          for prose-heavy scripts.
        </li>
        <li>
          <span className="text-light font-medium">Skip stage directions</span>{" "}
          — Omits stage directions and scene headings from playback, keeping the
          audio focused on dialogue only.
        </li>
      </ul>

      <SectionHeading>Character Voices</SectionHeading>
      <p>
        The Character Voices panel shows every character in the loaded scene.
        Voice assignments from the <Tag>Cast</Tag> tab are pre-loaded
        automatically.
      </p>
      <ul className="list-disc list-inside space-y-2 mt-2">
        <li>
          <span className="text-light font-medium">TTS Provider</span> — Switch
          between Browser, API, and Kokoro AI for the entire session. See{" "}
          <Tag>Settings</Tag> for setup details.
        </li>
        <li>
          <span className="text-light font-medium">Voice &amp; Speed</span> —
          Adjust per character as needed for this session.
        </li>
        <li>
          <span className="text-light font-medium">Preview</span> — Test a
          character&apos;s voice using the preview text from Settings. Click
          again to stop.
        </li>
        <li>
          <span className="text-light font-medium">Save to Cast</span> — Writes
          the current voice settings back to the Cast tab record so they persist
          for future sessions.
        </li>
      </ul>
      <Note>
        When <Tag>Speak character names</Tag> is enabled, a{" "}
        <span className="text-light font-medium">Narrator</span> voice row
        appears at the top of the table. The narrator always uses the
        browser&apos;s Web Speech API regardless of the selected TTS provider.
      </Note>

      <SectionHeading>Playback Controls</SectionHeading>
      <ul className="list-disc list-inside space-y-2 mt-1">
        <li>
          <span className="text-light font-medium">Start</span> — Begins
          playback from the first line of the selected scene.
        </li>
        <li>
          <span className="text-light font-medium">Pause</span> — Stops speech
          immediately and holds position.
        </li>
        <li>
          <span className="text-light font-medium">Resume</span> — Continues
          from where it paused, or restarts if not yet started.
        </li>
        <li>
          <span className="text-light font-medium">Reset</span> — Stops playback
          and clears the player back to the ready state without unloading the
          scene.
        </li>
      </ul>

      <SectionHeading>The Rehearsal Player</SectionHeading>
      <p>
        The large display at the bottom of the page shows the current line in
        real time:
      </p>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <li>
          <span className="text-light font-medium">Speaker</span> — Character
          name in cyan, shown in all caps.
        </li>
        <li>
          <span className="text-light font-medium">Dialogue</span> — The full
          line text in large type.
        </li>
        <li>
          <span className="text-light font-medium">Prompt</span> — Yellow text
          shown when it&apos;s your line (<em>Your turn.</em> or the countdown).
        </li>
      </ul>
      <Note>
        Your rehearsal settings (selected character, voice assignments, scene
        selection) are auto-saved every half second. Switching productions loads
        the saved state for that production automatically.
      </Note>
    </div>
  );
}

function SettingsSubTab() {
  return (
    <div className="space-y-2 text-muted text-sm leading-relaxed">
      <p>
        The <span className="text-light font-medium">Settings</span> tab in
        Rehearse has two sections:{" "}
        <span className="text-light font-medium">Voice Settings</span> for
        configuring your TTS provider, and{" "}
        <span className="text-light font-medium">Data Management</span> for
        exporting and importing your productions.
      </p>

      <SectionHeading>Voice Settings — TTS Providers</SectionHeading>
      <p>
        Three TTS providers are available. The active provider applies globally
        across Cast previews, Run Lines, and voice tests.
      </p>

      <SubHeading>Browser (Web Speech API)</SubHeading>
      <p>
        Uses your browser&apos;s built-in speech synthesis engine. No setup
        required — works immediately on any modern browser. Voice quality and
        available voices depend on your operating system. Voices vary widely
        across Windows, macOS, and mobile platforms.
      </p>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <li>No downloads or API keys needed.</li>
        <li>
          Rate (0.5×–2×) and pitch (0–2) are configurable per character in Cast.
        </li>
        <li>Best for quick testing or when offline.</li>
      </ul>

      <SubHeading>Kokoro AI (Local)</SubHeading>
      <p>
        Kokoro is an open-source AI voice model that runs entirely inside your
        browser — no account, no API key, and no data leaves your machine. The
        model file is downloaded once from HuggingFace and cached locally by
        your browser.
      </p>
      <ul className="list-disc list-inside space-y-2 mt-1">
        <li>
          <span className="text-light font-medium">Compute Device</span>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>
              <Tag>CPU (WASM)</Tag> — Works on all browsers, ~80 MB download.
              Slower generation (~1–3 sec per line).
            </li>
            <li>
              <Tag>GPU (WebGPU)</Tag> — Requires Chrome 113+, ~300 MB download.
              5–10× faster generation. Recommended when available.
            </li>
          </ul>
        </li>
        <li>
          <span className="text-light font-medium">Load Model</span> — Click
          this button to download and initialize Kokoro. The button turns green
          with &quot;Model Ready&quot; once loaded. The model stays in memory
          until you close the tab.
        </li>
        <li>
          <span className="text-light font-medium">Default Voice</span> —
          Fallback Kokoro voice used for any character that doesn&apos;t have
          its own voice assigned in Cast.
        </li>
        <li>
          <span className="text-light font-medium">Default Speed</span> — Global
          speed multiplier (0.5×–2×). Character-level speed overrides this.
        </li>
        <li>
          <span className="text-light font-medium">Pre-generation</span> — When
          enabled, Kokoro generates the next non-user line in the background
          while the current one is playing, reducing the pause between lines.
          Recommended to keep on.
        </li>
        <li>
          <span className="text-light font-medium">Test Voice</span> — Enter any
          text and click Play to hear the default Kokoro voice with current
          settings.
        </li>
      </ul>

      <SubHeading>External API</SubHeading>
      <p>
        Connect to any OpenAI-compatible TTS endpoint — a local server, a
        self-hosted model, or a cloud service. The app sends a JSON POST request
        with the line text, voice ID, speed, and format.
      </p>
      <ul className="list-disc list-inside space-y-2 mt-1">
        <li>
          <span className="text-light font-medium">API Base URL</span> — The
          root URL of the service, e.g.{" "}
          <code className="text-accent-cyan">http://localhost:8880</code>. Do
          not include the path here.
        </li>
        <li>
          <span className="text-light font-medium">API Path</span> — The
          endpoint path appended to the base URL. Defaults to{" "}
          <code className="text-accent-cyan">/v1/audio/speech</code>.
        </li>
        <li>
          <span className="text-light font-medium">API Key</span> — Optional.
          Sent as a Bearer token in the Authorization header. Stored in
          localStorage only — never transmitted elsewhere.
        </li>
        <li>
          <span className="text-light font-medium">Default Voice</span> — Click{" "}
          <Tag>Load Voices</Tag> to fetch the voice list from your API, or type
          a voice ID manually. This is used for characters without a specific
          voice assigned in Cast.
        </li>
        <li>
          <span className="text-light font-medium">Response Format</span> — The
          audio format requested (e.g.{" "}
          <code className="text-accent-cyan">mp3</code>,{" "}
          <code className="text-accent-cyan">wav</code>). Must match what your
          endpoint returns.
        </li>
        <li>
          <span className="text-light font-medium">Stream response</span> —
          Sends <code className="text-accent-cyan">stream: true</code> in the
          payload. Enable if your endpoint supports streaming for lower latency.
        </li>
        <li>
          <span className="text-light font-medium">Extra Payload Fields</span> —
          A JSON object merged into every TTS request. Use this for
          vendor-specific fields your endpoint requires. The{" "}
          <code className="text-accent-cyan">input</code>,{" "}
          <code className="text-accent-cyan">voice</code>,{" "}
          <code className="text-accent-cyan">speed</code>,{" "}
          <code className="text-accent-cyan">response_format</code>, and{" "}
          <code className="text-accent-cyan">stream</code> fields are always set
          automatically.
        </li>
        <li>
          <span className="text-light font-medium">Test Connection / Play</span>{" "}
          — Use these to verify your endpoint is reachable and produces audio
          before running a full rehearsal.
        </li>
      </ul>
      <Note>
        Click <Tag>Save Settings</Tag> after making any changes. Settings are
        stored in localStorage and persist across sessions.
      </Note>

      <SectionHeading>Data Management</SectionHeading>

      <SubHeading>Storage Summary</SubHeading>
      <p>
        Four counters at the top show the number of productions, scenes,
        characters, and the total localStorage footprint. A typical script with
        a few scenes uses well under 1 MB.
      </p>

      <SubHeading>Export</SubHeading>
      <p>
        Check the productions you want to back up, then click <Tag>Export</Tag>.
        This downloads a <code className="text-accent-cyan">.json</code> file
        containing all selected productions with their scenes, characters, and
        voice configs. Store this file somewhere safe — it&apos;s the only copy
        of your data outside the browser.
      </p>

      <SubHeading>Import</SubHeading>
      <p>
        Click <Tag>Choose File to Import</Tag> and select a previously exported{" "}
        <code className="text-accent-cyan">.json</code> file. The app shows each
        production found inside with a <Tag>Ready</Tag> or <Tag>Conflict</Tag>{" "}
        status:
      </p>
      <ul className="list-disc list-inside space-y-1 mt-1">
        <li>
          <Tag>Ready</Tag> — Name is unique, safe to import as-is.
        </li>
        <li>
          <Tag>Conflict</Tag> — A production with that name already exists.
          Rename it in the input field before importing.
        </li>
      </ul>
      <p className="mt-2">
        Importing never overwrites existing data. After reviewing the list,
        click <Tag>Import</Tag> to finish, then reload the page to see the new
        productions.
      </p>

      <SubHeading>Legacy Restore</SubHeading>
      <p>
        If you have an older full-backup file from a previous version of the app
        (v1 format), use the <Tag>Restore legacy backup</Tag> link at the bottom
        of the panel. This restores the raw localStorage keys from the backup
        file directly.
      </p>
    </div>
  );
}

function RehearsalSection() {
  const [sub, setSub] = useState<RehearseSub>("scenes");

  return (
    <div>
      <p className="text-muted text-sm mb-4 leading-relaxed">
        The <span className="text-light font-medium">Rehearse</span> section is
        where all the rehearsal work happens. It is divided into four tabs:{" "}
        <Tag>Scenes</Tag>, <Tag>Cast</Tag>, <Tag>Run Lines</Tag>, and{" "}
        <Tag>Settings</Tag>. Select a tab below to read its documentation.
      </p>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {REHEARSE_SUBS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`px-4 py-2 text-sm font-semibold transition-colors rounded-t ${
              sub === t.id
                ? "text-accent-cyan border-b-2 border-accent-cyan bg-dark-panel"
                : "text-muted hover:text-light"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "scenes" && <ScenesSubTab />}
      {sub === "cast" && <CastSubTab />}
      {sub === "run-lines" && <RunLinesSubTab />}
      {sub === "settings" && <SettingsSubTab />}
    </div>
  );
}

export default function AboutPage() {
  const [tab, setTab] = useState<MainTab>("general");

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-light">About</h1>
        <p className="text-muted text-sm mt-1">
          Theater Rehearsal Manager v0.1.0
        </p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-border">
        {MAIN_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold transition-colors rounded-t ${
              tab === t.id
                ? "text-accent-cyan border-b-2 border-accent-cyan bg-dark-panel"
                : "text-muted hover:text-light"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="card">
        {tab === "general" && <GeneralTab />}
        {tab === "productions" && <ProductionsTab />}
        {tab === "rehearse" && <RehearsalSection />}
      </section>
    </main>
  );
}
