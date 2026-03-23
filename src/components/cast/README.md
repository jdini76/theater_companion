# Cast & Voice Components

Character and voice management components for theater production.

## Voice Configuration Components

### VoiceControlPanel

Main container component for character and voice management.

**Props:**

- `projectId` (string, required) - The project to manage characters/voices for

**Features:**

- Create and manage characters
- Configure character voices
- Test voice settings
- Assign actors to roles
- Add character descriptions

**Usage:**

```tsx
import { VoiceControlPanel } from "@/components/cast/VoiceControlPanel";

export default function CastPage() {
  return <VoiceControlPanel projectId="project_123" />;
}
```

### VoiceConfig

Detailed voice configuration panel with all controls clearly labeled.

**Props:**

- `projectId` (string, required)
- `characterId` (string, optional) - Uses currentCharacterId if not provided

**Controls:**

- **🎙️ Voice** - Dropdown selection from available system voices
- **⚡ Speech Rate** - Slider (0.1x to 10x) with visual feedback
- **🎵 Pitch** - Slider (0 to 2) for voice pitch adjustment
- **🔊 Volume** - Slider (0-100%) with percentage display
- **🔇 Mute Toggle** - Prominently labeled button with state indication
- **🎬 Test Voice** - Custom text input and play button

All controls are clearly labeled with emoji icons and descriptive text.

### CharacterSelector

Displays and manages character selection.

**Props:**

- `projectId` (string, required)
- `onSelect` (function, optional) - Callback when character selected

**Features:**

- Character list with actor names
- Visual selection indicator
- Character descriptions
- Delete button (appears on hover)

## Voice Context API

```tsx
const {
  voiceConfigs, // All voice configurations
  characters, // All characters
  currentCharacterId, // Currently selected character ID

  // Voice operations
  createVoiceConfig, // Create new voice config
  updateVoiceConfig, // Update voice settings
  deleteVoiceConfig, // Delete voice config
  getVoiceConfig, // Retrieve voice config by ID
  getVoiceConfigByCharacter, // Get config by character name

  // Character operations
  createCharacter, // Create new character
  updateCharacter, // Update character details
  deleteCharacter, // Delete character
  getProjectCharacters, // Get all project characters
  setCurrentCharacter, // Select current character
  getCurrentCharacter, // Get selected character
} = useVoice();
```

## Voice Utilities

### Speech Functions

```tsx
import { speakText, stopSpeaking, isSpeaking } from "@/lib/voice";

// Speak text with voice configuration
await speakText("Hello, this is a test", voiceConfig);

// Stop speech
stopSpeaking();

// Check if currently speaking
const currently = isSpeaking();
```

### Voice Selection

```tsx
import {
  getAvailableVoices,
  getVoicesByLanguage,
  getAvailableLanguages,
  getDefaultVoiceForLanguage,
} from "@/lib/voice";

// All system voices
const voices = getAvailableVoices();

// Filter by language
const englishVoices = getVoicesByLanguage("en");

// Available languages
const langs = getAvailableLanguages();

// Default for language
const defaultVoice = getDefaultVoiceForLanguage("en");
```

### Validation

```tsx
import { validateVoiceConfig, validateCharacterName } from "@/lib/voice";

// Validate voice settings
const result = validateVoiceConfig({ rate: 2.5, pitch: 1.5 });

// Validate character name
const nameCheck = validateCharacterName("Hamlet");
```

## Data Models

### VoiceConfig

```typescript
interface VoiceConfig {
  id: string; // Unique ID
  characterName: string; // Character name
  voiceName: string; // Selected voice name
  rate: number; // Speech rate (0.1-10)
  pitch: number; // Pitch (0-2)
  volume: number; // Volume (0-1)
  muted: boolean; // Is muted
  createdAt: string; // Creation timestamp
  updatedAt: string; // Last update timestamp
}
```

### CharacterRole

```typescript
interface CharacterRole {
  id: string; // Unique ID
  projectId: string; // Project ID
  characterName: string; // Character name
  description?: string; // Character description
  actorName?: string; // Actor playing role
  voiceConfigId?: string; // Voice config link
  createdAt: string; // Creation timestamp
  updatedAt: string; // Last update timestamp
}
```

## Voice Control Features

### Mute Button

- **Clearly Labeled**: "🔊 Active" or "🔇 Muted"
- **Color-Coded**: Cyan when active, amber when muted
- **Descriptive Text**: Shows current state and action
- **Disables Controls**: All voice settings disabled when muted

### Sliders

- **Min/Max Labels**: Shows scale extremes
- **Value Display**: Real-time value shown above slider
- **Disabled State**: Greyed out when character muted
- **Visual Feedback**: Smooth interaction

### Test Voice

- **Custom Text**: Full textarea for any text input
- **Play/Stop Button**: Context-aware button states
- **Auto-Respects Settings**: Uses current voice configuration
- **Error Handling**: User-friendly error messages

## Usage Workflow

1. **Create Character**
   - Click "+ Add" button
   - Enter character name, actor, description
   - Voice config automatically created

2. **Configure Voice**
   - Select character from list
   - Adjust voice from dropdown
   - Set rate, pitch, volume with sliders
   - Click "Test Voice" to preview

3. **Manage Characters**
   - Click character to select
   - Hover to reveal delete button
   - Edit inline or recreate

4. **Use Characters**
   - Characters ready for scenes
   - Can be referenced in rehearsals
   - Voice settings available app-wide

## Storage

- Voice configs: `localStorage['theater_voice_configs']`
- Characters: `localStorage['theater_characters']`
- Current selection: `localStorage['theater_current_character_id']`

## Browser Support

- Requires Web Speech API support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Graceful fallback if unavailable
- Voice availability varies by system

## Integration

- **Cast Page** (`/cast`) - Main interface
- **Projects** - Characters per project
- **Scenes** - Character voices in readings (future)
- **Rehearsals** - Character notes (future)

## Future Enhancements

- Scene-specific character readings
- Dialogue recording with characters
- Voice profile presets
- Character voice export/import
- Pronunciation guides
- Multi-character conversations
