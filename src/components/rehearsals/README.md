# Rehearsal Engine Components

The rehearsal engine provides a Full Scene mode for actors to practice scenes with automatic voice playback for non-user characters and manual pause on user lines.

## Features

- **Full Scene Mode**: Load an entire scene and rehearse through all lines
- **Manual Pause on User Lines**: Automatically pauses when it's the actor's turn to speak
- **Auto-Play Non-User Lines**: Other character lines are spoken automatically with configured voices
- **Scene Progress Tracking**: Visual progress bar shows completion percentage
- **Line Context Display**: Shows previous lines, current line (large), and next line preview
- **Voice Integration**: Uses Web Speech API for character voices with configurable rate/pitch/volume
- **Playback Control**: Play, pause, resume, skip, replay, and go back options
- **Stage Directions Support**: Recognizes and handles stage directions

## Components

### RehearsalSetup

Allows the user to select a scene and choose which character they want to play.

```tsx
<RehearsalSetup
  scenes={scenes}
  characters={characters}
  onStart={(sceneId, characterId, characterName) => {}}
  onCancel={() => {}}
/>
```

**Features:**

- Scene dropdown with character count and line information
- Character dropdown showing actor names and descriptions
- Validation to ensure selected character exists in the scene
- Scene preview showing available characters

### RehearsalLineDisplay

Displays the current dialogue in a large, readable format with context.

```tsx
<RehearsalLineDisplay
  currentLine={currentLine}
  nextLine={nextLine}
  previousLines={previousLines}
  userCharacterName={userCharacterName}
  currentLinePercentage={percentage}
/>
```

**Features:**

- Progress bar showing scene completion
- Recent lines context (last 3 lines)
- Large centered current line display
- Visual indication of whose turn it is (user vs. other characters)
- Stage direction badges
- Next line preview
- Line numbers

### RehearsalControls

Playback controls for managing the rehearsal session.

```tsx
<RehearsalControls
  currentLine={currentLine}
  isUserLine={isUserLine}
  userCharacterName={userCharacterName}
  isPlaying={isPlaying}
  isPaused={isPaused}
  voiceConfig={voiceConfig}
  onPlayLine={() => {}}
  onPause={() => {}}
  onResume={() => {}}
  onNextLine={() => {}}
  onPreviousLine={() => {}}
  onEnd={() => {}}
  autoPlayNonUserLines={true}
/>
```

**Features:**

- Previous/Next line navigation
- Play/Pause/Resume controls
- Replay current line
- Stop playback
- End rehearsal
- Status display (playing, paused, user's turn)
- Helpful tips for users
- Auto-plays non-user character lines with voice synthesis

### RehearsalPlayer

Main component that orchestrates the entire rehearsal session.

```tsx
<RehearsalPlayer
  projectId={projectId}
  scenes={scenes}
  characters={characters}
  onClose={() => {}}
/>
```

**States:**

- `setup`: Select scene and character
- `active`: Running rehearsal with line display and controls
- `complete`: Rehearsal finished with completion summary

## Context & Hooks

### useRehearsals()

Access the rehearsal engine context.

```tsx
const {
  currentSession,      // Current RehearsalSession or null
  dialogueLines,       // Parsed DialogueLine[] from scene

  startRehearsalSession,    // Start a new rehearsal
  pauseRehearsalSession,    // Pause current session
  resumeRehearsalSession,   // Resume from pause
  endRehearsalSession,      // End and save session

  getCurrentLine,           // Get current DialogueLine
  getNextLine,              // Get next DialogueLine
  getPreviousLines(count),  // Get previous N lines
  advanceToNextLine,        // Move to next line
  jumpToLine(index),        // Jump to specific line
  replayCurrentLine,        // Replay current line

  getCurrentLinePercentage, // % of scene completed (0-100)
  isCurrentLineUserLine,    // Is current line for user?
  getUserCharacterLines,    // All lines for user character
  getLinesByCharacter,      // Lines by specific character
} = useRehearsals();
```

## Data Structures

### DialogueLine

```tsx
interface DialogueLine {
  lineNumber: number;
  character: string; // Character name or "[Stage Direction]" or "[Narrative]"
  dialogue: string; // The actual line or direction
  isUserLine?: boolean; // Set by rehearsal context
  isStageDirection?: boolean; // Marked by parser
}
```

### RehearsalSession

```tsx
interface RehearsalSession {
  id: string;
  projectId: string;
  sceneId: string;
  userCharacterId: string;
  userCharacterName: string;
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
  currentLineIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
}
```

## Dialogue Parsing

The rehearsal engine automatically parses scene content to identify character lines.

### Supported Formats

**Standard Dialogue Format:**

```
CHARACTER NAME: This is what they say.
```

**Stage Directions:**

```
[Character exits stage left]
(pauses dramatically)
```

**Narrative:**

```
The scene begins in the morning sun.
```

### Character Name Detection

- All-caps words or title case (e.g., ROMEO, Juliet)
- Max 50 characters
- No URLs, emails, or special characters

## Workflow

1. **Start Rehearsal:**
   - User selects a scene
   - User selects which character they're playing
   - System parses scene dialogue lines

2. **Rehearse:**
   - Auto-plays first non-user character line with voice
   - System auto-pauses when reaching user's line
   - User reads their line and clicks "Next Line"
   - System advances and plays next non-user line
   - Repeat until scene completion

3. **Controls:**
   - User can pause/resume at any time
   - Skip forward or go back to review lines
   - Stop and end the rehearsal anytime
   - Replay lines they struggle with

4. **Completion:**
   - When reaching end of scene, show completion screen
   - User can rehearse another scene or exit

## Storage

Rehearsal sessions are saved to localStorage under `theater_rehearsal_history`:

```tsx
{
  "theater_rehearsal_history": [
    {
      "id": "rehearsal_...",
      "projectId": "project_...",
      "sceneId": "scene_...",
      "userCharacterId": "char_...",
      "userCharacterName": "Romeo",
      "startedAt": "2026-03-22T...",
      "completedAt": "2026-03-22T...",
      "currentLineIndex": 45,
    }
  ]
}
```

## Browser Compatibility

- **Web Speech API:** Chrome, Edge, Safari
- **localStorage:** All modern browsers
- **Fallback:** If Web Speech API unavailable, system auto-advances without voice

## Future Enhancements

- [ ] Keyboard shortcuts for accessibility
- [ ] Recording practice sessions
- [ ] Character cue cards (show just the user's lines)
- [ ] Real-time pronunciation feedback
- [ ] Multi-actor local practice (multiple speakers)
- [ ] Voice profile presets per character
- [ ] Scene difficulty rankings
- [ ] Practice statistics and analytics
- [ ] Export practice sessions
- [ ] Speed adjustment for playback
