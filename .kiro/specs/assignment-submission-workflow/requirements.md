# Requirements: Assignment Submission & Review Workflow

## Overview
Complete the assignment lifecycle after a writer's bid is accepted, enabling document submission, review, approval/revision workflow, and payment release.

## Context
- **Current State**: Messaging system ✅, Submissions table ✅
- **Missing**: Submission UI, Review UI, Status management, Payment integration
- **Users**: Students (post assignments, review work) and Writers (submit work, handle revisions)

---

## User Stories

### Writer Stories

#### US-W1: Submit Completed Work
**As a** writer who has been assigned an assignment  
**I want to** submit my completed work with files and notes  
**So that** the student can review my work and provide feedback

**Acceptance Criteria:**
- [ ] Can only submit for assignments where I'm the assigned writer
- [ ] Assignment status must be `assigned` or `in_progress`
- [ ] Can upload multiple files (PDF, DOC, DOCX, TXT, ZIP)
- [ ] Can add submission notes/description
- [ ] File size limit: 50MB per file
- [ ] Assignment status changes to `under_review` after submission
- [ ] Receive confirmation after successful submission

#### US-W2: View Submission History
**As a** writer  
**I want to** view all my previous submissions for an assignment  
**So that** I can track what I've submitted and any feedback received

**Acceptance Criteria:**
- [ ] See all submissions ordered by date (newest first)
- [ ] Each submission shows: date, status, files, notes, feedback
- [ ] Can download previously submitted files
- [ ] Revision numbers are clearly displayed
- [ ] Can see which submission is currently under review

#### US-W3: Handle Revision Requests
**As a** writer  
**I want to** view student feedback and resubmit revised work  
**So that** I can address concerns and complete the assignment

**Acceptance Criteria:**
- [ ] Receive clear notification of revision request
- [ ] Can view student's specific feedback/revision notes
- [ ] Can submit revised version with new files
- [ ] Revision number increments automatically
- [ ] Link to previous submission is maintained (parent_submission_id)
- [ ] Assignment status changes back to `under_review` after resubmission

#### US-W4: Track Assignment Progress
**As a** writer  
**I want to** see my assignment status and available actions  
**So that** I know what I need to do next

**Acceptance Criteria:**
- [ ] See current assignment status badge
- [ ] "Submit Work" button appears when ready to submit
- [ ] "View Submission" button appears after submitting
- [ ] "Revise Work" button appears when revision requested
- [ ] "Messages" button always available for communication
- [ ] Clear indication when work is approved

---

### Student Stories

#### US-S1: Receive Submission Notification
**As a** student  
**I want to** be notified when a writer submits work  
**So that** I can review it promptly

**Acceptance Criteria:**
- [ ] In-app notification appears when submission received
- [ ] Assignment card shows "New Submission" badge
- [ ] Email notification sent (optional, future enhancement)
- [ ] Can navigate directly to submission from notification

#### US-S2: Review Submitted Work
**As a** student  
**I want to** review the submitted files and notes  
**So that** I can evaluate the quality of work

**Acceptance Criteria:**
- [ ] See submission date, writer notes, and revision number
- [ ] Can download all submitted files
- [ ] Can preview PDFs inline (future enhancement)
- [ ] See submission history (all previous versions)
- [ ] Clear UI showing which submission is current

#### US-S3: Approve Submission
**As a** student  
**I want to** approve work that meets my requirements  
**So that** the assignment can be marked complete and payment released

**Acceptance Criteria:**
- [ ] "Approve" button clearly visible
- [ ] Confirmation modal before approving
- [ ] Can add optional feedback/thank you note
- [ ] Submission status changes to `approved`
- [ ] Assignment status changes to `completed`
- [ ] Payment is released to writer automatically
- [ ] Both parties receive completion notification

#### US-S4: Request Revisions
**As a** student  
**I want to** request changes when work doesn't meet requirements  
**So that** the writer can improve the submission

**Acceptance Criteria:**
- [ ] "Request Revision" button clearly visible
- [ ] Must provide specific feedback (required field)
- [ ] Can optionally highlight what needs to change
- [ ] Submission status changes to `revision_requested`
- [ ] Assignment status changes back to `in_progress`
- [ ] Writer receives notification with feedback
- [ ] Can specify urgency/deadline for revision

#### US-S5: Track Assignment Status
**As a** student  
**I want to** see assignment progress and available actions  
**So that** I know what stage the assignment is in

**Acceptance Criteria:**
- [ ] See current assignment status badge
- [ ] "View Submissions" button when work is submitted
- [ ] "Messages" button always available
- [ ] Status history/timeline visible
- [ ] Clear indication of pending actions

---

## Functional Requirements

### FR-1: File Upload System
- Support file types: PDF, DOC, DOCX, TXT, ZIP
- Maximum file size: 50MB per file
- Multiple file upload (up to 10 files per submission)
- Upload progress indicator
- File validation (type and size)
- Store files in Supabase Storage (`submissions` bucket)
- Generate unique file paths: `{assignment_id}/{submission_id}/{filename}`

### FR-2: Submission Workflow
1. **Writer submits** → Assignment status: `under_review`
2. **Student reviews** → Can approve or request revision
3. **If approved** → Assignment status: `completed`, payment released
4. **If revision** → Assignment status: `in_progress`, writer resubmits
5. **Writer resubmits** → New submission created with incremented revision number

### FR-3: Status Management
**Assignment Statuses:**
- `open` → New assignment posted
- `assigned` → Writer's bid accepted
- `in_progress` → Writer working (or revising)
- `under_review` → Submission waiting for student review
- `completed` → Work approved, payment released
- `cancelled` → Assignment cancelled by student

**Submission Statuses:**
- `submitted` → Initial state after submission
- `approved` → Student approved the work
- `revision_requested` → Student wants changes
- `rejected` → Work rejected (rare, edge case)

### FR-4: Revision Tracking
- Each revision creates new submission record
- `revision_number` increments (1, 2, 3...)
- `parent_submission_id` links to previous version
- Student can view complete revision history
- Writer can see feedback from all revision requests

### FR-5: Payment Integration
- Payment held in escrow during assignment
- Released automatically when submission approved
- Stripe Connect or platform balance system
- Transaction record created on release
- Both parties notified of payment release

### FR-6: Notifications
**In-app notifications for:**
- Writer: Submission confirmed, revision requested, work approved
- Student: Work submitted, revision submitted, payment released

**Future: Email notifications**

### FR-7: Access Control
- Writers can only submit to their assigned assignments
- Students can only review their own assignments
- Both parties can view submission history for their assignments
- Files in `submissions` bucket only accessible to assignment parties

---

## Non-Functional Requirements

### NFR-1: Security
- Row Level Security (RLS) enforced on submissions table ✅
- Storage bucket policies restrict file access ✅
- File upload validation on client and server
- Prevent submission spam (rate limiting)
- Virus scanning on uploaded files (future)

### NFR-2: Performance
- File upload with progress indication
- Lazy loading for large file lists
- Efficient queries with proper indexes ✅
- Real-time updates for status changes
- Pagination for revision history (if > 10 submissions)

### NFR-3: Usability
- Clear call-to-action buttons
- Intuitive submission form
- Helpful error messages
- Progress indicators during uploads
- Mobile-responsive design
- Keyboard navigation support

### NFR-4: Reliability
- Failed uploads can be retried
- Auto-save draft submissions (future)
- Transaction rollback on payment failures
- Audit trail for all status changes
- Data backup and recovery

---

## User Interface Requirements

### UI-1: Writer Submission Page
**Location:** `/dashboard/assignments/[id]/submit`

**Components:**
- Assignment details header
- File upload dropzone with drag-and-drop
- Submission notes textarea
- File list with remove option
- Upload progress bars
- Submit button (disabled until valid)
- Cancel button (returns to assignment detail)

### UI-2: Student Review Page
**Location:** `/dashboard/assignments/[id]/submissions`

**Components:**
- Current submission details card
- Writer notes display
- File download list with icons
- Revision history accordion
- Action buttons: Approve | Request Revision
- Feedback textarea (for revision requests)
- Status badge

### UI-3: Assignment Detail Enhancement
**Both student and writer views need:**
- Status badge prominently displayed
- "Messages" button in header
- "View Submissions" or "Submit Work" button (context-dependent)
- Progress timeline/stepper
- Quick action cards

---

## Edge Cases & Business Rules

### EC-1: Multiple Submissions Before Review
- **Rule:** Writer cannot submit again while submission is `under_review`
- **UI:** Submit button disabled with tooltip "Submission under review"

### EC-2: Assignment Cancelled After Submission
- **Rule:** Student can cancel even with pending submission
- **Effect:** Writer still paid partial amount (configurable %)
- **UI:** Cancellation requires confirmation modal

### EC-3: Deadline Passed Before Submission
- **Rule:** Writer can still submit after deadline
- **Effect:** May trigger penalty or negotiation flow
- **UI:** Show warning but allow submission

### EC-4: File Upload Failures
- **Rule:** Individual file failures don't block other files
- **UI:** Show error per failed file, allow retry
- **Action:** Failed files can be removed or retried

### EC-5: Rapid Status Changes
- **Rule:** Use optimistic locking (updated_at timestamp)
- **Effect:** Prevent concurrent approval/revision requests
- **UI:** Show error if status changed, refresh data

### EC-6: Writer Submits Empty Files
- **Rule:** At least one file required for submission
- **Validation:** Client-side and server-side checks
- **UI:** Submit button disabled until file added

### EC-7: Student Never Reviews Submission
- **Rule:** Auto-approve after X days (configurable, e.g., 7 days)
- **Notification:** Send reminders at 3 days and 6 days
- **Future enhancement**

---

## Data Requirements

### Submissions Table (Already Created ✅)
```
- id (UUID, PK)
- assignment_id (UUID, FK)
- writer_id (UUID, FK)
- submission_text (TEXT)
- file_urls (TEXT[])
- status (TEXT: submitted, approved, revision_requested, rejected)
- student_feedback (TEXT)
- revision_notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- revision_number (INTEGER)
- parent_submission_id (UUID, FK)
```

### Storage Structure
```
submissions/
  {assignment_id}/
    {submission_id}/
      document1.pdf
      document2.docx
      ...
```

---

## Integration Points

### INT-1: Messaging System
- Link from submission review to messages
- Quick message writer button in review page
- Show unread message count in submission header

### INT-2: Payment System (Stripe)
- Trigger payment release on approval
- Create transaction record in database
- Handle payment failures gracefully
- Send payment confirmation emails

### INT-3: Notification System
- In-app notification component
- Real-time updates via Supabase channels
- Future: Email via Supabase Edge Functions
- Future: Push notifications via service worker

### INT-4: Dashboard Updates
- Update assignment cards to show submission status
- Add submission indicators in writer dashboard
- Show pending review count in student dashboard

---

## Success Criteria

### Minimum Viable Product (MVP)
- [ ] Writer can submit files and notes
- [ ] Student can view and download files
- [ ] Student can approve or request revision
- [ ] Revision workflow works end-to-end
- [ ] Payment released on approval
- [ ] Basic notifications (in-app)
- [ ] Mobile-responsive UI

### Future Enhancements
- [ ] File preview (PDF, images) inline
- [ ] Drag-and-drop file reordering
- [ ] Version diff/comparison view
- [ ] Email notifications
- [ ] Auto-approval after deadline
- [ ] Plagiarism checking integration
- [ ] Grammar checking tools
- [ ] Rich text editor for notes
- [ ] Collaborative document editing

---

## Open Questions

1. **Q1:** Should writers be able to delete/replace submitted files before student reviews?
   - **Impact:** May confuse review process if files change
   - **Recommendation:** No deletion once submitted; request revision instead

2. **Q2:** What happens if student approves one submission but requests revision on another? (concurrent submissions)
   - **Impact:** Data integrity, payment confusion
   - **Recommendation:** Only one submission can be "under_review" at a time

3. **Q3:** Should there be a limit on number of revisions?
   - **Impact:** Prevents abuse, sets expectations
   - **Recommendation:** 3 revisions maximum, then requires mediation/support

4. **Q4:** What partial payment on cancellation after submission?
   - **Impact:** Fairness, platform policy
   - **Recommendation:** 50% payment if cancelled after submission, 100% if cancelled after review starts

5. **Q5:** Should students be able to reject submissions outright (no revision)?
   - **Impact:** Dispute handling, refunds
   - **Recommendation:** Rejection requires admin review, triggers dispute process

6. **Q6:** File type restrictions - allow code files, images?
   - **Impact:** Use case expansion, security concerns
   - **Recommendation:** Start with documents only, expand based on demand

---

## Dependencies

### Already Completed ✅
- Submissions table with RLS policies
- Messaging system
- Authentication and user profiles
- Assignment creation and bidding
- Payment escrow setup

### Needs to be Created
- Storage bucket: `submissions` (Private)
- Storage policies for file access
- Notification system infrastructure
- Payment release API endpoint
- Transaction logging table (optional)

### External Dependencies
- Supabase Storage (file hosting)
- Stripe API (payment processing)
- Lucide React (icons)
- React Hot Toast (notifications)

---

## Next Steps

After requirements approval:
1. Create design document with component architecture
2. Define API contracts and data flow
3. Create implementation tasks
4. Begin development in priority order

---

**Status:** 🟡 Requirements Draft - Awaiting Review

**Questions for Review:**
- Are the user stories complete and accurate?
- Any missing edge cases or business rules?
- Payment integration approach acceptable?
- Should we add more future enhancements?
- Any security concerns to address?
