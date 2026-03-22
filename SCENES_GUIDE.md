# Scene Management User Guide

## Getting Started with Scenes

Scenes are the core scripts and dialogue for your theater production. This guide shows you how to manage scenes in the Theater Comp application.

## A ccessing Scenes

1. **From Projects Page**
   - Go to Projects
   - Select a project
   - Click "Scenes" in the navigation

2. **Direct Link**
   - Once you have a project selected, click "Scenes" in the top navigation
   - Must have a project selected (redirects to Projects page otherwise)

## Creating Scenes

### Option 1: Paste Text

1. Click **+ Import Scenes**
2. Make sure **Paste Text** tab is selected
3. Paste your scene(s) into the textarea
4. Click **Parse Text**
5. Review the preview
6. Click **Create [X] Scenes**

#### Text Format Examples

**Single Scene - Just Paste Text**

```
PROFESSOR: You've successfully completed the experiment!
STUDENT: Thank you for your guidance, Professor.
PROFESSOR: Now, let's discuss the implications...
```

Result: Creates one scene titled "Scene 1"

**Multiple Scenes - Use Headers**

```
SCENE 1: The Classroom
PROFESSOR: Good morning, everyone!
STUDENT: Good morning, Professor.

SCENE 2: The Lab
PROFESSOR: This is where the magic happens.
```

Result: Creates 2 scenes - "The Classroom" and "The Lab"

**Multiple Scenes - Use Separators**

```
First scene content here...
Lines of dialogue...

---

Second scene content here...
Different location, same story...

---

Third scene content...
```

Result: Creates 3 scenes with auto-generated titles

### Option 2: Upload Text File

1. Click **+ Import Scenes**
2. Click the **Upload File** tab
3. Click the upload area to browse, or drag & drop a .txt file
4. Review the preview that appears
5. Click **Create [X] Scenes**

**Note:** Only .txt files are supported. If you have a PDF or other format, convert to text first.

## Viewing Scenes

### Scene List

- Left sidebar shows all scenes for the current project
- Scenes numbered in order
- Shows line count and word count for each scene
- Click to select and view full scene

### Scene Viewer

- Right panel shows the full selected scene
- Displays:
  - Scene title
  - Description (if added)
  - Metadata (lines, words, edit date)
  - Full formatted text

### Actions

- **Copy**: Copy scene text to clipboard
- **Download**: Download scene as .txt file
- **Edit**: Open editor to modify scene

## Editing Scenes

1. Click a scene in the list
2. Click **Edit** button
3. Modify:
   - **Title** - Scene name
   - **Description** - Optional notes about the scene
   - **Content** - The actual scene text
4. Click **Save** to save changes
5. Click **Cancel** to discard changes

## Managing Scenes

### Delete a Scene

1. Click scene in list
2. Click **Delete** button
3. Confirm deletion
4. Scene is removed and list re-orders automatically

### Scene Organization

- Scenes are automatically ordered by import order
- When you delete a scene, others automatically re-number
- Order is preserved when you return to the project

### Multiple Displays

- **Scenes Page** - Full scene management interface
- Click a scene name to view it
- All operations available from one place

## Scene Format Reference

### Supported Scene Headers

**Format 1 - Simple Scene Numbers**

```
SCENE 1: Title
SCENE 2: Another Title
SCENE 3: Final Title
```

**Format 2 - Roman numerals**

```
SCENE I: First
SCENE II: Second
SCENE III: Third
```

**Format 3 - Act and Scene**

```
ACT 1, SCENE 1: Opening
ACT 1, SCENE 2: Development
ACT 2, SCENE 1: New Location
```

**Format 4 - Multiple Case Styles**

```
scene 1: lowercase
Scene 2: Capitalized
SCENE 3: Uppercase
```

**Format 5 - Separators**

```
Content here...

---
Or use separator lines
===
Or triple equals
```

### Mixing Formats

The parser is flexible:

- Can handle mixed case
- Can handle with or without colons
- Can handle extra spacing
- Preserves all content exactly as formatted

## Tips & Tricks

### Large Scripts

For very large scripts:

1. Break them into acts or logical sections
2. Paste/upload each section separately
3. Use consistent naming for easy tracking

### Character Scripts

If pasting individual character scripts:

1. Add a header like "SCENE 1: Character Name"
2. Each character's script becomes a separate scene
3. Easy to reference during rehearsals

### Fixing Mistakes

- Use **Edit** to change titles or content
- Use **Delete** to remove a scene
- No undo - be careful with deletes

### Exporting/Sharing

- Click **Download** on any scene to save as .txt
- Share individual scenes with cast members
- Import modified versions if needed

## Common Issues

### "Only .txt files are supported"

- Your file is not a .txt (plain text) file
- Convert your document to .txt first
- Or paste the content instead of uploading

### Scenes Not Parsing Correctly

- Use standard "SCENE 1:" format
- Make sure "SCENE" is on its own line
- Try simpler headers like "---" as separators
- Check for extra spaces or unusual characters

### Project Selection Required

- You must have a project selected to manage scenes
- Go to Projects page if message appears
- Select a project and try again

## Keyboard Shortcuts

- No special keyboard shortcuts yet
- Standard browser shortcuts work (Ctrl+C, Ctrl+V, etc.)

## Next Steps

- Review imported scenes
- Edit as needed for accuracy
- Link scenes to rehearsals (future feature)
- Share with cast members
- Start using scenes in rehearsal planning

## Need Help?

- Check component README at `src/components/scenes/README.md`
- See implementation guide at `SCENES_IMPLEMENTATION.md`
- Review scene types at `src/types/scene.ts`
