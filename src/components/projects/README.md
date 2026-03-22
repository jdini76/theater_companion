# Project Components

Components for managing theater projects with local persistence.

## Overview

The projects system allows users to create, manage, rename, and delete theater projects. All data is persisted to browser localStorage, so projects are saved between sessions.

## Architecture

### Type System (`src/types/project.ts`)
- `Project` - Core project interface with id, name, description, timestamps
- `ProjectContextType` - Context API type for project state management

### Utilities (`src/lib/projects.ts`)
- `createProject()` - Factory function to create new projects
- `renameProject()` - Rename an existing project
- `validateProjectName()` - Validation logic for project names
- `findProject()` - Search for a project by ID
- `sortProjectsByUpdated()` - Sort projects by modification date

### State Management (`src/contexts/ProjectContext.tsx`)
- `ProjectProvider` - Context provider to wrap the app
- `useProjects()` - Hook to access project state and operations

### Hooks (`src/hooks/useLocalStorage.ts`)
- `useLocalStorage()` - Generic hook for persisting state to browser localStorage

## Components

### ProjectManager
Main component that brings together all project management features.
```tsx
import { ProjectManager } from "@/components/projects/ProjectManager";

export default function ProjectsPage() {
  return <ProjectManager />;
}
```

### ProjectSelector
Dropdown component to select the active project. Perfect for placing in navigation.
```tsx
import { ProjectSelector } from "@/components/projects/ProjectSelector";

export function Header() {
  return (
    <header>
      <ProjectSelector onProjectSelected={() => console.log('selected')} />
    </header>
  );
}
```

### ProjectList
Displays all projects with inline rename and delete actions.
```tsx
import { ProjectList } from "@/components/projects/ProjectList";

export default function ProjectsPage() {
  return <ProjectList />;
}
```

### CreateProjectForm
Form for creating new projects with validation.
```tsx
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";

export function MyComponent() {
  return (
    <CreateProjectForm 
      onSuccess={() => console.log('project created')} 
    />
  );
}
```

## Usage

### Setup

1. Wrap your app with `ProjectProvider`:
```tsx
import { ProjectProvider } from "@/contexts/ProjectContext";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ProjectProvider>
          {children}
        </ProjectProvider>
      </body>
    </html>
  );
}
```

2. Use the `useProjects` hook in any client component:
```tsx
"use client";

import { useProjects } from "@/contexts/ProjectContext";

export function MyComponent() {
  const {
    projects,
    currentProjectId,
    getCurrentProject,
    createProject,
    selectProject,
    renameProject,
    deleteProject,
  } = useProjects();

  // Use the returned functions and state...
}
```

### Creating a Project
```tsx
const { createProject } = useProjects();

try {
  const newProject = createProject("My Show", "A dramatic production");
  console.log("Created:", newProject.id);
} catch (error) {
  console.error("Name validation failed:", error.message);
}
```

### Selecting a Project
```tsx
const { selectProject } = useProjects();

selectProject(projectId);
```

### Getting Current Project
```tsx
const { getCurrentProject } = useProjects();

const current = getCurrentProject();
if (current) {
  console.log("Active project:", current.name);
}
```

### Renaming a Project
```tsx
const { renameProject } = useProjects();

try {
  renameProject(projectId, "Updated Show Name");
} catch (error) {
  console.error("Failed to rename:", error.message);
}
```

### Deleting a Project
```tsx
const { deleteProject, currentProjectId } = useProjects();

if (currentProjectId === projectId) {
  console.log("Cannot delete selected project");
  return;
}

deleteProject(projectId);
```

## Storage

Projects are stored in browser localStorage under two keys:
- `theater_projects` - Array of all projects
- `theater_current_project_id` - ID of the selected project

## Validation

Project names must:
- Not be empty or whitespace-only
- Be less than 100 characters

Validation errors are thrown as exceptions with descriptive messages.

## Integration Points

The projects system is already integrated into:
- Root layout - `ProjectProvider` wraps entire app
- Header component - `ProjectSelector` in navigation
- Home page - Shows current project and quick links
- `/projects` route - Full project management page

## Testing

Run project tests:
```bash
npm test -- projects.test.ts
```

Tests cover:
- ID generation
- Project creation with metadata
- Renaming and timestamp updates
- Name validation
- Project lookup
- Sorting by modification date

