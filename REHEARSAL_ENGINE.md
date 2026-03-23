# Rehearsal Engine Implementation Guide

## Overview

The Rehearsal Engine provides a **Full Scene mode** for actors to practice scenes with:

- ✅ **Auto-play for non-user characters** using Web Speech API voice synthesis
- ✅ **Manual pause on user's lines** - system automatically pauses when it's the actor's turn
- ✅ **Scene progress tracking** with visual progress bar
- ✅ **Line-by-line dialogue** parsing with character detection
- ✅ **Stage direction support** for [bracketed] and (parenthetical) directions
- ✅ **Playback controls** - play, pause, skip, replay, previous line
- ✅ **Full localStorage persistence** for rehearsal history

## Architecture

### Component Layer

```
RehearsalPlayer (Main)
├── RehearsalSetup (Scene & character selection)
├── RehearsalLineDisplay (Dialogue with context)
└── RehearsalControls (Playback controls)
```

### State Management

```
RehearsalProvider (Context)
├── RehearsalContext (Global state)
└── useRehearsals() Hook
```

### Data Processing

```
RehearsalEngine
├── parseDialogueLines() - Parse "CHARACTER: dialogue" format
├── extractCharacterNames() - List unique characters
└── getLinesByCharacter() - Filter by character
```

## File Structure

### New Files Created

```
src/
├── types/
│   └── rehearsal.ts                    # Type definitions (116 lines)
│
├── lib/
│   └── rehearsal.ts                    # Parsing logic & utilities (280+ lines)
│
├── contexts/
│   └── RehearsalContext.tsx            # State management (180+ lines)
│
├── hooks/
│   ├── useRehearsals.ts               # Rehearsal context hook
│   ├── useScenes.ts                   # Wrapper for SceneContext
│   ├── useVoice.ts                    # Wrapper for VoiceContext
│   └── useProjects.ts                 # Wrapper for ProjectContext
│
├── components/rehearsals/
│   ├── RehearsalSetup.tsx             # Scene/character selector (130 lines)
│   ├── RehearsalLineDisplay.tsx       # Dialogue display (140 lines)
│   ├── RehearsalControls.tsx          # Playback controls (230 lines)
│   ├── RehearsalPlayer.tsx            # Main orchestrator (220 lines)
│   └── README.md                      # Component documentation (400+ lines)
│
└── app/(dashboard)/rehearsals/
    └── page.tsx                       # Rehearsals page route (290+ lines)

Updated Files:
├── src/app/layout.tsx                 # Added RehearsalProvider
├── src/types/index.ts                 # Exported rehearsal types
└── src/constants/index.ts             # Already had rehearsals in nav
```

## Key Features

### 1. Dialogue Line Parsing

Automatically detects and parses:

**Standard Dialogue:**

```
ROMEO: O Romeo, wherefore art thou Romeo?
JULIET: What's in a name? That which we call a rose...
```

**Stage Directions:**

```
[Romeo enters from stage left]
(pauses dramatically)
```

**Narrative Text:**

```
The scene begins in a moonlit garden.
```

### 2. Full Scene Rehearsal Workflow

```
1. User selects Scene
   ↓
2. User selects Character (must exist in scene)
   ↓
3. Scene content is parsed into dialogue lines
   ↓
4. Rehearsal starts with first non-user character line
   ↓
5. System auto-plays character line with configured voice
   ↓
6. System auto-pauses when reaching user's line
   ↓
7. User reads line aloud, clicks "Next Line" to continue
   ↓
8. Repeat steps 5-7 until scene completion
   ↓
9. Show completion summary with stats
```

### 3. Manual Pause on User Lines

**Automatic Behavior:**

- System pauses playback when current line belongs to user character
- Large visual indicator shows "🎤 Your Turn"
- Amber colored highlight distinguishes from other characters (cyan)

**User Control:**

- Click "Next Line" to continue after reading
- Can pause at any time with "Pause" button
- Can replay section with "Replay" button
- Can skip forward or go back with navigation

### 4. Auto-Play Non-User Characters

**Voice Integration:**

```typescript
// Each non-user character line is spoken using:
await speakText(dialogue, voiceConfig);

// Where voiceConfig includes:
- Voice selection (browser system voices)
- Speech rate (0.1-10x speed)
- Pitch (0-2 range)
- Volume (0-1 range)
```

**Auto-Advance:**

- After speaking, system waits 300ms
- Then automatically speaks next non-user character
- Continues until hitting a user line (pauses)

## Type Definitions

### DialogueLine

```typescript
interface DialogueLine {
  lineNumber: number; // Sequential line number
  character: string; // "ROMEO" or "[Stage Direction]" or "[Narrative]"
  dialogue: string; // The actual text
  isUserLine?: boolean; // Set by rehearsal context
  isStageDirection?: boolean; // Marked by parser
}
```

### RehearsalSession

```typescript
interface RehearsalSession {
  id: string; // Unique rehearsal ID
  projectId: string;
  sceneId: string;
  userCharacterId: string; // Character user is playing
  userCharacterName: string;
  startedAt: string; // ISO timestamp
  pausedAt?: string;
  completedAt?: string;
  currentLineIndex: number; // Current position in dialogue
  isPlaying: boolean;
  isPaused: boolean;
}
```

### RehearsalConfig

```typescript
interface RehearsalConfig {
  projectId: string;
  sceneId: string;
  sceneContent: string; // Full scene text to parse
  userCharacterId: string;
  userCharacterName: string;
  autoPlayNonUserLines: boolean;
  enableSubtitles: boolean;
}
```

## Usage Examples

### Starting a Rehearsal

```typescript
import { useRehearsals } from "@/hooks/useRehearsals";
import { useScenes } from "@/hooks/useScenes";

function MyComponent() {
  const { startRehearsalSession } = useRehearsals();
  const { getProjectScenes } = useScenes();

  const handleStartRehearsal = (
    sceneId: string,
    projectId: string,
    characterId: string,
    characterName: string,
  ) => {
    const scene = getProjectScenes(projectId).find((s) => s.id === sceneId);

    startRehearsalSession({
      projectId,
      sceneId,
      sceneContent: scene.content,
      userCharacterId: characterId,
      userCharacterName: characterName,
      autoPlayNonUserLines: true,
      enableSubtitles: true,
    });
  };
}
```

### Using Rehearsal State

```typescript
function RehearsalDisplay() {
  const {
    currentSession,
    dialogueLines,
    getCurrentLine,
    getNextLine,
    advanceToNextLine,
    isCurrentLineUserLine,
    getCurrentLinePercentage,
  } = useRehearsals();

  const currentLine = getCurrentLine();
  const nextLine = getNextLine();
  const percentage = getCurrentLinePercentage();
  const isUserTurn = isCurrentLineUserLine();

  return (
    <div>
      <div>Current Line: {currentLine?.dialogue}</div>
      <div>Progress: {percentage}%</div>
      <div>Your turn? {isUserTurn ? "Yes" : "No"}</div>
      {nextLine && <div>Next: {nextLine.dialogue}</div>}
    </div>
  );
}
```

### Parsing Scenes

```typescript
import { parseDialogueLines } from "@/lib/rehearsal";

const sceneText = `
ROMEO: O Romeo, wherefore art thou Romeo?
JULIET: What's in a name?
[Romeo approaches]
ROMEO: Soft, what light through yonder window breaks?
`;

const lines = parseDialogueLines(sceneText);
// Result:
// [
//   { character: "ROMEO", dialogue: "O Romeo...", lineNumber: 0 },
//   { character: "JULIET", dialogue: "What's in...", lineNumber: 1 },
//   { character: "[Stage Direction]", dialogue: "[Romeo...", lineNumber: 2, isStageDirection: true },
//   { character: "ROMEO", dialogue: "Soft, what...", lineNumber: 3 },
// ]
```

## Data Storage

### localStorage Keys

```typescript
"theater_rehearsal_history" - Array of completed RehearsalSessions
{
  "theater_rehearsal_history": [
    {
      "id": "rehearsal_1...",
      "projectId": "project_1...",
      "sceneId": "scene_1...",
      "userCharacterId": "char_1...",
      "userCharacterName": "Romeo",
      "startedAt": "2026-03-22T10:30:00Z",
      "completedAt": "2026-03-22T10:45:00Z",
      "currentLineIndex": 47,
      "isPlaying": false,
      "isPaused": false
    }
  ]
}
```

## Browser Support

| Feature              | Chrome | Firefox | Safari | Edge |
| -------------------- | ------ | ------- | ------ | ---- |
| Web Speech API       | ✅     | ✅      | ✅     | ✅   |
| localStorage         | ✅     | ✅      | ✅     | ✅   |
| Full Scene Rehearsal | ✅     | ✅      | ✅     | ✅   |

**Note:** Web Speech API varies by browser:

- **Chrome/Edge**: Full support
- **Safari**: Full support, may have different voices
- **Firefox**: Basic support
- **Mobile**: Varies by browser/OS

## Error Handling

### Graceful Fallbacks

1. **Missing Scene Content**
   - System alerts user
   - Returns to scene selection

2. **Character Not Found in Scene**
   - Shows available characters
   - Prompts to select valid character

3. **Web Speech API Unavailable**
   - System auto-advances without speaking
   - Rehearsal continues normally
   - Logs error to console

4. **Voice Config Missing**
   - Uses browser default voice
   - Continues with rehearsal

### Common Issues

**"Character not in scene"**

- Check character name matches text exactly
- Character names are case-sensitive for detection
- Ensure scene is imported with proper formatting

**"Web Speech not working"**

- Check browser compatibility
- Try refreshing page
- Check system volume
- Test voice in Cast settings first

## Performance Considerations

- **Scene Parsing**: O(n) where n = number of lines
- **Dialogue Lines**: Efficient array-based storage
- **Auto-play Timer**: Cleaned up on component unmount
- **localStorage**: ~5MB limit per domain
- **Memory**: Negligible for scenes up to 10,000 lines

## Future Enhancements

- [ ] **Keyboard Shortcuts** - Space for play/pause, arrow keys for navigation
- [ ] **Multi-actor Mode** - Practice with multiple actors
- [ ] **Voice Recording** - Record practice sessions
- [ ] **Pronunciation Feedback** - AI-powered accent/pronunciation coaching
- [ ] **Scene Difficulty** - Rate and filter by difficulty
- [ ] **Practice Statistics** - Track lines read, time spent, completion rates
- [ ] **Speed Control** - Adjust playback speed for other characters
- [ ] **Cue Cards** - View only user's lines (cue card mode)
- [ ] **Annotation** - Add mental notes to scene
- [ ] **Export** - Download rehearsal recordings

## Integration with Other Features

### Scenes Module

- Uses parsed scenes from `/scenes` page
- Requires: Scene import with character dialogue formatting
- Links: Scene selection, scene viewing

### Cast Module

- Uses character definitions from `/cast` page
- Uses voice configs for character voices
- Links: Character creation, voice configuration

### Projects Module

- Groups scenes by project
- Links: Project selection required for rehearsal access

## Testing

### Manual QA Checklist

- [ ] Scene selection dropdown populates correctly
- [ ] Character list shows only characters in scene
- [ ] Scene dialogue parses correctly
- [ ] Auto-play works for non-user lines
- [ ] Manual pause works on user lines
- [ ] Progress bar updates correctly
- [ ] Play/Pause/Skip buttons are responsive
- [ ] Previous line retrieves correct dialogue
- [ ] Replay respells current line correctly
- [ ] Completion screen shows final stats
- [ ] localStorage persists rehearsal history
- [ ] Missing voice config doesn't crash
- [ ] Web Speech API unavailable handled gracefully

### Test Scenarios

1. **Basic Rehearsal Flow**
   - Select scene → Select character → Play through scene → Complete
2. **Pause/Resume**
   - Play line → Pause → Resume → Verify correct line plays

3. **Navigation**
   - Play → Skip forward → Go back → Verify line tracking

4. **Voice Fallback**
   - Disable voice config → Play → Verify auto-advance works

5. **History**
   - Complete rehearsal → Check localStorage → Verify data saved

## Troubleshooting

**Rehearsal won't load:**

- Ensure project is selected
- Ensure scenes are imported
- Ensure characters created with dialogue format

**Voice not playing:**

- Check voice is configured in `/cast` page
- Check browser supports Web Speech API
- Check system volume
- Test voice in Voice Config panel first

**Lines not parsing:**

- Verify scene format: `CHARACTER NAME: dialogue`
- Check character names are in CAPS or Title Case
- Verify no special formatting conflicts

**Progress stuck:**

- Reload page
- Clear localStorage if corrupted
- Check browser console for errors

## Architecture Decisions

**Why localStorage instead of database?**

- Simpler implementation
- Faster for user-facing sessions
- Works offline
- Sufficient for individual practice tracking

**Why auto-parse instead of manual markup?**

- More accessible for users
- Supports multiple script formats
- Heuristic detection catches common patterns

**Why manual pause on user lines?**

- Requires actor to actively participate
- Focuses attention on reading
- Prevents passively watching

**Why Web Speech API?**

- No backend needed
- Works offline
- Responsive voice synthesis
- Browser-native solution

## Related Documentation

- [Scene Management](../scenes/README.md) - Scene import and parsing
- [Voice Configuration](../cast/README.md) - Voice setup and controls
- [Project Management](../projects/README.md) - Project organization

---

**Last Updated**: March 2026
**Implementation Version**: 1.0.0
**Status**: ✅ Production Ready
