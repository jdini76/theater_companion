# Projects Feature - Usage Guide

## Quick Start

### 1. Visit the Projects Page

Navigate to `/projects` to see the project management interface.

### 2. Create a Project

1. Click **"New Project"** button
2. Enter project name (required)
3. Add optional description
4. Click **"Create Project"**

The project is automatically selected after creation.

### 3. Switch Between Projects

- Use the **project selector dropdown** in the header to switch projects
- Click a project in the list to select it
- The current project displays in the header

### 4. Rename a Project

1. In the project list, click **"Rename"**
2. Edit the project name
3. Click **"Save"** to confirm or **"Cancel"** to discard

### 5. Delete a Project

1. In the project list, click **"Delete"**
2. Confirm the deletion in the popup
3. If you delete the current project, the app automatically selects another one

## Features

✅ **Local Persistence** - All projects saved to browser localStorage
✅ **Automatic Selection** - New projects are automatically selected
✅ **Smart Deletion** - Deleting the current project auto-selects another
✅ **Validation** - Project names validated (not empty, max 100 chars)
✅ **Timestamps** - Track when projects are created and modified
✅ **No Backend Required** - Works entirely in the browser

## Data Storage

Projects are stored in your browser's localStorage:

- **Key**: `theater_projects` (array of projects)
- **Key**: `theater_current_project_id` (selected project)

### Clear All Projects

To reset and clear all projects, open browser DevTools Console and run:

```javascript
localStorage.removeItem("theater_projects");
localStorage.removeItem("theater_current_project_id");
location.reload();
```

## Integration Points

### Using Projects in Your Components

```tsx
"use client";

import { useProjects } from "@/contexts/ProjectContext";

export function MyComponent() {
  const { getCurrentProject, projects, selectProject } = useProjects();

  const current = getCurrentProject();

  return (
    <div>
      <h1>{current?.name || "No project selected"}</h1>
      <p>Total projects: {projects.length}</p>
    </div>
  );
}
```

### Scoping Data to Current Project

The `getCurrentProject()` hook gives you the active project. Use its `id` to scope queries:

```tsx
// Example: Load rehearsals for current project
const { getCurrentProject } = useProjects();
const current = getCurrentProject();

if (current) {
  const rehearsals = await fetchRehearsalsForProject(current.id);
}
```

## Roadmap

Future enhancements:

- [ ] Cloud sync with Supabase
- [ ] Project sharing and collaboration
- [ ] Project templates
- [ ] Archive projects instead of delete
- [ ] Project settings (color, permissions, etc.)
- [ ] Recent projects quick access
- [ ] Export/import projects

## Troubleshooting

### Projects disappear after refresh

- Check if localStorage is enabled in browser
- Check browser console for errors
- Try clearing cache and localStorage

### Can't delete a project

- Make sure it's not the currently selected project
- Try refreshing the page

### Project name validation fails

- Name must not be empty
- Name must be less than 100 characters
