# SubmissionForm Component

A comprehensive form component that enables writers to submit completed work with files and submission notes.

## Overview

The SubmissionForm component provides the complete user interface for writers to submit their completed assignments. It integrates with the FileUploader component for file management and calls the `/api/submissions/submit` endpoint to process submissions.

## Requirements

This component satisfies the following requirements:
- **US-W1**: Submit completed work with files and notes
- **UI-1**: Writer submission page functionality
- **NFR-3**: Usability - Clear UI, mobile responsive, progress indicators

## Features

✅ **Assignment Details Display**: Read-only header showing assignment information  
✅ **File Upload Integration**: Uses FileUploader component for drag-and-drop file selection  
✅ **Submission Notes**: Optional textarea for writer comments and instructions  
✅ **Upload Progress Tracking**: Progress bars for each file during submission  
✅ **Form Validation**: Submit button disabled until at least one file is selected  
✅ **API Integration**: Calls `/api/submissions/submit` endpoint with FormData  
✅ **Success Handling**: Shows success message and redirects to assignment detail  
✅ **Error Handling**: Displays error messages for failed submissions  
✅ **Unsaved Changes Warning**: Confirmation dialog when canceling with changes  
✅ **Mobile Responsive**: Tailwind CSS responsive design for all screen sizes  
✅ **Dark Mode Support**: Full dark mode styling throughout  
✅ **Loading States**: Disables buttons and shows spinner during upload  
✅ **Accessibility**: ARIA labels, keyboard navigation, screen reader support

## Installation

The component is already part of the project at:
```
components/submissions/SubmissionForm.jsx
```

### Dependencies
- `next/navigation` - For routing
- `react-hot-toast` - For notifications
- `lucide-react` - For icons
- `@/components/shared/FileUploader` - File upload component

## Usage

### Basic Usage

```jsx
import SubmissionForm from '@/components/submissions/SubmissionForm';

function SubmitPage() {
  const assignment = {
    id: 'assignment-123',
    title: 'Essay on React Hooks',
    subject: 'Computer Science',
    deadline: '2024-12-31T23:59:59Z',
    status: 'assigned',
    budget_max: 100,
    final_price: 100,
  };

  const writerId = 'writer-456';

  return (
    <SubmissionForm
      assignment={assignment}
      writerId={writerId}
    />
  );
}
```

### With Callbacks

```jsx
import SubmissionForm from '@/components/submissions/SubmissionForm';

function SubmitPage() {
  const handleSuccess = (submissionId) => {
    console.log('Submission created:', submissionId);
    // Custom success handling
  };

  const handleCancel = () => {
    console.log('User cancelled submission');
    // Custom cancel handling
  };

  return (
    <SubmissionForm
      assignment={assignment}
      writerId={writerId}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `assignment` | `Object` | Yes | Assignment object with id, title, subject, deadline, status, budget_max, final_price |
| `writerId` | `string` | Yes | ID of the writer submitting the work |
| `onSuccess` | `Function` | No | Callback when submission succeeds (receives submissionId) |
| `onCancel` | `Function` | No | Callback when user cancels (no parameters) |

### Assignment Object Shape

```typescript
interface Assignment {
  id: string;              // UUID of the assignment
  title: string;           // Assignment title
  subject: string;         // Subject area
  deadline: string;        // ISO date string
  status: string;          // 'assigned' | 'in_progress'
  budget_max: number;      // Maximum budget
  final_price?: number;    // Agreed price (optional)
}
```

## User Flow

1. **View Assignment Details**: Assignment information displayed at the top (read-only)
2. **Select Files**: Use drag-and-drop or click to browse files
3. **Add Notes**: Optionally add submission notes in textarea
4. **Submit**: Click "Submit Work" button (disabled until files selected)
5. **Upload Progress**: See progress bars for each file during upload
6. **Success**: Success toast message appears, redirects to assignment detail
7. **Cancel**: Click "Cancel" to return (with unsaved changes confirmation)

## API Integration

The component calls the submission API endpoint:

```
POST /api/submissions/submit
```

**Request Format**: `multipart/form-data` (FormData)

**Form Fields**:
- `assignmentId`: UUID of the assignment
- `writerId`: UUID of the writer
- `submissionText`: Optional submission notes
- `file_0`, `file_1`, ...: File objects (at least one required)

**Response**:
```json
{
  "success": true,
  "submissionId": "uuid",
  "fileUrls": ["url1", "url2"],
  "revisionNumber": 1,
  "message": "Work submitted successfully!"
}
```

## Features in Detail

### Assignment Details Header

Displays assignment information in a card at the top:
- Assignment title with status badge
- Subject, deadline, and payment amount
- Responsive grid layout (stacks on mobile)
- Dark mode support

### File Upload Section

- Integrates FileUploader component
- Displays file validation errors
- Shows selected files list with remove option
- Progress bars appear during upload
- Progress is simulated (0-90%) then jumps to 100% on completion

### Submission Notes

- Optional textarea for writer comments
- Placeholder text with example
- Character limit displayed (if applicable)
- Disabled during upload

### Upload Progress

- Shows progress for each file individually
- File name and percentage displayed
- Blue progress bar with smooth animation
- Hidden until upload starts

### Form Validation

- Submit button disabled when no files selected
- Confirmation dialog before submission
- Validates required fields before API call
- Shows inline error messages

### Success Handling

- Toast notification with success message
- 800ms delay to show 100% progress
- Redirects to assignment detail page
- Calls onSuccess callback if provided

### Error Handling

- API errors displayed via toast
- Failed uploads show error message
- Upload progress cleared on error
- User can retry after error

### Unsaved Changes Protection

- Tracks if user has made changes (files or notes)
- Browser beforeunload event warns on page close
- Confirmation dialog when clicking Cancel
- Disabled during upload to prevent interruption

## Styling

The component uses Tailwind CSS with:

- **Light Mode**: White backgrounds, gray borders, blue accents
- **Dark Mode**: Dark gray backgrounds, lighter borders, blue accents
- **Responsive**: Mobile-first design with sm: and md: breakpoints
- **Transitions**: Smooth color and size transitions on hover
- **Focus States**: Blue ring outlines for accessibility

### Responsive Breakpoints

- **Mobile (<640px)**: Single column, full-width buttons, reduced padding
- **Tablet (640px-1024px)**: Maintains single column, larger padding
- **Desktop (>1024px)**: Max-width container, side-by-side buttons

## Accessibility

The component follows WCAG 2.1 Level AA guidelines:

- ✅ **Semantic HTML**: Proper form structure with labels
- ✅ **Keyboard Navigation**: All interactive elements accessible via keyboard
- ✅ **Focus Indicators**: Visible focus rings on all interactive elements
- ✅ **ARIA Labels**: Proper labeling for screen readers
- ✅ **Color Contrast**: Text meets 4.5:1 contrast ratio
- ✅ **Loading States**: Disabled states clearly communicated
- ✅ **Error Messages**: Error announcements via toast

## Testing

The component includes comprehensive tests covering:

✅ Rendering assignment details  
✅ Rendering FileUploader component  
✅ Rendering submission notes textarea  
✅ Submit button disabled/enabled states  
✅ API endpoint called with correct data  
✅ Error message display on failure  
✅ Success callback invocation  
✅ Cancel button functionality  
✅ Unsaved changes confirmation  
✅ Upload progress display  
✅ Button disabling during upload  

### Run Tests

```bash
npm test -- components/submissions/SubmissionForm.test.jsx
```

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome)

### Required Features

- FormData API (widely supported)
- Fetch API (widely supported)
- ES6+ features (modern browsers)

## Performance

- **Initial Render**: Fast, minimal dependencies
- **File Validation**: Handled by FileUploader component
- **Upload Progress**: Simulated at 500ms intervals
- **Memory Usage**: Minimal, files not loaded into memory until submission

## Integration Example

Complete page integration example:

```jsx
// app/dashboard/assignments/[id]/submit/page.jsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import SubmissionForm from '@/components/submissions/SubmissionForm';
import { useAuth } from '@/contexts/AuthContext';

export default function SubmitPage() {
  const params = useParams();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAssignment() {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', params.id)
        .single();

      if (data) setAssignment(data);
      setLoading(false);
    }

    loadAssignment();
  }, [params.id]);

  if (loading) return <div>Loading...</div>;
  if (!assignment) return <div>Assignment not found</div>;

  return (
    <div className="container mx-auto">
      <SubmissionForm
        assignment={assignment}
        writerId={user.id}
      />
    </div>
  );
}
```

## Known Issues

- Progress bars use simulated progress (not real-time upload progress)
- Large files (>50MB) may timeout on slow connections
- Browser beforeunload warning only works on some browsers

## Future Enhancements

Potential improvements for future versions:

- [ ] Real-time upload progress tracking
- [ ] Chunked uploads for large files
- [ ] Draft submission auto-save
- [ ] File preview before upload
- [ ] Drag-and-drop file reordering
- [ ] Paste files from clipboard
- [ ] Camera capture on mobile
- [ ] Compress files before upload

## Troubleshooting

### Submit button stays disabled
- Ensure at least one file is selected via FileUploader
- Check browser console for JavaScript errors

### Upload fails with timeout
- Check file sizes (max 50MB per file)
- Verify network connection
- Check Supabase Storage configuration

### Progress bars don't appear
- Check that files are properly selected
- Verify upload state is being set
- Look for errors in browser console

### Dark mode not working
- Ensure Tailwind dark mode is configured
- Check that `dark:` classes are applied
- Verify theme provider is set up

## Related Files

- `components/shared/FileUploader.jsx` - File upload component
- `app/api/submissions/submit/route.js` - API endpoint
- `lib/supabaseStorage.js` - Storage utilities
- `lib/fileValidation.js` - File validation utilities
- `components/submissions/SubmissionForm.test.jsx` - Test suite

## Support

For issues or questions:
1. Check this README
2. Review the test file for usage examples
3. Check browser console for errors
4. Verify API endpoint is working correctly

## License

Part of the Blueverse project.

---

**Status**: ✅ Complete and tested  
**Last Updated**: 2024  
**Maintainer**: Kiro AI
