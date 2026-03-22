# Projects Feature - Testing Guide

## Manual Testing Checklist

### 1. Create a Project

- [ ] Navigate to `/projects`
- [ ] Click "New Project"
- [ ] Enter name: "Summer Production"
- [ ] Enter description: "2026 Summer Stage Production"
- [ ] Click "Create Project"
- [ ] Verify project appears in list below
- [ ] Verify project is selected (highlighted in blue)

### 2. Project Selector

- [ ] Verify project name appears in header dropdown
- [ ] Create another project: "Fall Rehearsals"
- [ ] Verify both projects in dropdown
- [ ] Click second project in dropdown
- [ ] Verify header shows "Fall Rehearsals"
- [ ] Verify home page shows new current project

### 3. Rename Project

- [ ] In project list, click "Rename" on a project
- [ ] Edit name to "Updated Show Name"
- [ ] Click "Save"
- [ ] Verify name updated in list
- [ ] Verify name updated in header

### 4. Delete Project

- [ ] Create a test project: "To Delete"
- [ ] Click "Delete"
- [ ] Confirm deletion
- [ ] Verify project removed from list
- [ ] Verify no errors in console

### 5. Delete Current Project

- [ ] Select a project with "Delete"
- [ ] Confirm deletion
- [ ] Verify a different project is auto-selected
- [ ] Verify header shows new current project
- [ ] No crash or errors

### 6. Persistence

- [ ] Create a project "Test Persistence"
- [ ] Refresh the page (F5)
- [ ] Verify project still exists
- [ ] Verify previously selected project still selected
- [ ] Check localStorage in DevTools:
  - [ ] `localStorage.getItem('theater_projects')` shows array
  - [ ] `localStorage.getItem('theater_current_project_id')` shows ID

### 7. Validation

- [ ] Try creating project with empty name
- [ ] Verify error message appears
- [ ] Try creating project with 101+ character name
- [ ] Verify error message appears
- [ ] Try renaming to empty name
- [ ] Verify error message appears

### 8. Navigation

- [ ] From home page, click "Create a Project" button
- [ ] Verify navigates to `/projects` page
- [ ] From `/projects`, click project name in header
- [ ] Verify updates current selection
- [ ] From home page, click "Select a Project"
- [ ] Verify navigates to `/projects`

### 9. Integration

- [ ] Home page shows current project name
- [ ] Home page shows project description
- [ ] Home page shows quick action buttons (View Rehearsals, etc.)
- [ ] Project selector in header visible and functional
- [ ] Navigation to Projects link works

## Automated Testing

Run the project tests:

```bash
npm test
```

Expected output:

- ✓ generateProjectId generates unique IDs
- ✓ createProject creates with required fields
- ✓ createProject includes optional description
- ✓ renameProject updates name and timestamp
- ✓ validateProjectName rejects empty names
- ✓ validateProjectName rejects long names
- ✓ validateProjectName accepts valid names
- ✓ findProject finds project by ID
- ✓ findProject returns null if not found
- ✓ sortProjectsByUpdated sorts correctly

## Browser DevTools Inspection

### localStorage Contents

```javascript
// View all projects
JSON.parse(localStorage.getItem("theater_projects"));

// View current selected project
localStorage.getItem("theater_current_project_id");

// Clear all data (reset app)
localStorage.clear();
```

## Common Issues & Solutions

| Issue                            | Solution                                                  |
| -------------------------------- | --------------------------------------------------------- |
| Projects disappear after refresh | Check localStorage in DevTools, verify not getting errors |
| Can't rename/delete              | Make sure project exists, check network errors            |
| Dropdown doesn't open            | Try page refresh, check console for JS errors             |
| Wrong project selected           | Try selecting different project, refresh page             |
| New project not auto-selected    | Check if there's no network errors, try again             |

## Performance Notes

- Project list loads instantly from localStorage
- No API calls needed
- Suitable for up to 1000+ projects
- For larger scale, consider migrating to Supabase

## Next Steps for Enhancement

1. **Cloud Sync**: Add Supabase integration
   - Sync projects to cloud database
   - Share projects with team members
2. **Project Settings**: Add configuration UI
   - Color themes
   - Permission levels
   - Custom metadata

3. **Project Templates**: Create preset projects
   - "Shakespearean Tragedy"
   - "Modern Comedy"
   - "Musical Production"

4. **Archiving**: Instead of deleting, allow archiving
   - Keep project data but hide from main list
   - Easier to restore if needed
