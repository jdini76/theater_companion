# Theater Rehearsal Manager - Modal Workflow Diagram

## Overall Application Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          ROOT LAYOUT (Layout.tsx)                        │
│  ┌────────┬──────────┬────────────┬──────────────┐                      │
│  │Project │ Scene    │ Voice      │ Rehearsal    │                      │
│  │Provider│ Provider │ Provider   │ Provider     │                      │
│  └────────┴──────────┴────────────┴──────────────┘                      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
         ┌──────▼────────┐  ┌──────▼────────┐  ┌──────▼─────────┐
         │  Dashboard    │  │  Auth Pages   │  │  OAuth Callback│
         │  Layout       │  │               │  │                │
         └──────┬────────┘  └───────────────┘  └────────────────┘
                │
    ┌───────────┼───────────┬───────────┬──────────────┬────────────┐
    │           │           │           │              │            │
┌───▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──┐
│/cast │  │/songs│  │/about│  │/scenes  │/projects  │/rehearse
│      │  │      │  │      │  │        │        │
└──────┘  └──────┘  └──────┘  └────┬───┘        │
                                   │            │
                             ┌─────▼──┐  ┌─────▼──────────┐
                             │Scene    │  │Unified Rehearsal
                             │Manager  │  │Page (CORE)
                             └─────────┘  └────────────────┘
```

---

## UnifiedRehearsalPage - Detailed Panel Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       UnifiedRehearsalPage                                   │
│                   ┌─────────────────────────────────────────┐                │
│                   │  Run Lines Panel (Always Visible)       │                │
│                   │  ┌─────────────────────────────────────┐│                │
│                   │  │ [Scene Tabs] [Scene 1] [Scene 2]    ││                │
│                   │  ├─────────────────────────────────────┤│                │
│                   │  │ CURRENT SPEAKER: Romeo              ││                │
│                   │  │ O Romeo, Romeo! Wherefore art thou?  ││                │
│                   │  │ Your turn. Continuing in 4...        ││                │
│                   │  ├─────────────────────────────────────┤│                │
│                   │  │ [▶ Start] [⏸ Pause] [⏹ Stop]        ││                │
│                   │  └─────────────────────────────────────┘│                │
│                   └─────────────────────────────────────────┘                │
│                                                                               │
│    ┌──────────────────────────┐  ┌───────────────────────────────────────┐  │
│    │  Load Scenes Sidebar     │  │    Main Content Area                  │  │
│    │  (Collapsible: 34rem)    │  │  (Flexible width)                     │  │
│    ├──────────────────────────┤  │                                       │  │
│    │ [◀ Hide] ▼ Show          │  │  Role & Options Card                  │  │
│    ├──────────────────────────┤  │  ┌─────────────────────────────────┐  │  │
│    │ Load Scenes              │  │  │ My Character: [Romeo ▼]        │  │  │
│    │ [From Library][Paste]    │  │  │ On My Line: [Pause and wait ▼] │  │  │
│    │                          │  │  │ [▼ Advanced Options]            │  │  │
│    │ From Library:            │  │  └─────────────────────────────────┘  │  │
│    │ [Scenes] [Set Pieces]    │  │                                       │  │
│    │                          │  │  Character Voices Card                │  │
│    │ Scene List:              │  │  ┌─────────────────────────────────┐  │  │
│    │ ☑ All (5)               │  │  │ TTS Provider: [Kokoro ▼]        │  │  │
│    │ ┌──────────────────────┐ │  │  │ 🎙 Narrator: [Voice 2 ▼]       │  │  │
│    │ │ ☑ Romeo's Chamber    │ │  │  │                                 │  │  │
│    │ │   ROMEO, JULIET      │ │  │  │ Romeo:  [Voice ▼] Spd[1.0] [▶] │  │  │
│    │ │ ☐ Balcony Scene      │ │  │  │ Juliet: [Voice ▼] Spd[1.0] [▶] │  │  │
│    │ │   ROMEO, JULIET      │ │  │  │                                 │  │  │
│    │ │ ☑ Garden Oath        │ │  │  │ [Preview: ▶ Romeo]              │  │  │
│    │ │   ROMEO, FRIAR       │ │  │  │ [💾 Save to Cast]               │  │  │
│    │ └──────────────────────┘ │  │  └─────────────────────────────────┘  │  │
│    │                          │  │                                       │  │
│    │ [Load 3 Scenes]          │  │                                       │  │
│    │                          │  │                                       │  │
│    │ Paste Script:            │  │                                       │  │
│    │ ○ Single scene           │  │                                       │  │
│    │ ○ Multiple scenes        │  │                                       │  │
│    │ [Textarea for paste...]  │  │                                       │  │
│    │ [Load Script][Sample]    │  │                                       │  │
│    └──────────────────────────┘  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Modal/Panel State Machine

```
┌─────────────────────────────────────────────────────────────────────────┐
│ UnifiedRehearsalPage State Management                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ Script Loading States:                                                 │
│                                                                          │
│  IDLE ─────────────────────────────────────────────────────────────┐   │
│   │                                                                 │   │
│   ├─ loadSource="library" ─────────────────────────────┐           │   │
│   │                                                    │           │   │
│   │  libraryLoadMode="scenes"                         │           │   │
│   │  ├─ Show scene list with filtering                │           │   │
│   │  ├─ Multi-select: selectedLibrarySceneIds         │           │   │
│   │  ├─ Search: libraryFilter                         │           │   │
│   │  └─ [Load X Scenes] ─────────────────┐            │           │   │
│   │                                       ▼            │           │   │
│   │  libraryLoadMode="set-pieces"         SCENES_LOADED           │   │
│   │  ├─ Show set pieces with scenes count│            │           │   │
│   │  ├─ Multi-select: selectedLibrarySetPieces        │           │   │
│   │  ├─ Search: libraryFilter                         │           │   │
│   │  └─ [Load X Set Pieces]              │            │           │   │
│   │                                       └────────────┘           │   │
│   │                                                                 │   │
│   └─ loadSource="paste" ──────────────────────────────┐            │   │
│                                                       │            │   │
│      sceneMode="single" or "multiple"                │            │   │
│      ├─ Show textarea for paste                      │            │   │
│      ├─ scriptInput state                            │            │   │
│      ├─ [Load Script]                                │            │   │
│      │  └─ parseScenes() ─────────────────────────┐  │            │   │
│      │     parseDialogueLines()                   │  │            │   │
│      │                                             ▼  │            │   │
│      └─ [Load Sample] ─────────────────────────────▼──┘            │   │
│                                         SCENES_LOADED              │   │
│                                                                 │   │   │
│                                                                 ▼   │   │
│ ┌──────────────────────────────────────────────────────────────────────┤
│ │ SCENES_LOADED State                                                  │
│ ├──────────────────────────────────────────────────────────────────────┤
│ │                                                                       │
│ │ - runLinesOpen auto-expands                                         │
│ │ - scenesOpen auto-collapses                                         │
│ │ - scenes[] populated with parsed scenes                             │
│ │ - selectedSceneIndex = 0                                            │
│ │ - currentSpeaker = "READY"                                          │
│ │ - currentDialogue = "Script loaded."                                │
│ │                                                                       │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ │ User selects character from dropdown                            │ │
│ │ │ selectedCharacter = "ROMEO"                                     │ │
│ │ │ ├─ ensureVoiceAssignments() called                              │ │
│ │ │ ├─ Load voice configs from VoiceContext                         │ │
│ │ │ ├─ Set voiceAssignments[char]                                   │ │
│ │ │ └─ Ready to rehearse                                            │ │
│ │ │                                                                  │ │
│ │ │ ┌──────────────────────────────────────────────────────────┐   │ │
│ │ │ │ User clicks [▶ Start]                                   │   │ │
│ │ │ │ ├─ Stop existing audio                                  │   │ │
│ │ │ │ ├─ rehearsal.isPlaying = true                           │   │ │
│ │ │ │ ├─ rehearsal.isPaused = false                           │   │ │
│ │ │ │ ├─ rehearsal.index = 0                                  │   │ │
│ │ │ │ └─ Trigger useEffect → runRehearsalLine()               │   │ │
│ │ │ │                                                          │   │ │
│ │ │ │ PLAYING State ────────────────────────────────────────┐ │   │ │
│ │ │ │ ├─ runRehearsalLine() processes current line          │ │   │ │
│ │ │ │ ├─ speakLine() plays TTS audio                         │ │   │ │
│ │ │ │ ├─ If user's line and pauseMode="manual"              │ │   │ │
│ │ │ │ │  └─ isPaused = true, show "Your turn"               │ │   │ │
│ │ │ │ ├─ If pauseMode="countdown"                           │ │   │ │
│ │ │ │ │  └─ countdownInterval auto-advances                 │ │   │ │
│ │ │ │ ├─ If pauseMode="wpm"                                 │ │   │ │
│ │ │ │ │  └─ Calculate delay from word count                 │ │   │ │
│ │ │ │ ├─ Increment rehearsal.index                          │ │   │ │
│ │ │ │ └─ Loop back to runRehearsalLine()                    │ │   │ │
│ │ │ │                                                        │ │   │ │
│ │ │ │ [⏸ Pause] ────────────────────────────────────────┐  │ │   │ │
│ │ │ │ └─ isPaused = true                                │  │ │   │ │
│ │ │ │    stopAudio, clearIntervals                      │  │ │   │ │
│ │ │ │                                                    │  │ │   │ │
│ │ │ │ PAUSED State                                      │  │ │   │ │
│ │ │ │ ├─ [▶ Continue] → resume playback                │  │ │   │ │
│ │ │ │ ├─ [⏹ Stop] → reset to idle                      │  │ │   │ │
│ │ │ │ │                                                 │  │ │   │ │
│ │ │ │ └──────────────────────────────────────────────┘  │ │   │ │
│ │ │ │                                                    │ │   │ │
│ │ │ │ [End of Scene] ────────────────────────────────┐   │ │   │ │
│ │ │ │ ├─ currentSpeaker = "DONE"                    │   │ │   │ │
│ │ │ │ ├─ currentDialogue = "End of scene..."        │   │ │   │ │
│ │ │ │ └─ isPlaying = false                          │   │ │   │ │
│ │ │ │                                                │   │ │   │ │
│ │ │ │ COMPLETED State                                │   │ │   │ │
│ │ │ │ ├─ [Reset] → return to SCENES_LOADED          │   │ │   │ │
│ │ │ │ ├─ [Start] → re-play same scene               │   │ │   │ │
│ │ │ │ └─ Clear → go back to IDLE                    │   │ │   │ │
│ │ │ │                                                │   │ │   │ │
│ │ │ │ └────────────────────────────────────────────┘   │ │   │ │
│ │ │ │                                                   │ │   │ │
│ │ │ └──────────────────────────────────────────────────┘ │   │ │
│ │ │                                                       │   │ │
│ │ └──────────────────────────────────────────────────────┘   │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Scene Management Modal Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ SceneManager (Scenes Page)                                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ ┌─────────────────────────┐    ┌──────────────────────────────────┐ │
│ │ Sidebar (Collapsible)   │    │ Main Content Area                │ │
│ │ [◀ Collapse]            │    │                                  │ │
│ ├─────────────────────────┤    │ ┌────────────────────────────────┤ │
│ │                         │    │ │ SceneViewer (Default)          │ │
│ │ SceneList:              │    │ ├────────────────────────────────┤ │
│ │ - Search scenes         │    │ │ Title: Romeo's Chamber         │ │
│ │ - Filter (My/Empty)     │    │ │ Characters: [ROMEO, JULIET]    │ │
│ │ - Click scene → select  │    │ │ Set Piece: Verona - Interior  │ │
│ │                         │    │ │                                │ │
│ │ ┌─────────────────────┐ │    │ │ [Content Display with          │ │
│ │ │ ☑ All Scenes (5)    │ │    │ │  Character Highlighting]       │ │
│ │ │                     │ │    │ │                                │ │
│ │ │ • Romeo's Chamber   │◄──┐  │ │ [Edit] [Delete] [Share]        │ │
│ │ │ • Balcony Scene     │   │  │ │                                │ │
│ │ │ • Garden Oath       │   │  │ │ ──────────────────────────────│ │
│ │ │ • Tomb Scene        │   │  │ │ OR                             │ │
│ │ └─────────────────────┘   │  │ │                                │ │
│ │ [Import] [Refresh]        │  │ │ SceneEditor (Edit Mode)        │ │
│ │                           │  │ ├────────────────────────────────┤ │
│ │                           │  │ │ [Title Input]                  │ │
│ │                           │  │ │ [Content Editor]               │ │
│ │                           │  │ │ [Description Input]            │ │
│ │                           │  │ │ [Set Piece Input]              │ │
│ │                           │  │ │ [Parse Format Selector]        │ │
│ │                           │  │ │                                │ │
│ │                           │  │ │ [Save] [Cancel]                │ │
│ │                           │  │ │                                │ │
│ │                           │  │ │ ──────────────────────────────│ │
│ │                           │  │ │ OR                             │ │
│ │                           │  │ │                                │ │
│ │                           │  │ │ SceneImportForm (Import Mode)  │ │
│ │                           │  │ ├────────────────────────────────┤ │
│ │                           └─►│ │ Bulk Import Scenes             │ │
│ │ [Import] button opens        │ │ Paste screenplay/dialogue text │ │
│ │ SceneImportForm              │ │ [Mode: Single/Multiple/Auto]   │ │
│ │                              │ │ [Preview parsed scenes...]     │ │
│ │                              │ │                                │ │
│ │                              │ │ [Import All] [Cancel]          │ │
│ │                              │ │                                │ │
│ │                              │ └────────────────────────────────┘ │
│ │                              │                                  │
│ │                              │ [Edit Scene] ─→ SceneEditor      │
│ │                              │ [Delete Scene] → Confirm         │
│ │                              │ [Reorder] → Drag-and-drop       │
│ │                              │                                  │
│ └──────────────────────────────┘                                  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

State Transitions:
─────────────────

DEFAULT
  │
  ├─ Sidebar Visible: sidebarCollapsed = false
  ├─ Main: SceneViewer (selectedSceneId exists)
  └─ Mode: sceneOpenMode = "scene"
     │
     ├─ [Edit] ────► isEditingScene = true ────► SceneEditor shows
     │               │
     │               [Save] ──► updateScene() ──► SceneViewer
     │               [Cancel] ─► isEditingScene = false
     │
     ├─ [Delete] ───► deleteScene() ──► Scene removed
     │                                   │
     │                                   └─► Select next scene
     │
     ├─ [Import] ───► SceneImportForm shows
     │                 │
     │                 [Import All] ──► createScenes() ──► Scenes added
     │                 [Cancel] ───────────────────────► Form closes
     │
     └─ Sidebar
        │
        ├─ Click Scene ──► selectedSceneId = sceneId
        │                   SceneViewer loads scene
        │
        └─ Drag Scene ───► reorderScenes() ──► Order updated
```

---

## Voice/Character Management Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Cast Page + Voice Configuration                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ VoiceControlPanel                                            │   │
│ ├──────────────────────────────────────────────────────────────┤   │
│ │ Project Characters: [Project 1 ▼]                           │   │
│ │                                                              │   │
│ │ Character List:                                             │   │
│ │ ┌────────────────────────────────────────────────────────┐  │   │
│ │ │ [+] ROMEO                                              │  │   │
│ │ │     Voice: Kokoro - am_puck                            │  │   │
│ │ │     Speed: 1.0x | Pitch: 1.0                           │  │   │
│ │ │     Aliases: [Romeo Montague, R. Montague]             │  │   │
│ │ │     Is My Role: ☑                                       │  │   │
│ │ │     [Edit] [Delete]                                    │  │   │
│ │ │                                                        │  │   │
│ │ │ [+] JULIET                                             │  │   │
│ │ │     Voice: Browser - Google US English Female          │  │   │
│ │ │     Speed: 0.9x | Pitch: 1.2                           │  │   │
│ │ │     Aliases: [Juliet Capulet]                          │  │   │
│ │ │     Is My Role: ☑                                       │  │   │
│ │ │     [Edit] [Delete]                                    │  │   │
│ │ │                                                        │  │   │
│ │ │ [+] FRIAR LAWRENCE                                     │  │   │
│ │ │     Voice: Kokoro - am_fenrir                          │  │   │
│ │ │     Speed: 0.8x | Pitch: 0.9                           │  │   │
│ │ │     Aliases: [Friar, Brother Lawrence]                 │  │   │
│ │ │     Is My Role: ☐                                       │  │   │
│ │ │     [Edit] [Delete]                                    │  │   │
│ │ └────────────────────────────────────────────────────────┘  │   │
│ │ [+ Add Character]                                           │   │
│ │                                                              │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌─────────────────────────────┐  ┌─────────────────────────────┐   │
│ │ Edit Character Modal        │  │ TTS Settings Panel          │   │
│ ├─────────────────────────────┤  ├─────────────────────────────┤   │
│ │ Character Name: [Romeo___] │  │ Provider: [Kokoro ▼]        │   │
│ │ Aliases: [Romeo M., R.]     │  │                             │   │
│ │                             │  │ Kokoro Device: [WASM ▼]     │   │
│ │ TTS Provider:               │  │ Default Voice: [am_puck ▼]  │   │
│ │ ○ Browser                   │  │                             │   │
│ │ ○ Kokoro                    │  │ OR                          │   │
│ │ ○ API                       │  │                             │   │
│ │                             │  │ API URL: [custom.ai...]     │   │
│ │ Voice: [am_puck ▼]          │  │ API Type: [ElevenLabs ▼]    │   │
│ │ Speed: [1.0________]        │  │ API Key: [•••••••••]        │   │
│ │ Pitch: [1.0________]        │  │ Default Voice: [male_1 ▼]  │   │
│ │ Is My Role: ☑               │  │                             │   │
│ │                             │  │ Audio Cache:                │   │
│ │ [Preview] [Save] [Cancel]   │  │ ☑ Enable Caching           │   │
│ │                             │  │ [Backup] [Restore]          │   │
│ └─────────────────────────────┘  │ [Clear Cache]               │   │
│                                   │                             │   │
│                                   │ Preview Text:              │   │
│                                   │ [Hello, this is test...]    │   │
│                                   │                             │   │
│                                   │ [Apply Settings]            │   │
│                                   └─────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Cross-Page Communication:
─────────────────────────

UnifiedRehearsalPage                Cast Page
        │                              │
        │ Save voice to cast           │
        │ [💾 Save to Cast] ──────────►│
        │                              │
        │ Character + Voice settings   │
        │ + apiVoiceAssignments        │
        │                              │
        │ ↓ (via VoiceContext)         │
        │                              │
        ├──────────────────────────────┤
        │ createCastVoiceConfig()      │
        │ updateCastVoiceConfig()      │
        └──────────────────────────────┘
                    │
                    ▼
            VoiceContext
         (In-Memory Storage)
```

---

## Project Lifecycle Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ Project Management Flow                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Application Start                                               │
│      │                                                           │
│      ├─ Load projects from localStorage                         │
│      ├─ Load currentProjectId from localStorage                 │
│      │                                                           │
│      ▼                                                           │
│ NO PROJECTS ◄─┐  ┌─ PROJECTS EXIST                            │
│      │        │  │       │                                      │
│      │        │  │       ├─ ProjectSelector in header          │
│      │        │  │       │  Shows dropdown of projects          │
│      │        │  │       │                                      │
│      │        │  │       ├─ Click project → selectProject()    │
│      │        │  │       │  currentProjectId = projectId       │
│      │        │  │       │                                      │
│      │        │  │       └─ All pages filter by projectId      │
│      │        │  │           (scenes, characters, etc.)         │
│      │        │  │                                              │
│      │    ┌───┴──▼─────────────┐                               │
│      │    │ CREATE PROJECT     │                               │
│      ▼    │                    │                               │
│ [+] New  │ ProjectManager     │                               │
│ Project  │ or on creation    │                               │
│ Form     │ [+ Create New]    │                               │
│      │    │                    │                               │
│      │    ├─ Form:             │                               │
│      │    │ - Name (required)  │                               │
│      │    │ - Description      │                               │
│      │    │ - Type (Theater,   │                               │
│      │    │   Film, Comedy)    │                               │
│      │    │                    │                               │
│      │    └─ [Create]          │                               │
│      │       └─ createProject()│                               │
│      │          ├─ Generate ID │                               │
│      │          ├─ Save to LS  │                               │
│      │          ├─ Auto-select │                               │
│      │          │              │                               │
│      └──────────┤ Project      │                               │
│               │ Created       │                               │
│               └────────────────┘                               │
│                    │                                           │
│                    ▼                                           │
│          SELECTED PROJECT ACTIVE                              │
│          (currentProjectId set)                               │
│                    │                                           │
│    ┌───────────────┼───────────────────┐                     │
│    │               │                   │                     │
│    ▼               ▼                   ▼                     │
│ Import         Create Scenes      Cast Setup               │
│ Scenes         Rehearse           Voice Config             │
│                                                             │
│    ├─────────────────────────────────┤                     │
│    │                                 │                     │
│    ▼                                 ▼                     │
│ [Delete Project]              [Rename Project]             │
│ ├─ If current: switch         └─ renameProject()           │
│ │  to another               Validates name change         │
│ ├─ deleteProject()           Updates localStorage          │
│ └─ localStorage updated                                     │
│                                                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## Context Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│ Context Providers & Data Flow                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ProjectContext                                                │
│ ┌──────────────────────────────────────┐                     │
│ │ State:                               │                     │
│ │ - projects: Project[]                │                     │
│ │ - currentProjectId: string | null    │                     │
│ │                                      │                     │
│ │ Methods (exported):                  │                     │
│ │ - createProject(name, desc, type)    │                     │
│ │ - deleteProject(id)                  │                     │
│ │ - selectProject(id)                  │                     │
│ │ - renameProject(id, name)            │                     │
│ │ - getCurrentProject() → Project      │                     │
│ │                                      │                     │
│ │ Listeners:                           │                     │
│ │ - ProjectSelector                   │                     │
│ │ - ProjectManager                    │                     │
│ │ - All child pages                   │                     │
│ └──────────────────────────────────────┘                     │
│                │                                              │
│                └──► Used by:                                  │
│                    - SceneManager                             │
│                    - VoiceControlPanel                        │
│                    - UnifiedRehearsalPage                     │
│                    - All dashboard pages                      │
│                                                               │
│ SceneContext (IndexedDB)                                     │
│ ┌──────────────────────────────────────┐                     │
│ │ State:                               │                     │
│ │ - scenes: Scene[]  [persisted IDB]   │                     │
│ │                                      │                     │
│ │ Methods (exported):                  │                     │
│ │ - createScene(projectId, ...)        │                     │
│ │ - createScenes(projectId, [...])     │                     │
│ │ - updateScene(id, updates)           │                     │
│ │ - deleteScene(id)                    │                     │
│ │ - deleteScenes(ids)                  │                     │
│ │ - getProjectScenes(projectId)        │                     │
│ │ - reorderScenes(projectId, ids)      │                     │
│ │                                      │                     │
│ │ Listeners:                           │                     │
│ │ - SceneManager                      │                     │
│ │ - UnifiedRehearsalPage              │                     │
│ │ - VoiceControlPanel                 │                     │
│ └──────────────────────────────────────┘                     │
│                │                                              │
│                └──► Used by:                                  │
│                    - Scene import/management                  │
│                    - Rehearsal scene loading                  │
│                    - Character extraction                     │
│                                                               │
│ VoiceContext                                                 │
│ ┌──────────────────────────────────────┐                     │
│ │ State:                               │                     │
│ │ - voiceConfigs: VoiceConfig[]        │                     │
│ │ - characters: Character[]            │                     │
│ │                                      │                     │
│ │ Methods (exported):                  │                     │
│ │ - createVoiceConfig(char, voice)     │                     │
│ │ - getVoiceConfig(id)                 │                     │
│ │ - updateVoiceConfig(id, updates)     │                     │
│ │ - getVoiceConfigByCharacter(char)    │                     │
│ │ - getProjectCharacters(projectId)    │                     │
│ │ - createCharacter(projectId, name)   │                     │
│ │ - updateCharacter(id, updates)       │                     │
│ │ - deleteCharacter(id)                │                     │
│ │                                      │                     │
│ │ Listeners:                           │                     │
│ │ - VoiceControlPanel                 │                     │
│ │ - UnifiedRehearsalPage              │                     │
│ │ - SceneManager                      │                     │
│ └──────────────────────────────────────┘                     │
│                │                                              │
│                └──► Used by:                                  │
│                    - Character voice config                   │
│                    - Voice assignment in rehearsal            │
│                    - Character canonicalization               │
│                                                               │
│ RehearsalContext                                             │
│ ┌──────────────────────────────────────┐                     │
│ │ State:                               │                     │
│ │ - currentSession: RehearsalSession   │                     │
│ │ - dialogueLines: DialogueLine[]      │                     │
│ │ - sceneHistory: RehearsalSession[]   │                     │
│ │                                      │                     │
│ │ Methods (exported):                  │                     │
│ │ - startRehearsalSession(config)      │                     │
│ │ - pauseRehearsalSession()            │                     │
│ │ - resumeRehearsalSession()           │                     │
│ │ - endRehearsalSession()              │                     │
│ │ - getCurrentLine() → DialogueLine    │                     │
│ │ - getNextLine() → DialogueLine       │                     │
│ │ - advanceToNextLine()                │                     │
│ │ - jumpToLine(index)                  │                     │
│ │ - getUserCharacterLines()            │                     │
│ │                                      │                     │
│ │ Listeners:                           │                     │
│ │ - UnifiedRehearsalPage              │                     │
│ └──────────────────────────────────────┘                     │
│                │                                              │
│                └──► Used by:                                  │
│                    - Rehearsal playback                       │
│                    - Line advancement                         │
│                    - Session history                          │
│                                                               │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Persistence Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│ Storage Mechanism Comparison                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ LocalStorage (Synchronous, ~5MB limit)                         │
│ ├─ theater_projects: Project[]                                │
│ │  └─ Fast project switching, lightweight                     │
│ │                                                              │
│ ├─ theater_current_project_id: string | null                  │
│ │  └─ Persists selected project across sessions               │
│ │                                                              │
│ ├─ theater_rehearsal_settings_${projectId}: {..}              │
│ │  └─ Per-project UI state (voices, selections, etc.)        │
│ │  └─ Auto-saved on every state change (debounced 500ms)      │
│ │                                                              │
│ ├─ theater_scene_list_only_my: boolean                        │
│ │  └─ Scene filter preference                                 │
│ │                                                              │
│ └─ theater_scene_list_hide_empty: boolean                     │
│    └─ Scene filter preference                                  │
│                                                                 │
│ IndexedDB (Async, ~50MB+ limit)                               │
│ ├─ theater_scenes: Scene[]                                    │
│ │  ├─ Full scene content + metadata                           │
│ │  ├─ Parsed dialogue lines (cached)                          │
│ │  ├─ Line overrides                                          │
│ │  └─ Bulk import support                                     │
│ │                                                              │
│ └─ theater_audio_cache: AudioCache[]                          │
│    ├─ Pre-generated TTS audio blobs                           │
│    ├─ Speaker, text, voice signature keys                     │
│    └─ Used for fast playback on repeat rehearsals             │
│                                                                 │
│ In-Memory (React State + Context)                             │
│ ├─ VoiceContext: voiceConfigs, characters                     │
│ │  └─ Lost on page refresh (temporary)                        │
│ │                                                              │
│ └─ RehearsalContext: currentSession, dialogueLines            │
│    └─ Lost on page navigation                                 │
│                                                                 │
│ Browser APIs                                                  │
│ ├─ Web Speech API: SpeechSynthesisUtterance                  │
│ │  └─ Native browser voices (transient)                       │
│ │                                                              │
│ ├─ Fetch API: TTS provider endpoints                         │
│ │  └─ Kokoro AI WASM, External API calls                      │
│ │                                                              │
│ └─ IndexedDB API: useIDBStorage hook                         │
│    └─ Custom hook wrapper for IDB operations                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

This comprehensive diagram suite shows:

- Complete application architecture
- Modal/panel state machines
- Data flow between contexts
- User journey workflows
- Component communication patterns
- Storage strategy

All modals and panels are interconnected through React Context, enabling seamless state management across the application.
