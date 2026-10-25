# Implementation Plan: Assignment Submission & Review Workflow

## Overview

This implementation plan breaks down the assignment submission and review workflow feature into discrete, sequenced tasks. The feature enables writers to submit completed work with files, students to review submissions and approve or request revisions, and implements automated payment release upon approval.

The implementation follows a layered approach:
1. **Foundation**: Database, storage policies, and utility functions
2. **Shared Components**: Reusable UI components (FileUploader, validation)
3. **Writer Flow**: Submission form and API
4. **Student Flow**: Review interface and API
5. **Payment Integration**: Stripe payment release
6. **Notifications**: In-app notification system
7. **Integration**: Wire everything together with status management

---

## Tasks

### 1. Database and Storage Foundation

- [x] 1.1 Create Supabase Storage bucket and policies
  - Create `submissions` bucket in Supabase Storage (private)
  - Set up storage policies for writer uploads
  - Set up storage policies for assignment party access (student + writer can view)
  - Set up storage policies for writer deletions
  - Verify bucket exists and policies work via test upload
  - _Requirements: FR-1, NFR-1, INT-1_

- [x] 1.2 Create utility functions for file validation
  - Create `lib/fileValidation.js` with validation functions
  - Implement `validateFileType(file)` - check MIME types
  - Implement `validateFileSize(file, maxSize)` - check size limits
  - Implement `validateFileCount(files, maxCount)` - check file count
  - Implement `getFileIcon(filename)` - return appropriate Lucide icon
  - Implement `formatFileSize(bytes)` - human-readable format
  - _Requirements: FR-1, US-W1.3_

- [x] 1.3 Write unit tests for file validation utilities
  - Test `validateFileType` with accepted types (PDF, DOC, DOCX, TXT, ZIP)
  - Test `validateFileType` with rejected types (images, executables)
  - Test `validateFileSize` with under, at, and over limits
  - Test `validateFileCount` with valid and exceeded counts
  - Test `formatFileSize` with various byte values
  - _Requirements: FR-1_

### 2. Shared Components and Utilities

- [x] 2.1 Create FileUploader component
  - Create `components/shared/FileUploader.jsx`
  - Implement drag-and-drop zone with hover states
  - Add click-to-browse fallback with file input
  - Display selected files list with remove buttons
  - Show file icons using `getFileIcon()` utility
  - Add file type and size validation on selection
  - Display validation errors inline
  - Implement accessible keyboard navigation
  - Style with Tailwind CSS for responsive design
  - _Requirements: US-W1.3, NFR-3, UI-1_

- [x] 2.2 Create Supabase Storage helper functions
  - Create `lib/supabaseStorage.js` with storage utilities
  - Implement `uploadFile(file, assignmentId, submissionId)` - upload single file
  - Implement `uploadMultipleFiles(files, assignmentId, submissionId)` - parallel uploads with progress
  - Implement `deleteFile(fileUrl)` - remove file from storage
  - Implement `getFileUrl(path)` - generate signed URL for download
  - Add error handling and rollback for failed uploads
  - _Requirements: FR-1, Design: File Upload Optimization_

- [ ] 2.3 Write integration tests for storage helpers
  - Test `uploadFile` with valid file
  - Test `uploadMultipleFiles` with partial failure (rollback behavior)
  - Test `deleteFile` removes file successfully
  - Test `getFileUrl` generates valid download URL
  - Mock Supabase client for tests
  - _Requirements: FR-1_

### 3. Writer Submission Flow

- [x] 3.1 Create submission API endpoint
  - Create `app/api/submissions/submit/route.js`
  - Implement POST handler for submission creation
  - Validate writer is assigned to assignment
  - Validate assignment status is `assigned` or `in_progress`
  - Upload files to Supabase Storage using helper functions
  - Create submission record in database with file URLs
  - Update assignment status to `under_review`
  - Return submission ID and file URLs in response
  - Add comprehensive error handling with rollback
  - _Requirements: US-W1.1, US-W1.2, US-W1.6, FR-2_

- [ ] 3.2 Create SubmissionForm component
  - Create `components/submissions/SubmissionForm.jsx`
  - Add assignment details header (read-only display)
  - Integrate FileUploader component
  - Add submission notes textarea (optional)
  - Display upload progress bars for each file
  - Disable submit button until at least one file selected
  - Implement form submission calling `/api/submissions/submit`
  - Show success message and redirect to assignment detail on completion
  - Add cancel button with unsaved changes confirmation
  - Style with Tailwind CSS for mobile responsiveness
  - _Requirements: US-W1, UI-1, NFR-3_

- [x] 3.3 Create submission page route
  - Create `app/dashboard/assignments/[id]/submit/page.jsx`
  - Fetch assignment data to display in form
  - Check writer authorization (must be assigned writer)
  - Render SubmissionForm component with props
  - Handle unauthorized access (redirect to assignment detail)
  - Add loading state while fetching data
  - _Requirements: US-W1, UI-1_

- [ ] 3.4 Add submission navigation to assignment detail page
  - Update `app/dashboard/assignments/[id]/page.jsx`
  - Add "Submit Work" button when status is `assigned` or `in_progress`
  - Show "View Submissions" button when submissions exist
  - Display current assignment status badge
  - Link to submit page (`/dashboard/assignments/[id]/submit`)
  - Only show submit button to assigned writer
  - _Requirements: US-W4_

### 4. Student Review Flow

- [ ] 4.1 Create review API endpoint
  - Create `app/api/submissions/review/route.js`
  - Implement POST handler for approval and revision requests
  - Validate student owns the assignment
  - Validate submission exists and is in `submitted` status
  - For approval: update submission to `approved`, assignment to `completed`
  - For revision: require feedback, update submission to `revision_requested`, assignment to `in_progress`
  - Store student feedback and revision notes in submission record
  - Add optimistic locking using `updated_at` timestamp to prevent concurrent updates
  - Return action result with new status
  - _Requirements: US-S3, US-S4, FR-2, FR-3, Design: Concurrent Status Changes_

- [ ] 4.2 Create SubmissionReview component
  - Create `components/submissions/SubmissionReview.jsx`
  - Display submission metadata (date, revision number, writer notes)
  - Render file list with download links and file icons
  - Add "Approve" button with confirmation modal
  - Add "Request Revision" button opening feedback form
  - Validate feedback is provided for revision requests (min 10 characters)
  - Allow optional feedback for approvals (thank you note)
  - Call `/api/submissions/review` endpoint on action
  - Show loading state during processing
  - Display success message and redirect on completion
  - Add link to messaging system
  - Style with Tailwind CSS
  - _Requirements: US-S2, US-S3, US-S4, UI-2_

- [ ] 4.3 Create submissions review page route
  - Create `app/dashboard/assignments/[id]/submissions/page.jsx`
  - Fetch assignment and current submission data
  - Check student authorization (must own assignment)
  - Render SubmissionReview component
  - Handle unauthorized access (redirect to dashboard)
  - Add loading state while fetching
  - _Requirements: US-S2, UI-2_

- [ ] 4.4 Add review navigation to student assignment view
  - Update `app/dashboard/assignments/[id]/page.jsx` for student view
  - Add "View Submission" button when status is `under_review`
  - Show "New Submission" badge for unreviewed submissions
  - Link to submissions page (`/dashboard/assignments/[id]/submissions`)
  - Display assignment status prominently
  - Only show for assignment owner (student)
  - _Requirements: US-S5_

### 5. Submission History Display

- [ ] 5.1 Create SubmissionHistory component
  - Create `components/submissions/SubmissionHistory.jsx`
  - Fetch all submissions for assignment ordered by date (newest first)
  - Display each submission with: date, status badge, revision number, notes preview
  - Show student feedback if exists
  - Render expandable file list for each submission
  - Add download links for all files
  - Highlight current submission under review
  - Style chronological timeline layout with Tailwind CSS
  - _Requirements: US-W2, US-W2.2, US-W2.3, US-W2.5_

- [ ] 5.2 Integrate SubmissionHistory into submissions page
  - Update `app/dashboard/assignments/[id]/submissions/page.jsx`
  - Add SubmissionHistory component below current submission review
  - Pass assignment ID and current user as props
  - Show revision history in collapsible accordion
  - Make accessible to both student and writer views
  - _Requirements: US-W2, US-S2_

### 6. Payment Integration

- [ ] 6.1 Create payment release API endpoint
  - Create `app/api/payments/release/route.js`
  - Implement POST handler for payment release
  - Fetch assignment and verify completion status
  - Calculate platform fee (15% default from assignment or config)
  - Calculate writer earnings (amount - platform fee)
  - Create Stripe Transfer to writer's connected account
  - Create transaction record in database with status `released`
  - Update assignment `payment_released` flag
  - Add retry logic with exponential backoff for Stripe failures
  - Log payment failures for manual review
  - Return transaction details in response
  - _Requirements: US-S3.6, FR-5, Design: Payment Release API_

- [ ] 6.2 Write integration tests for payment release
  - Test successful payment release flow
  - Test Stripe API failure with retry
  - Test writer without connected account (queue for manual processing)
  - Test transaction record creation
  - Mock Stripe client for tests
  - _Requirements: FR-5_

- [ ] 6.3 Integrate payment release into review endpoint
  - Update `app/api/submissions/review/route.js`
  - Call payment release endpoint when action is `approve`
  - Handle payment release failures gracefully (don't block approval)
  - Mark transaction for manual review if payment fails
  - Include payment status in review response
  - Add error logging for failed payments
  - _Requirements: US-S3.6, FR-5, FR-2_

### 7. Notification System

- [ ] 7.1 Create notification utility functions
  - Create `lib/notifications.js` with notification helpers
  - Implement `createNotification(userId, type, message, metadata)` - insert into notifications table
  - Implement `notifySubmissionCreated(assignmentId, submissionId)` - notify student
  - Implement `notifyRevisionRequested(assignmentId, submissionId, feedback)` - notify writer
  - Implement `notifyWorkApproved(assignmentId, submissionId)` - notify writer
  - Implement `notifyPaymentReleased(assignmentId, transactionId, amount)` - notify both parties
  - _Requirements: FR-6, US-W3.1, US-S1_

- [ ] 7.2 Integrate notifications into submission endpoint
  - Update `app/api/submissions/submit/route.js`
  - Call `notifySubmissionCreated` after successful submission
  - Include assignment and submission IDs in notification metadata
  - _Requirements: US-S1.1, US-S1.3, FR-6_

- [ ] 7.3 Integrate notifications into review endpoint
  - Update `app/api/submissions/review/route.js`
  - Call `notifyRevisionRequested` when revision is requested
  - Call `notifyWorkApproved` when work is approved
  - Call `notifyPaymentReleased` after payment release
  - Include relevant metadata (feedback, amount) in notifications
  - _Requirements: US-W3.1, FR-6_

- [ ] 7.4 Create in-app notification display component
  - Create `components/notifications/NotificationBell.jsx`
  - Display notification icon with unread count badge
  - Show dropdown with recent notifications on click
  - Mark notifications as read when viewed
  - Link to relevant pages (assignment detail, submissions)
  - Style with Tailwind CSS
  - _Requirements: US-S1, FR-6, NFR-3_

- [ ] 7.5 Add notification bell to dashboard layout
  - Update `components/dashboard/DashboardLayout.jsx`
  - Add NotificationBell component to header/navbar
  - Position in top-right corner
  - Ensure visible on all dashboard pages
  - _Requirements: US-S1.1, FR-6_

### 8. Status Management and Edge Cases

- [ ] 8.1 Add submission status validation utilities
  - Create `lib/submissionValidation.js` with status helpers
  - Implement `canSubmit(assignment, userId)` - check if user can submit
  - Implement `canReview(submission, userId)` - check if user can review
  - Implement `getNextStatus(action, currentStatus)` - calculate state transitions
  - Implement `hasActiveSubmission(assignmentId)` - check for pending submission
  - _Requirements: FR-2, FR-3, EC-1_

- [ ] 8.2 Prevent multiple concurrent submissions
  - Update `app/api/submissions/submit/route.js`
  - Check for existing submissions with status `submitted` before allowing new submission
  - Return 400 error if submission already under review
  - Add helpful error message: "Cannot submit while previous submission is under review"
  - _Requirements: EC-1_

- [ ] 8.3 Handle assignment cancellation edge case
  - Create `lib/cancellationHandler.js` with cancellation logic
  - Implement partial payment calculation (50% if submission exists)
  - Update assignment cancel endpoint to check for submissions
  - Release partial payment if submission exists but not approved
  - Add confirmation modal in UI explaining partial payment
  - _Requirements: EC-2, Design: Assignment Cancelled After Submission_

- [ ] 8.4 Add deadline handling for late submissions
  - Update submission form to show warning if past deadline
  - Allow submission even after deadline (don't block)
  - Display warning message: "This assignment is past the deadline"
  - Store submission timestamp for audit trail
  - _Requirements: EC-3_

### 9. Dashboard Integration

- [ ] 9.1 Update WriterDashboard with submission indicators
  - Update `components/dashboard/WriterDashboard.jsx`
  - Add "Submit Work" badge to assigned assignments
  - Add "Revise Work" badge for revision requests
  - Show submission status on assignment cards
  - Add quick action buttons for submit/revise
  - Display "Work Approved" indicator for completed assignments
  - _Requirements: US-W4_

- [ ] 9.2 Update StudentDashboard with review indicators
  - Update `components/dashboard/StudentDashboard.jsx`
  - Add "New Submission" badge to assignments under review
  - Show pending review count in dashboard header
  - Add quick action button to review submissions
  - Display "Completed" indicator for approved assignments
  - _Requirements: US-S5, US-S1.2_

- [ ] 9.3 Add submission metrics to dashboard overview
  - Add "Pending Reviews" count for students
  - Add "Submitted Awaiting Review" count for writers
  - Add "Completed This Week" count for both
  - Display metrics in dashboard header or summary cards
  - _Requirements: NFR-3, US-S5, US-W4_

### 10. Error Handling and User Feedback

- [ ] 10.1 Add comprehensive error handling to submission flow
  - Handle file upload failures with retry option
  - Handle network errors with user-friendly messages
  - Handle validation errors with specific field feedback
  - Add loading states for all async operations
  - Use react-hot-toast for success/error notifications
  - _Requirements: EC-4, NFR-4_

- [ ] 10.2 Add error handling to review flow
  - Handle concurrent status change conflicts (409 errors)
  - Handle payment release failures (don't block approval)
  - Show detailed error messages for validation failures
  - Add retry mechanism for transient errors
  - Use react-hot-toast for notifications
  - _Requirements: EC-5, Design: Error Handling_

- [ ] 10.3 Add loading and empty states
  - Add skeleton loaders while fetching submissions
  - Add empty state for "No submissions yet" in history
  - Add loading spinner during file uploads with progress percentage
  - Add loading state during review actions
  - Ensure all states are accessible and screen-reader friendly
  - _Requirements: NFR-3, NFR-2_

### 11. Testing and Validation

- [ ] 11.1 Write integration tests for submission workflow
  - Test complete flow: submit → review → approve → payment
  - Test revision request flow: submit → revision → resubmit → approve
  - Test concurrent submission prevention
  - Test file upload rollback on partial failure
  - Test status transitions and database updates
  - _Requirements: FR-2, Design: Integration Testing_

- [ ] 11.2 Write integration tests for edge cases
  - Test assignment cancellation with pending submission
  - Test late submission after deadline
  - Test payment release failure handling
  - Test concurrent review attempts
  - Test empty file submission prevention
  - _Requirements: EC-1 through EC-6_

- [ ] 11.3 Perform manual UI/UX testing
  - Test drag-and-drop file upload on desktop
  - Test file upload on mobile devices
  - Test keyboard navigation through forms
  - Test screen reader compatibility
  - Test responsive layouts at 375px, 768px, 1440px
  - Test all success and error states
  - Verify WCAG AA color contrast compliance
  - _Requirements: NFR-3, Design: UI/UX Testing_

### 12. Final Integration and Polish

- [ ] 12.1 Add real-time status updates with Supabase
  - Set up Supabase real-time subscription for submissions table
  - Update UI automatically when submission status changes
  - Update assignment status badge in real-time
  - Show real-time notifications when writer/student takes action
  - Handle reconnection after network interruption
  - _Requirements: NFR-2, FR-6_

- [ ] 12.2 Add logging and monitoring
  - Add console logging for submission creation with metadata
  - Add logging for payment releases with transaction IDs
  - Add error logging for payment failures with manual review flag
  - Log file upload metrics (count, size, time)
  - Add logging for status transitions
  - _Requirements: NFR-4, Design: Monitoring and Logging_

- [ ] 12.3 Optimize performance
  - Add lazy loading for submission history (paginate if > 10)
  - Optimize file download links with signed URL caching
  - Add image optimization for file type icons
  - Ensure efficient database queries with indexes
  - Test and optimize file upload performance for large files
  - _Requirements: NFR-2, Design: Performance Optimization_

- [ ] 12.4 Final checkpoint - Ensure all tests pass
  - Run all unit tests and verify passing
  - Run all integration tests and verify passing
  - Test complete submission workflow end-to-end manually
  - Test revision workflow end-to-end manually
  - Test payment release manually with test Stripe account
  - Verify all notifications are sent correctly
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- The implementation follows a bottom-up approach: foundation → components → integration
- Payment integration is isolated and can be tested with Stripe test mode
- Notification system is modular and can be enhanced with email/push in the future
- Edge case handling is built into the core flows to prevent data integrity issues
- All components are mobile-responsive using Tailwind CSS
- Accessibility is built-in with keyboard navigation and ARIA attributes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1", "8.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1", "6.1", "7.1"] },
    { "id": 4, "tasks": ["3.4", "4.2", "4.3", "6.2", "7.2", "7.3", "8.2"] },
    { "id": 5, "tasks": ["4.4", "5.1", "6.3", "7.4", "8.3", "8.4"] },
    { "id": 6, "tasks": ["5.2", "7.5", "9.1", "9.2"] },
    { "id": 7, "tasks": ["9.3", "10.1", "10.2"] },
    { "id": 8, "tasks": ["10.3", "11.1", "11.2"] },
    { "id": 9, "tasks": ["11.3", "12.1", "12.2"] },
    { "id": 10, "tasks": ["12.3", "12.4"] }
  ]
}
```
