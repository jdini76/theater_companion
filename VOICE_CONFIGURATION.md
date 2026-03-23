# Voice Configuration & Character Role Selection Implementation

Complete role selection and character voice configuration system with clearly labeled controls for voice, rate, pitch, and mute.

## Overview

The voice configuration feature enables:

- **Character Management**: Create and manage character roles for your project
- **Voice Selection**: Choose from available system voices (text-to-speech)
- **Speed Control**: Adjust speech rate from 0.1x (very slow) to 10x (very fast)
- **Pitch Control**: Adjust voice pitch from 0 (deep) to 2 (high)
- **Volume Control**: Adjust volume from 0% to 100%
- **Mute Toggle**: Quickly mute/unmute character voices with visual feedback
- **Voice Testing**: Test voice with custom text before committing
- **Actor Assignment**: Link characters to specific actors

## Files Created

### Types

- **`src/types/voice.ts`** - Voice configuration and character role interfaces

### Context & State Management

- **`src/contexts/VoiceContext.tsx`** - Global state management for voices and characters
- **`src/hooks/useVoiceConfig.ts`** - Hook for voice configuration (optional utility)

### Utilities

- **`src/lib/voice.ts`** - Voice utilities, speech API, validation, formatting

### Components

- **`src/components/cast/VoiceControlPanel.tsx`** - Main container component
- **`src/components/cast/VoiceConfig.tsx`** - Voice configuration with all controls
- **`src/components/cast/CharacterSelector.tsx`** - Character selection and management

### Pages

- **`src/app/(dashboard)/cast/page.tsx`** - Cast page route

### Documentation

- **`src/components/cast/README.md`** - Component documentation

## Architecture

### Data Flow

```
VoiceProvider (Context)
  ├── voiceConfigs (stored voice settings)
  ├── characters (character roles)
  └── currentCharacterId (selected character)
     │
     ├── VoiceControlPanel (Main Container)
     │   ├── Character Management
     │   │   ├── Add Character Form
     │   │   └── Character List
     │   │
     │   └── VoiceConfig (Configuration Board)
     │       ├── Voice Selection Dropdown
     │       ├── Rate Slider (⚡)
     │       ├── Pitch Slider (🎵)
     │       ├── Volume Slider (🔊)
     │       ├── Mute Toggle Button (🔇)
     │       └── Test Voice Area (🎬)
```

### Storage

All data persists to localStorage:

- `theater_voice_configs` - Voice settings
- `theater_characters` - Character roles
- `theater_current_character_id` - Selected character

### State Management Flow

```
useVoice() Hook
    │
    ├── Create Character
    │   └── Auto-creates default VoiceConfig
    │
    ├── Update Character
    │   └── Validates and updates
    │
    ├── Delete Character
    │   └── Cascades to VoiceConfig
    │
    ├── Voice Configuration
    │   ├── createVoiceConfig
    │   ├── updateVoiceConfig
    │   └── deleteVoiceConfig
    │
    └── Selection
        ├── setCurrentCharacter
        └── getCurrentCharacter
```

## Key Features & Controls

### Voice Selection (🎙️)

- **Type**: Dropdown select
- **Options**: System-available voices
- **Display**: Voice name + language (e.g., "Google US English (en-US)")
- **Label**: "🎙️ Voice" with explanatory text
- **Disabled When**: Character is muted

### Speech Rate (⚡)

- **Type**: Range slider
- **Range**: 0.1x (very slow) to 10x (very fast)
- **Default**: 1x (normal speed)
- **Display**: Current value shown as "X.Xx" (e.g., "1.5x")
- **Label**: "⚡ Speech Rate"
- **Reference Labels**: "Slow (0.1x)", "Normal (1x)", "Fast (10x)"
- **Disabled When**: Character is muted

### Pitch (🎵)

- **Type**: Range slider
- **Range**: 0 (deep voice) to 2 (high voice)
- **Default**: 1 (normal pitch)
- **Display**: Current value shown with decimal (e.g., "1.5")
- **Label**: "🎵 Pitch"
- **Reference Labels**: "Deep (0)", "Normal (1)", "High (2)"
- **Disabled When**: Character is muted

### Volume (🔊)

- **Type**: Range slider
- **Range**: 0% (silent) to 100% (full volume)
- **Default**: 100%
- **Display**: Percentage with % symbol (e.g., "75%")
- **Label**: "🔊 Volume"
- **Reference Labels**: "Silent", "Normal", "Loud"
- **Disabled When**: Character is muted

### Mute Toggle (🔇)

- **Type**: Button with state indication
- **Active State**:
  - Text: "🔊 Active"
  - Color: Cyan background
  - Description: "Character Voice Active"
- **Muted State**:
  - Text: "🔇 Muted"
  - Color: Amber background
  - Description: "Character is Muted"
- **Action**: Click to toggle mute status
- **Effect**:
  - Disables all voice controls
  - Prevents speech synthesis
  - Saves state to localStorage
- **Prominence**: Large, clearly visible button

### Test Voice (🎬)

- **Type**: Textarea with play/stop button
- **Textarea** Features:
  - Placeholder: "Enter text to hear how the character sounds"
  - Default: Auto-populated with character intro
  - Disabled when muted or speaking
- **Button States**:
  - Ready: "▶️ Play Voice" (cyan)
  - Speaking: "⏹️ Stop Speaking" (amber)
  - Muted: Disabled with alert
- **Behavior**:
  - Uses all current voice settings
  - Can stop mid-sentence
  - Error handling with user messages

## Component Usage

### VoiceControlPanel

```tsx
import { VoiceControlPanel } from "@/components/cast/VoiceControlPanel";

export default function CastPage() {
  return <VoiceControlPanel projectId="project_123" />;
}
```

**Features:**

- Character list and management
- Voice configuration panel
- Comprehensive UI layout

### VoiceConfig

```tsx
import { VoiceConfig } from "@/components/cast/VoiceConfig";

export default function ConfigPage() {
  return <VoiceConfig characterId="char_123" />;
}
```

**Can be used independently for voice-only configuration views.**

### CharacterSelector

```tsx
import { CharacterSelector } from "@/components/cast/CharacterSelector";

export default function SelectPage() {
  const handleSelect = (characterId: string) => {
    console.log("Selected:", characterId);
  };
  return <CharacterSelector projectId="project_123" onSelect={handleSelect} />;
}
```

## Context API

### useVoice() Hook

```typescript
const {
  // Data
  voiceConfigs, // VoiceConfig[]
  characters, // CharacterRole[]
  currentCharacterId, // string | null

  // Voice Config Operations
  createVoiceConfig, // (name, voice, options?) => VoiceConfig
  updateVoiceConfig, // (id, updates) => void
  deleteVoiceConfig, // (id) => void
  getVoiceConfig, // (id) => VoiceConfig | null
  getVoiceConfigByCharacter, // (name) => VoiceConfig | null

  // Character Operations
  createCharacter, // (projectId, name, desc?, actor?) => CharacterRole
  updateCharacter, // (id, updates) => void
  deleteCharacter, // (id) => void
  getProjectCharacters, // (projectId) => CharacterRole[]
  setCurrentCharacter, // (id) => void
  getCurrentCharacter, // () => CharacterRole | null
} = useVoice();
```

## Workflow

### 1. Create a Character

```tsx
const { createCharacter } = useVoice();

const character = createCharacter(
  "project_123",
  "Hamlet",
  "The Prince of Denmark",
  "John Smith",
);
// Auto-creates default voice config with this character
```

### 2. Configure Voice

```tsx
const { updateVoiceConfig, getVoiceConfig } = useVoice();

const voiceConfig = getVoiceConfig(character.voiceConfigId);
updateVoiceConfig(voiceConfig.id, {
  voiceName: "Google US English",
  rate: 1.2,
  pitch: 1.1,
  volume: 0.9,
});
```

### 3. Test Voice

```tsx
import { speakText } from "@/lib/voice";

await speakText("To be or not to be", voiceConfig);
```

### 4. Manage Characters

```tsx
const { deleteCharacter } = useVoice();
deleteCharacter(character.id); // Also deletes voice config
```

## Voice Utilities

### Speaking

```typescript
import { speakText, stopSpeaking, isSpeaking } from "@/lib/voice";

// Speak text
await speakText("Hello world", voiceConfig);

// Stop speaking
stopSpeaking();

// Check if speaking
const speaking = isSpeaking();
```

### Voice Selection

```typescript
import {
  getAvailableVoices,
  getVoicesByLanguage,
  getAvailableLanguages,
  getDefaultVoiceForLanguage,
  formatVoiceOption,
} from "@/lib/voice";

// All system voices
const allVoices = getAvailableVoices();
// [{ name: "Google US English", lang: "en-US", voiceURI: "..." }, ...]

// English voices
const englishVoices = getVoicesByLanguage("en");

// Available languages
const languages = getAvailableLanguages();
// ["en", "es", "fr", "de", ...]

// Default English voice
const defaultVoice = getDefaultVoiceForLanguage("en");

// Format for display
const formatted = formatVoiceOption(voice);
// "Google US English (en-US)"
```

### Validation

```typescript
import { validateVoiceConfig, validateCharacterName } from "@/lib/voice";

// Validate voice settings
const result = validateVoiceConfig({
  rate: 2.5,
  pitch: 1.5,
  volume: 0.8,
});
if (!result.valid) {
  console.log(result.errors);
  // ["Rate must be between 0.1 and 10"]
}

// Validate character name
const nameCheck = validateCharacterName("Hamlet");
if (!nameCheck.valid) {
  console.log(nameCheck.error);
}
```

## Integration Points

### Routes

- **`/cast`** - Main cast & voice control page (requires project selection)

### Navigation

- Added "Cast" to main navigation (already present)

### Providers

- `VoiceProvider` added to root layout
- Works alongside existing ProjectProvider and SceneProvider

### Contexts Available

- Use `useVoice()` anywhere within app to access voice state

## Data Models

### VoiceConfig

```typescript
interface VoiceConfig {
  id: string; // Unique ID (voice_timestamp_random)
  characterName: string; // Character this config is for
  voiceName: string; // Selected voice name
  rate: number; // Speech rate (0.1-10, default 1)
  pitch: number; // Pitch (0-2, default 1)
  volume: number; // Volume (0-1, default 1)
  muted: boolean; // Is muted (default false)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

### CharacterRole

```typescript
interface CharacterRole {
  id: string; // Unique ID (char_timestamp_random)
  projectId: string; // Project this character belongs to
  characterName: string; // Character name
  description?: string; // Character description
  actorName?: string; // Actor playing this role
  voiceConfigId?: string; // Linked voice config ID
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

## Browser Compatibility

- Requires Web Speech API support
- Compatible with:
  - Chrome/Chromium (all versions)
  - Firefox (45+)
  - Safari (14.1+)
  - Edge (all versions)
  - Opera (34+)
- Gracefully handles unavailable voices
- Falls back if API not supported

## Performance

- Lightweight components (minimal re-renders)
- Efficient voice selection caching
- Fast slider interactions
- No external audio library dependencies
- Uses native Web Speech API

## Error Handling

- Invalid voice config values caught by validation
- Character name validation (required, max 100 chars)
- Speech synthesis errors handled with user messages
- Missing character fallback (shows select message)
- Muted state prevents errors from muted speech

## Future Enhancements

- Voice profile presets (save favorite combinations)
- Multi-character dialogue recording
- Scene-specific character voices
- Voice analytics (most used voices)
- Custom voice profiles export/import
- Pronunciation guides per character
- Character voice for scene readings
- Batch character voice updates

## Testing the Feature

1. **Start Dev Server**

   ```bash
   npm run dev
   ```

2. **Navigate to Cast Page**
   - Go to `/projects` and create/select a project
   - Click "Cast" in navigation
   - Or directly to `/cast`

3. **Create a Character**
   - Click "+ Add" button
   - Enter character name (required)
   - Add actor name and description (optional)
   - Click "Create Character"

4. **Configure Voice**
   - Character appears in list
   - Select a voice from dropdown
   - Adjust sliders for rate, pitch, volume
   - Click "Test Voice" to hear it

5. **Test Mute**
   - Click "🔇 Muted" button
   - Controls become disabled
   - Click again to unmute

6. **Try Different Settings**
   - Different voices
   - Different rate values
   - Different pitch values
   - Test voice with custom text

## Support

For issues or questions:

1. Check browser console for errors
2. Verify Web Speech API browser support
3. Try different voice selections
4. Check localStorage is enabled
5. Verify project is selected first

## Build Status

✅ **Build**: Successful (7 routes)  
✅ **TypeScript**: All types valid  
✅ **Components**: Fully integrated  
✅ **Providers**: VoiceProvider active  
✅ **Routes**: `/cast` available
