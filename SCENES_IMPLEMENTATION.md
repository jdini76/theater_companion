# Scene Management Implementation Guide

## Overview

Complete scene management system for the Theater Comp application with support for importing scenes via text paste or file upload, with intelligent multi-scene parsing.

## Architecture

### Data Model

Scenes are stored with the following structure:

```typescript
interface Scene {
  id: string; // Unique identifier (scene_timestamp_random)
  projectId: string; // Associated project ID
  title: string; // Scene title/name
  content: string; // Full scene text
  description?: string; // Optional description
  order: number; // Display order within project (0-based)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

### Persistence

- Data stored in localStorage under `theater_scenes` key
- Scenes maintained separately from projects but associated via `projectId`
- Automatic persistence handled by `useLocalStorage` hook

### Context API

- `SceneContext` - Global state management for scenes
- `useScenes()` - Hook to access scene operations
- `SceneProvider` - Context provider (added to root layout)

## Key Features

### 1. Scene Parsing

Automatic detection and parsing of single or multiple scenes from input text.

**Supported Formats:**

#### Single Scene

Just paste plain text - treated as one scene

#### Multiple Scenes - Format 1 (Scene Headers)

```
SCENE 1: Opening
Content of the opening scene here...
More content...

SCENE 2: Development
Content of the second scene...

SCENE 3: Climax
Content of the climax scene...
```

#### Multiple Scenes - Format 2 (Act/Scene)

```
ACT 1, SCENE 1: First Meeting
Content here...

ACT 1, SCENE 2: Conflict Emerges
Content here...

ACT 2, SCENE 1: Later That Day
Content here...
```

#### Multiple Scenes - Format 3 (Separators)

```
Content of first scene...

---

Content of second scene...

===

Content of third scene...
```

**Parser Features:**

- Case-insensitive scene detection
- Flexible spacing handling
- Multiple separator style support (---, ===, \*\*\*)
- Automatic scene numbering
- Preserves formatting within scenes

### 2. File Upload

- Accepts .txt files only
- Reads file content and applies same parsing logic
- Shows preview before committing to storage

### 3. Text Paste

- Paste directly into textarea
- Parse preview shown before creation
- Support for any of the formats above

### 4. Scene Operations

- **Create**: Add individual scene or import multiple
- **Read**: View scenes list and detailed view
- **Update**: Edit title, description, content
- **Delete**: Remove scene with automatic reordering
- **Reorder**: Change scene display order

## File Structure

```
src/
├── types/
│   └── scene.ts                    # Scene type definitions
├── lib/
│   └── scenes.ts                   # Scene business logic & parsing
├── hooks/
│   └── useSceneInput.ts           # Hook for scene input handling
├── contexts/
│   └── SceneContext.tsx           # Global scene state
├── components/
│   └── scenes/
│       ├── SceneManager.tsx       # Main container component
│       ├── SceneImportForm.tsx    # Import UI (paste/upload)
│       ├── SceneList.tsx          # Scene list view
│       ├── SceneViewer.tsx        # Full scene display
│       ├── SceneEditor.tsx        # Scene editing form
│       └── README.md              # Component documentation
└── app/
    └── (dashboard)/
        └── scenes/
            └── page.tsx           # Scenes page route
```

## Usage Examples

### Using SceneManager (Full-Featured)

```tsx
import { SceneManager } from "@/components/scenes/SceneManager";

export default function ScenesPage() {
  return <SceneManager projectId="project_123" projectName="My Play" />;
}
```

### Using SceneContext Directly

```tsx
"use client";
import { useScenes } from "@/contexts/SceneContext";

export default function MyComponent() {
  const { scenes, createScene, getProjectScenes } = useScenes();

  // Get scenes for a project
  const projectScenes = getProjectScenes("project_123");

  // Create a new scene
  const newScene = createScene(
    "project_123",
    "Scene 1: Introduction",
    "Full scene text here...",
    "Optional description",
  );

  return (
    <div>
      {projectScenes.map((scene) => (
        <div key={scene.id}>{scene.title}</div>
      ))}
    </div>
  );
}
```

### Importing Scenes with Parsing

```tsx
import { SceneImportForm } from "@/components/scenes/SceneImportForm";

export default function ImportPage() {
  return (
    <SceneImportForm
      projectId="project_123"
      onSuccess={() => console.log("Imported!")}
    />
  );
}
```

### Parsing Text Manually

```tsx
import { createScenesFromInput } from "@/lib/scenes";

const textInput = `
SCENE 1: Opening
First scene content...

SCENE 2: Development
Second scene content...
`;

const scenes = createScenesFromInput("project_123", textInput);
// Returns array of Scene objects ready to use
```

## SceneContext API

### createScene(projectId, title, content, description?)

Creates a single scene

```tsx
const scene = createScene(
  "project_123",
  "Scene 1: Opening",
  "Scene content...",
  "Optional description",
);
```

### updateScene(id, updates)

Updates an existing scene

```tsx
updateScene("scene_123", {
  title: "New Title",
  content: "Updated content...",
  description: "New description",
});
```

### deleteScene(id)

Deletes a scene and reorders remaining scenes

```tsx
deleteScene("scene_123");
```

### getProjectScenes(projectId)

Gets all scenes for a project, sorted by order

```tsx
const scenes = getProjectScenes("project_123");
```

### reorderScenes(projectId, sceneIds)

Reorders scenes within a project

```tsx
reorderScenes("project_123", ["scene_1", "scene_3", "scene_2"]);
```

## Parsing Logic Details

### Scene Detection Algorithm

1. Split input into lines
2. Search each line for scene header patterns
3. If multiple headers found, treat as multi-scene
4. If no/single header, treat entire text as one scene
5. Extract content between headers for each scene

### Pattern Matching (Case-Insensitive)

- `SCENE \d+` - "Scene 1:", "SCENE 2:", etc.
- `Scene [ivx]+` - Roman numerals "Scene I:", "SCENE II:"
- `ACT \d+.*SCENE \d+` - "Act 1, Scene 1:"
- `---+`, `===+`, `\*{3,}` - Separator lines

## Validation Rules

### Scene Title

- Required, non-empty
- Maximum 200 characters
- Trimmed before validation

### Scene Content

- Required, non-empty
- No maximum length
- Trimmed before validation

### Scene Order

- Automatically managed
- 0-based index
- Auto-reordered on deletion

## Testing

### Example Test Cases

```tsx
// Test 1: Single scene parsing
const scenes = parseScenes("Just some text");
expect(scenes).toHaveLength(1);
expect(scenes[0].title).toBe("Scene 1");

// Test 2: Multi-scene with headers
const multiText = "SCENE 1: Act\nContent\nSCENE 2: Climax\nMore content";
const multi = parseScenes(multiText);
expect(multi).toHaveLength(2);
expect(multi[0].title).toContain("Act");

// Test 3: Separator format
const sepText = "Content 1\n---\nContent 2";
const sep = parseScenes(sepText);
expect(sep).toHaveLength(2);
```

## Performance Considerations

- Scenes stored in localStorage (~5MB limit)
- Parsing is synchronous and fast (<100ms for typical scripts)
- Re-renders only affected components
- No external dependencies for parsing

## Future Enhancements

- Database persistence (Supabase integration)
- Scene collaboration and comments
- Auto-save drafts
- Scene versioning/history
- Character highlighting
- Scene-to-rehearsal linking
- Export to various formats (PDF, docx)
- Custom scene delimiters configuration
