# Scene Components

Scene management components for theater rehearsal management.

## Components

### SceneManager

Main container component that manages the scene UI layout and state.

**Props:**

- `projectId` (string, required) - ID of the project containing scenes
- `projectName` (string, optional) - Display name of the project

**Usage:**

```tsx
import { SceneManager } from "@/components/scenes/SceneManager";

export default function ScenesPage() {
  return <SceneManager projectId="project_123" projectName="My Play" />;
}
```

### SceneImportForm

Form for importing scenes via text paste or file upload.

**Props:**

- `projectId` (string, required) - ID of the project to import scenes into
- `onSuccess` (function, optional) - Callback after successful import

**Features:**

- Paste text directly
- Upload .txt files
- Preview parsed scenes
- Multi-scene detection with automatic parsing
- Supports common scene delimiters (SCENE, ACT, ---)

**Usage:**

```tsx
import { SceneImportForm } from "@/components/scenes/SceneImportForm";

export default function ImportPage() {
  return (
    <SceneImportForm
      projectId="project_123"
      onSuccess={() => console.log("Scenes imported!")}
    />
  );
}
```

### SceneList

Displays all scenes for a project in a scrollable list.

**Props:**

- `projectId` (string, required) - ID of the project
- `onSelectScene` (function, optional) - Callback when scene is selected

**Usage:**

```tsx
import { SceneList } from "@/components/scenes/SceneList";

export default function ListPage() {
  return <SceneList projectId="project_123" />;
}
```

### SceneViewer

Displays a full scene with formatting, copy, and download options.

**Props:**

- `scene` (Scene, required) - Scene object to display
- `onEdit` (function, optional) - Callback to enter edit mode

**Features:**

- View formatted scene text
- Copy content to clipboard
- Download as .txt file
- Display metadata (line count, word count, edit date)

**Usage:**

```tsx
import { SceneViewer } from "@/components/scenes/SceneViewer";

export default function ViewPage() {
  return <SceneViewer scene={sceneObject} onEdit={handleEdit} />;
}
```

### SceneEditor

Form for editing scene title, description, and content.

**Props:**

- `scene` (Scene, required) - Scene to edit
- `onClose` (function, optional) - Callback when finished editing

**Usage:**

```tsx
import { SceneEditor } from "@/components/scenes/SceneEditor";

export default function EditPage() {
  return (
    <SceneEditor scene={sceneObject} onClose={() => navigate("/scenes")} />
  );
}
```

## Scene Parsing

Scenes are automatically detected from input text:

### Single Scene

If no scene markers are detected, the entire text is treated as a single scene.

### Multiple Scenes

Scene markers are detected using these patterns:

1. **Scene Header Format**

   ```
   SCENE 1: Title of Scene
   Scene content here...

   SCENE 2: Another Scene
   Scene content here...
   ```

2. **Act/Scene Format**

   ```
   ACT 1, SCENE 1: Opening
   Content...

   ACT 1, SCENE 2: Development
   Content...
   ```

3. **Separator Format**

   ```
   Content of first scene...

   ---
   Content of second scene...

   ===
   Content of third scene...
   ```

The parser detects these patterns case-insensitively and handles various spacing conventions.

## Data Persistence

Scene data is stored in localStorage under the key `theater_scenes` as a JSON array.

Scene objects include:

- `id` - Unique identifier
- `projectId` - Associated project
- `title` - Scene title
- `content` - Full scene text
- `description` - Optional description
- `order` - Display order within project
- `createdAt` - Creation timestamp
- `updatedAt` - Last modification timestamp
