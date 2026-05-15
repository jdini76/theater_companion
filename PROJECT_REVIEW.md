# Theater Rehearsal Manager - Comprehensive Project Review

## Project Overview

**Theater Rehearsal Manager** is a modern web-based platform for managing theater productions, rehearsals, and cast members. It enables actors to practice their lines with AI-powered text-to-speech, manage scenes, and track rehearsal sessions.

**Tech Stack:**

- Framework: Next.js 15+ (App Router)
- Language: TypeScript (strict mode)
- Styling: Tailwind CSS + custom component library
- Database: Supabase (PostgreSQL)
- State Management: React Context API
- Testing: Vitest + React Testing Library
- TTS: Browser API, Kokoro AI, External APIs

---

## Architecture Overview

### State Management (Contexts)

The app uses React Context for global state, organized into four main providers:

```
Root Layout
├── ProjectProvider
│   ├── projects: Project[]
│   ├── currentProjectId: string | null
│   └── Methods: createProject, deleteProject, selectProject, getCurrentProject
│
├── SceneProvider (IDB Storage)
│   ├── scenes: Scene[]
│   └── Methods: createScene, updateScene, deleteScene, getProjectScenes, reorderScenes
│
├── VoiceProvider
│   ├── voiceConfigs by character/project
│   └── Methods: getVoiceConfig, updateVoiceConfig, createVoiceConfig
│
└── RehearsalProvider
    ├── currentSession: RehearsalSession | null
    ├── dialogueLines: DialogueLine[]
    └── Methods: startRehearsalSession, pauseRehearsalSession, advanceToNextLine, etc.
```

### Storage Strategy

- **LocalStorage**: Projects (immediate, small data)
- **IndexedDB**: Scenes (persistent, structured data)
- **LocalStorage**: Per-project rehearsal settings (saves UI state)
- **Browser API**: Voice synthesis cache

---

## Component Hierarchy

### Page-Level Components

```
(dashboard)
├── /rehearse → UnifiedRehearsalPage (Main rehearsal interface)
├── /scenes → Scene management page
├── /cast → Cast management page
├── /projects → Project management page
├── /settings → Global settings page
└── /songs → Song management page
```

### Key Component Structure

#### UnifiedRehearsalPage (Core Rehearsal Interface)

- **State**: 40+ state variables managing UI, rehearsal, voices, scripts
- **Main Sections**:
  - Run Lines Panel (rehearsal playback display)
  - Load Scenes Sidebar (collapsible, 34rem wide when open)
  - Role & Options Card (character selection, pause mode)
  - Character Voices Card (TTS provider, voice assignments)

#### SceneManager (Scene Library)

- **Components**:
  - SceneList: Grid/list of scenes
  - SceneViewer: Display scene content with character highlighting
  - SceneEditor: Edit scene title, content, description, set piece
  - SceneImportForm: Bulk import scenes from screenplay/dialogue format

#### Project Management

- ProjectManager: CRUD operations for projects
- ProjectSelector: Header dropdown for project selection
- ProjectList: Project display and management

---

## UI/UX Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Theater Rehearsal Manager                     │
│                         (Header)                                  │
│  [Project Selector ▼] [Navigation Tabs]                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
            ┌───▼───┐   ┌─────▼──┐   ┌────▼────┐
            │Rehearse│   │Scenes  │   │  Cast   │
            └───┬───┘   └───┬────┘   └────┬────┘
                │           │             │
        ┌───────▼────────┐  │             │
        │ Unified        │  │             │
        │ Rehearsal Page │  │             │
        └───┬──────────┬─┘  │             │
            │          │    │             │
      ┌─────▼───┐ ┌───▼──────┐           │
      │Run Lines│ │Load Scenes│           │
      │         │ │Sidebar    │           │
      └─────────┘ ├───────────┤           │
      ┌─────────┐ │From Library           │
      │Role &   │ │(Scenes/   │           │
      │Options  │ │Set Pieces)│           │
      └─────────┘ │           │           │
      ┌──────────┐│Or Paste   │           │
      │Character ││Script     │           │
      │Voices    │└───────────┘           │
      └──────────┘                        │
                            ┌─────────────▼──────────┐
                            │   Scene Manager        │
                            ├────────────────────────┤
                            │- SceneList (sidebar)   │
                            │- SceneViewer (main)    │
                            │- SceneEditor (modal)   │
                            │- SceneImportForm       │
                            └────────────────────────┘
```

---

## Modal/Panel Connection Workflow

### Primary User Journey: Rehearsing a Scene

```
1. START
   ↓
2. Project Selector
   ├─→ If no project: Create Project
   ├─→ If project exists: Select Project
   │
3. Navigate to /rehearse (UnifiedRehearsalPage)
   │
4. Load Scene (Choose Path A or B)
   │
   ├─ PATH A: Load from Scene Library
   │  ├─ Opens "Load Scenes" Sidebar
   │  ├─ Show tabs: "From Library" vs "Paste Script"
   │  ├─ Select "From Library"
   │  ├─ Choose: "Individual Scenes" or "Set Pieces"
   │  ├─ Display filterable scene list
   │  ├─ Multi-select scenes
   │  └─ Click "Load X Scenes" → Populates scenes
   │
   └─ PATH B: Paste Script
      ├─ Opens "Load Scenes" Sidebar
      ├─ Select "Paste Script" tab
      ├─ Choose mode: "Single scene" or "Multiple scenes"
      ├─ Paste script content
      ├─ Click "Load Script" or "Load Sample"
      └─ Parser extracts scenes → Populates scenes
   │
5. Auto-Expand "Run Lines" Panel & Collapse Sidebar
   │
6. "Role & Options" Card opens
   ├─ Select character from dropdown
   ├─ Choose pause mode (Manual/Countdown/WPM)
   └─ Optionally expand for more options
   │
7. "Character Voices" Card
   ├─ Select TTS Provider (Browser/Kokoro/API)
   ├─ Assign voices to each character
   ├─ Adjust rate/pitch parameters
   ├─ Preview voice with "▶ Preview" button
   └─ Save to Cast page with "💾" button
   │
8. Click "▶ Start" in Run Lines Panel
   ├─ Rehearsal begins
   ├─ Current line displays speaker and dialogue
   ├─ On user's line: Shows "Your turn" prompt
   │
9. Depending on Pause Mode:
   ├─ Manual: User clicks "▶ Continue" to advance
   ├─ Countdown: Auto-advances after N seconds
   └─ WPM: Auto-advances based on line length
   │
10. Scene complete
    └─ Display "DONE - End of scene. Nice work."
```

### Scene Management Journey

```
1. Navigate to /scenes (Scene Library Page)
   │
2. SceneManager loads
   ├─ Display project scenes in SceneList (sidebar)
   ├─ Show scene titles with character counts
   └─ Support filtering: "Only my scenes", "Hide empty scenes"
   │
3. User Selects Scene
   ├─ Scene opens in SceneViewer (main panel)
   ├─ Display: Title, content, characters, stage directions
   └─ Show character highlighting
   │
4. User Can:
   ├─ EDIT SCENE
   │  ├─ Click "Edit" → SceneEditor opens
   │  ├─ Can modify: Title, Content, Description, Set Piece
   │  ├─ Shows parse format and character extraction
   │  └─ Save changes → Updates in SceneContext
   │
   ├─ IMPORT SCENES
   │  ├─ Click "Import" → SceneImportForm opens
   │  ├─ Paste screenplay/dialogue format
   │  ├─ Select import mode (single/multiple)
   │  ├─ Parser extracts scenes and characters
   │  └─ Bulk create scenes in database
   │
   ├─ DELETE SCENE
   │  ├─ Click delete icon
   │  ├─ Scene removed from SceneContext
   │  ├─ Scenes reordered automatically
   │  └─ Scene list updates
   │
   └─ REORDER SCENES
      ├─ Drag-and-drop scenes in list
      └─ Updates order via reorderScenes()
```

### Cast & Voice Configuration Journey

```
1. Navigate to /cast (Cast Management Page)
   │
2. VoiceControlPanel displays
   ├─ List of project characters
   ├─ Show voice assignments
   └─ Display aliases and vocal settings
   │
3. User Can:
   ├─ ADD CHARACTER
   │  ├─ Input: Character name, aliases
   │  ├─ Saves to VoiceContext
   │  └─ Available in subsequent rehearsals
   │
   ├─ ASSIGN VOICE
   │  ├─ Select TTS provider (Browser/Kokoro/API)
   │  ├─ Choose voice from provider
   │  ├─ Adjust rate/pitch
   │  ├─ Preview voice
   │  └─ Saves to VoiceContext
   │
   ├─ SAVE VOICE CONFIG
   │  ├─ Can save from UnifiedRehearsalPage
   │  ├─ "💾" button saves config to cast page
   │  └─ Config persists across sessions
   │
   └─ MANAGE ALIASES
      ├─ Add alternate names for character
      ├─ Helps with scene parsing
      └─ Improves character matching in rehearsals
```

### Settings & Configuration Journey

```
1. Navigate to /settings (Settings Page)
   │
2. SettingsContent displays
   ├─ TTS Provider Configuration
   │  ├─ Browser TTS (uses Web Speech API)
   │  ├─ Kokoro AI (local TTS engine)
   │  └─ External API (custom endpoint)
   │
   ├─ Audio Cache Settings
   │  ├─ Enable/disable caching
   │  ├─ Backup/restore cache
   │  └─ Clear old cache files
   │
   ├─ Voice Playback Preview
   │  ├─ Test text for voice preview
   │  └─ Provider-specific settings
   │
   └─ Project Settings
      ├─ Production type (Theater/Film/Comedy)
      └─ Default rehearsal options
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Application State                         │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ProjectContext (localStorage)                           │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ projects: Project[]                                     │ │
│  │ currentProjectId: string | null                         │ │
│  │ Methods: createProject, selectProject, deleteProject   │ │
│  └──────────────┬──────────────────────────────────────────┘ │
│                 │                                              │
│  ┌──────────────▼──────────────────────────────────────────┐ │
│  │ SceneContext (IndexedDB)                                │ │
│  ├────────────────────────────────────────────────────────┬┤ │
│  │ scenes: Scene[]                                        ││ │
│  │ Methods: createScene, updateScene, deleteScene        ││ │
│  │ Filter: getProjectScenes(projectId)                   ││ │
│  └────────────────────────────────────────────────────────┴┘ │
│                 │                                              │
│  ┌──────────────▼──────────────────────────────────────────┐ │
│  │ VoiceContext (in-memory)                               │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ voiceConfigs: VoiceConfig[]                            │ │
│  │ Methods: getVoiceConfig, createVoiceConfig             │ │
│  │ Filter: getProjectCharacters(projectId)               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                 │                                              │
│  ┌──────────────▼──────────────────────────────────────────┐ │
│  │ RehearsalContext (in-memory)                           │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ currentSession: RehearsalSession | null               │ │
│  │ dialogueLines: DialogueLine[]                          │ │
│  │ Methods: startSession, pauseSession, advanceLine      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                                │
└──────────────────────────────────────────────────────────────┘
         │                   │                  │
         │                   │                  │
    ┌────▼──┐         ┌──────▼──┐      ┌───────▼────┐
    │Scenes │         │Projects │      │ Rehearsal  │
    │Page   │         │Page     │      │ Page       │
    └───────┘         └─────────┘      └────────────┘
```

---

## Key Features & Implementation Details

### 1. Script Parsing System

- **Modes**: Single scene, Multiple scenes, Auto-detect
- **Formats**: Screenplay, Dialogue, Mixed
- **Parser**: Detects scene headings, character names, dialogue, stage directions
- **Character Extraction**: Fuzzy matching with cast list, handles aliases

### 2. Text-to-Speech Integration

- **Browser API**: Native `SpeechSynthesisUtterance`
- **Kokoro AI**: Local WASM-based TTS engine (wasm/GPU)
- **External APIs**: Custom endpoint support (ElevenLabs, etc.)
- **Caching**: Stores generated audio locally to IndexedDB

### 3. Rehearsal Engine

- **Line Playback**: Tracks current line index, handles speaker progression
- **Pause Modes**:
  - Manual: Wait for user input
  - Countdown: Auto-advance after N seconds
  - WPM: Auto-advance based on line word count
- **Cue-Only Mode**: Only plays immediate cue before user's line
- **Voice Assignment**: Per-character voice configuration with rate/pitch

### 4. Scene Storage & Management

- **Database**: IndexedDB for persistent scene storage
- **Metadata**: Characters, set pieces, songs, line overrides
- **Ordering**: Scenes ordered per project
- **Parsing**: Caches parsed dialogue lines to avoid re-parsing

### 5. Project Management

- **LocalStorage**: Project metadata
- **Isolation**: Separate settings per project
- **Auto-selection**: Newly created projects auto-selected
- **Smart Deletion**: Switches to another project if current deleted

### 6. Voice Configuration

- **Per-Character**: Rate, pitch, voice provider, voice ID
- **Per-Project**: Different configs for different productions
- **Persistence**: Saved across sessions in VoiceContext
- **Preview**: Test voice before rehearsal

---

## Component Communication Patterns

### Direct Parent-Child

```
SceneManager
├─ SceneImportForm (modal-like)
├─ SceneList (sidebar)
├─ SceneViewer (main panel)
└─ SceneEditor (modal-like)
```

### Via Context

```
Any Component
├─ useProjects() → ProjectContext
├─ useScenes() → SceneContext
├─ useVoice() → VoiceContext
└─ useRehearsalContext() → RehearsalContext
```

### Event Propagation

```
User Action
├─ Updates local state
├─ Calls context method
├─ Context updates storage
├─ Components re-render via useContext hook
└─ UI reflects changes
```

---

## Current Known Issues & Observations

### Strengths ✅

1. **Modular Architecture**: Clear separation of concerns with contexts
2. **Flexible TTS**: Supports multiple TTS providers
3. **Persistent Storage**: IDB for scenes, localStorage for settings
4. **Rich Rehearsal Features**: Multiple pause modes, cue-only mode, voice caching
5. **Character Management**: Fuzzy matching, aliases, voice configs
6. **Project Isolation**: Settings and scenes per project

### Areas for Improvement ⚠️

1. **Large Component**: UnifiedRehearsalPage (2600+ lines) could benefit from decomposition
2. **State Complexity**: 40+ state variables in UnifiedRehearsalPage could use reducer
3. **Error Handling**: Limited error UI feedback for parsing/import failures
4. **Loading States**: Some async operations lack loading indicators
5. **Accessibility**: Limited ARIA labels and keyboard navigation hints
6. **Testing**: No visible test coverage indicators for context providers
7. **Type Safety**: Some `any` types in voice/rehearsal logic
8. **Performance**: Large scene lists may need virtualization

---

## Recommendations

### Short Term

1. Add error toast notifications for import failures
2. Add loading states for TTS provider initialization
3. Improve accessibility with ARIA labels
4. Add unit tests for context providers

### Medium Term

1. Extract UnifiedRehearsalPage into smaller components (RunLinesPanel, VoicePanel, etc.)
2. Consider moving to useReducer for complex state management
3. Add voice effect presets
4. Implement scene tagging system

### Long Term

1. Add collaborative rehearsal features (multiplayer)
2. Build rehearsal analytics (line accuracy, pacing, etc.)
3. Implement scene versioning system
4. Add AI-powered line cue system

---

## File Organization

```
src/
├── contexts/
│   ├── ProjectContext.tsx       (Project management)
│   ├── SceneContext.tsx         (Scene library, IDB storage)
│   ├── VoiceContext.tsx         (Character voices & TTS)
│   └── RehearsalContext.tsx     (Rehearsal sessions)
│
├── components/
│   ├── rehearsals/
│   │   ├── UnifiedRehearsalPage.tsx  (Main rehearsal UI)
│   │   ├── RehearsalSetup.tsx
│   │   ├── RehearsalControls.tsx
│   │   └── RehearsalLineDisplay.tsx
│   │
│   ├── scenes/
│   │   ├── SceneManager.tsx     (Scene library UI)
│   │   ├── SceneViewer.tsx      (Display scene)
│   │   ├── SceneEditor.tsx      (Edit scene)
│   │   ├── SceneList.tsx        (Scene list)
│   │   ├── SceneImportForm.tsx  (Import scenes)
│   │   └── SceneHighlight.tsx   (Character highlighting)
│   │
│   ├── cast/
│   │   ├── VoiceControlPanel.tsx
│   │   └── VoiceConfig.tsx
│   │
│   ├── projects/
│   │   ├── ProjectManager.tsx
│   │   ├── ProjectSelector.tsx
│   │   ├── ProjectList.tsx
│   │   └── CreateProjectForm.tsx
│   │
│   ├── settings/
│   │   ├── SettingsContent.tsx
│   │   └── VoiceCacheBackupPanel.tsx
│   │
│   ├── songs/
│   │   ├── SongManager.tsx
│   │   ├── SongViewer.tsx
│   │   └── SongList.tsx
│   │
│   ├── common/
│   │   ├── Header.tsx
│   │   └── OcrUploaderWrapper.tsx
│   │
│   └── ui/
│       └── Button.tsx
│
├── lib/
│   ├── projects.ts        (Project business logic)
│   ├── scenes.ts          (Scene parsing, formatting)
│   ├── rehearsal.ts       (Dialogue line parsing)
│   ├── voice.ts           (TTS integration)
│   ├── kokoro-tts.ts      (Kokoro AI wrapper)
│   ├── audio-cache.ts     (Audio caching)
│   └── data-export.ts     (Export utilities)
│
├── types/
│   ├── project.ts
│   ├── scene.ts
│   ├── rehearsal.ts
│   ├── voice.ts
│   └── line-override.ts
│
├── hooks/
│   ├── useLocalStorage.ts
│   └── useIDBStorage.ts
│
└── app/
    ├── (dashboard)/
    │   ├── rehearse/
    │   ├── scenes/
    │   ├── cast/
    │   ├── projects/
    │   ├── settings/
    │   └── songs/
    ├── layout.tsx
    └── page.tsx
```

---

## Conclusion

The Theater Rehearsal Manager is a well-architected application with sophisticated features for actor rehearsal and scene management. The context-based state management provides good scalability, and the multi-provider TTS system offers flexibility. The main opportunities for improvement lie in component decomposition, state management optimization, and enhanced error handling.

The modular design makes it easy to extend features, and the clear separation between UI, logic, and storage makes the codebase maintainable and testable.
