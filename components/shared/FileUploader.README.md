# FileUploader Component

A reusable, accessible file upload component with drag-and-drop support, file validation, and responsive design.

## Features

✅ **Drag-and-Drop**: Intuitive drag-and-drop interface with visual feedback  
✅ **Click to Browse**: Fallback file browser for traditional file selection  
✅ **File Validation**: Type and size validation with clear error messages  
✅ **Multiple Files**: Support for single or multiple file uploads  
✅ **File Management**: Remove individual files from selection  
✅ **Accessible**: Full keyboard navigation and screen reader support  
✅ **Responsive**: Mobile-friendly design with Tailwind CSS  
✅ **File Icons**: Visual file type indicators using Lucide icons  

## Requirements

This component satisfies the following requirements:
- **US-W1.3**: Submit completed work with file uploads
- **NFR-3**: Usability - Clear UI, helpful errors, mobile responsive
- **UI-1**: Writer submission page file upload functionality

## Installation

The component is already part of the project. Dependencies:
- `lucide-react` - For icons
- `@/lib/fileValidation` - File validation utilities

## Basic Usage

```jsx
import { useState } from 'react';
import FileUploader from '@/components/shared/FileUploader';

function MyComponent() {
  const [files, setFiles] = useState([]);

  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles);
    // Do something with the files
  };

  return (
    <FileUploader onFilesSelected={handleFilesSelected} />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onFilesSelected` | `(files: File[]) => void` | **Required** | Callback when files are selected or changed |
| `acceptedTypes` | `string[]` | `null` | Array of accepted MIME types (uses default if not provided) |
| `maxFileSize` | `number` | `52428800` (50MB) | Maximum file size in bytes |
| `maxFiles` | `number` | `10` | Maximum number of files allowed |
| `multiple` | `boolean` | `true` | Allow multiple file selection |

## Examples

### Single File Upload

```jsx
<FileUploader 
  onFilesSelected={handleFileSelected}
  multiple={false}
  maxFiles={1}
/>
```

### Custom File Limits

```jsx
<FileUploader 
  onFilesSelected={handleFilesSelected}
  maxFiles={5}
  maxFileSize={10 * 1024 * 1024} // 10MB
/>
```

### Form Integration

```jsx
function SubmissionForm() {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('notes', notes);
    
    await fetch('/api/submit', {
      method: 'POST',
      body: formData,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <FileUploader onFilesSelected={setFiles} />
      <textarea 
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes..."
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Accepted File Types

By default, the component accepts:
- **PDF**: `.pdf` (application/pdf)
- **Word**: `.doc`, `.docx` (application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document)
- **Text**: `.txt` (text/plain)
- **Archive**: `.zip` (application/zip, application/x-zip-compressed)

## File Validation

The component validates files on selection:

1. **File Type**: Only accepted file types are allowed
2. **File Size**: Each file must be within the size limit
3. **File Count**: Total number of files cannot exceed the limit
4. **Duplicates**: Prevents adding files with the same name

Validation errors are displayed inline with clear messages:
- "Invalid file type. Accepted types: PDF, DOC, DOCX, TXT, ZIP"
- "File size exceeds maximum limit of 50.00 MB"
- "Maximum 10 files allowed. You have X file(s) already selected."
- "File already added"

## User Interactions

### Drag and Drop
1. Drag files over the upload zone
2. Visual feedback shows the drop zone is active
3. Drop files to add them to the selection
4. Invalid files show error messages

### Click to Browse
1. Click anywhere in the upload zone
2. Native file browser opens
3. Select one or multiple files
4. Files appear in the list below

### Keyboard Navigation
- **Tab**: Navigate to upload zone or remove buttons
- **Enter/Space**: Activate upload zone or remove file
- **Escape**: (handled by browser) Close file browser

### File Removal
- Click the X button next to any file to remove it
- Keyboard users can Tab to the button and press Enter/Space

## Accessibility

The component follows WCAG 2.1 Level AA guidelines:

- ✅ **Keyboard Navigation**: All functionality accessible via keyboard
- ✅ **Focus Indicators**: Visible focus styles on interactive elements
- ✅ **ARIA Labels**: Proper labeling for screen readers
- ✅ **Role Attributes**: Semantic HTML with appropriate roles
- ✅ **Live Regions**: Error announcements via `aria-live="polite"`
- ✅ **Color Contrast**: Text meets 4.5:1 contrast ratio

### Screen Reader Announcements

- Upload zone: "File upload area. Click to browse or drag and drop files"
- Remove button: "Remove [filename]"
- Errors: Announced immediately when validation fails
- File list: "Selected files" with file count

## Styling

The component uses Tailwind CSS with dark mode support:

- Light mode: Gray borders, blue accents
- Dark mode: Dark backgrounds, lighter borders
- Hover states: Border color changes
- Drag states: Blue border and background highlight
- Focus states: Blue ring outline

### Customization

To customize styles, modify the className strings in the component:

```jsx
// Example: Change hover color
className="hover:border-purple-400" // instead of hover:border-blue-400
```

## Testing

The component includes comprehensive tests covering:

- ✅ Rendering and accessibility
- ✅ File selection (click and drag-and-drop)
- ✅ File validation (type, size, count)
- ✅ File display and icons
- ✅ File removal
- ✅ Keyboard navigation
- ✅ Error display
- ✅ Edge cases

Run tests with:
```bash
npm test -- components/shared/FileUploader.test.jsx
```

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome)

### Required Features

- File API (widely supported)
- Drag and Drop API (widely supported)
- FormData API (widely supported)

## Performance

- **File validation**: Instant (client-side)
- **File display**: Renders up to 10 files efficiently
- **Memory usage**: Minimal (files not loaded into memory until upload)

## Integration with Assignment Submission Workflow

This component is designed for the assignment submission feature:

```jsx
// In SubmissionForm.jsx
import FileUploader from '@/components/shared/FileUploader';

function SubmissionForm({ assignmentId, writerId }) {
  const [files, setFiles] = useState([]);
  const [submissionText, setSubmissionText] = useState('');

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append('assignmentId', assignmentId);
    formData.append('writerId', writerId);
    formData.append('submissionText', submissionText);
    
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch('/api/submissions/submit', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      // Handle success
    }
  };

  return (
    <div>
      <FileUploader onFilesSelected={setFiles} />
      <textarea 
        value={submissionText}
        onChange={(e) => setSubmissionText(e.target.value)}
        placeholder="Add submission notes..."
      />
      <button onClick={handleSubmit} disabled={files.length === 0}>
        Submit Work
      </button>
    </div>
  );
}
```

## Troubleshooting

### Files not appearing after selection
- Check that `onFilesSelected` callback is properly connected
- Verify files pass validation (check browser console for errors)

### Drag and drop not working
- Ensure the upload zone is not inside another draggable element
- Check browser console for JavaScript errors

### Validation errors not clearing
- Errors clear automatically after 5 seconds
- Errors also clear when files are removed

### File input not opening
- Check that the file input element exists (should be hidden but present in DOM)
- Verify no JavaScript errors are preventing the click handler

## Future Enhancements

Potential improvements for future versions:

- [ ] File preview (PDF thumbnails, image previews)
- [ ] Upload progress bars
- [ ] Chunked upload for large files
- [ ] Drag-and-drop reordering
- [ ] Camera capture on mobile
- [ ] Paste from clipboard
- [ ] Compress files before upload

## License

Part of the Blueverse project.

## Support

For issues or questions:
1. Check this README
2. Review the example file (`FileUploader.example.jsx`)
3. Run tests to verify functionality
4. Check browser console for errors

## Related Files

- `lib/fileValidation.js` - Validation utilities
- `components/shared/FileUploader.test.jsx` - Test suite
- `components/shared/FileUploader.example.jsx` - Usage examples
