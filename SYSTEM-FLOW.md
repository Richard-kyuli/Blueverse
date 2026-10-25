# BlueVerse System Flow

## 🔄 Complete User Journey

### Student Journey

```
1. SIGN UP
   Student creates account
   ↓
   Profile created in database
   
2. POST ASSIGNMENT
   Student fills form:
   - Title & Description
   - Subject & Academic Level
   - Deadline & Budget
   - Attachments
   ↓
   Assignment created (status: "open")
   
3. RECEIVE BIDS
   Writers submit proposals
   ↓
   Student sees list of bids with:
   - Writer profile & rating
   - Proposed price
   - Delivery time
   - Cover letter
   
4. ACCEPT BID
   Student chooses best writer
   ↓
   Assignment status → "assigned"
   Bid status → "accepted"
   Other bids → "rejected"
   
5. MAKE PAYMENT
   Stripe checkout opens
   ↓
   Payment held in escrow
   Transaction created (status: "held")
   Assignment status → "in_progress"
   
6. RECEIVE WORK
   Writer uploads completed work
   ↓
   Notification sent to student
   Assignment status → "under_review"
   
7. APPROVE & RELEASE PAYMENT
   Student reviews work
   ↓
   If approved:
   - Assignment status → "completed"
   - Payment released to writer
   - Transaction status → "released"
   
8. LEAVE REVIEW
   Student rates writer (1-5 stars)
   ↓
   Review saved
   Writer's rating updated
```

### Writer Journey

```
1. SIGN UP
   Writer creates account
   ↓
   Profile created
   Can add expertise, bio
   
2. BROWSE ASSIGNMENTS
   View all open assignments
   ↓
   Filter by:
   - Subject
   - Budget
   - Deadline
   - Academic level
   
3. VIEW ASSIGNMENT DETAILS
   Read full description
   Check requirements
   View student profile
   ↓
   Decide to bid
   
4. SUBMIT BID
   Writer fills form:
   - Proposed price
   - Delivery timeline
   - Cover letter/proposal
   ↓
   Bid created (status: "pending")
   Notification sent to student
   
5. WAIT FOR ACCEPTANCE
   Track bid status
   ↓
   If accepted:
   - Notification received
   - Assignment appears in "Active Jobs"
   
6. WORK ON ASSIGNMENT
   Access assignment details
   Download attachments
   Complete the work
   ↓
   Upload completed files
   
7. SUBMIT WORK
   Upload final deliverables
   Add notes for student
   ↓
   Assignment status → "under_review"
   Notification sent to student
   
8. GET PAID
   Student approves work
   ↓
   Payment released (85% of total)
   Platform fee: 15%
   Available in earnings
   
9. RECEIVE REVIEW
   Student rates experience
   ↓
   Review saved to profile
   Rating updated
   Success rate updated
```

## 🗄️ Database Relationships

```
USER (profiles)
  ├─ user_type: 'student' | 'writer' | 'admin'
  ├─ For Writers:
  │   ├─ expertise[]
  │   ├─ rating
  │   ├─ completed_assignments
  │   └─ success_rate
  └─ Account status & verification

ASSIGNMENT
  ├─ Created by → STUDENT
  ├─ Assigned to → WRITER (optional)
  ├─ Status flow:
  │   open → assigned → in_progress → under_review → completed
  └─ Related:
      ├─ Multiple BIDS
      ├─ Multiple MESSAGES
      ├─ One TRANSACTION
      └─ Multiple REVIEWS

BID
  ├─ Belongs to → ASSIGNMENT
  ├─ Created by → WRITER
  ├─ Status: pending | accepted | rejected | withdrawn
  └─ Unique per writer-assignment pair

TRANSACTION
  ├─ Links → ASSIGNMENT
  ├─ Between → STUDENT & WRITER
  ├─ Stripe integration:
  │   ├─ payment_intent_id
  │   └─ transfer_id
  ├─ Status: pending | held | released | refunded
  └─ Fee calculation:
      ├─ amount (100%)
      ├─ platform_fee (15%)
      └─ writer_earnings (85%)

MESSAGE
  ├─ Between → STUDENT & WRITER
  ├─ Related to → ASSIGNMENT
  ├─ Contains:
  │   ├─ message text
  │   └─ attachments[]
  └─ Read status tracking

REVIEW
  ├─ For → ASSIGNMENT
  ├─ From → REVIEWER (student or writer)
  ├─ To → REVIEWEE (writer or student)
  ├─ Contains:
  │   ├─ rating (1-5)
  │   └─ comment
  └─ Type: student_to_writer | writer_to_student

NOTIFICATION
  ├─ For → USER
  ├─ Types:
  │   ├─ New bid received
  │   ├─ Bid accepted/rejected
  │   ├─ New message
  │   ├─ Payment received
  │   ├─ Work submitted
  │   └─ Review received
  └─ Read status tracking
```

## 💰 Payment Flow Diagram

```
STUDENT                    PLATFORM                  WRITER
   |                          |                          |
   |-- Posts Assignment ------>|                          |
   |                          |                          |
   |                          |<---- Submits Bid ---------|
   |<-- Receives Bids --------|                          |
   |                          |                          |
   |-- Accepts Bid ---------->|-- Notifies Writer ------>|
   |                          |                          |
   |-- Pays via Stripe ------>|                          |
   |    ($100)                |                          |
   |                          |-- Hold in Escrow         |
   |                          |    ($100)                |
   |                          |                          |
   |                          |<-- Submits Work ---------|
   |<-- Receives Work --------|                          |
   |                          |                          |
   |-- Approves Work -------->|                          |
   |                          |-- Release Payment ------>|
   |                          |    Writer: $85           |
   |                          |    Platform: $15         |
   |                          |                          |
   |<-- Receipt --------------|-- Payment Received ----->|
```

## 🔐 Security & Access Control

### Row Level Security (RLS) Policies

```
PROFILES TABLE:
  ✓ Anyone can view profiles (public)
  ✓ Users can update own profile only

ASSIGNMENTS TABLE:
  ✓ Anyone can view assignments
  ✓ Students can create assignments
  ✓ Students can update own assignments only

BIDS TABLE:
  ✓ Assignment owner can view all bids
  ✓ Bid owner can view own bid
  ✓ Writers can create bids
  ✓ Writers can update own bids only

TRANSACTIONS TABLE:
  ✓ Student can view own transactions
  ✓ Writer can view own transactions
  ✓ System creates transactions

MESSAGES TABLE:
  ✓ Sender can view sent messages
  ✓ Receiver can view received messages
  ✓ Users can send messages
  ✓ Users can update own messages (mark as read)

REVIEWS TABLE:
  ✓ Anyone can view reviews
  ✓ Users can create reviews
  ✓ Cannot edit reviews after posting

NOTIFICATIONS TABLE:
  ✓ Users can view own notifications only
  ✓ Users can update own notifications (mark as read)
```

## 📱 Page Routes

```
PUBLIC ROUTES:
/                           → Landing page
/auth/signin               → Sign in page
/auth/signup               → Sign up page

PROTECTED ROUTES (Any authenticated user):
/dashboard                 → Main dashboard (role-based)

STUDENT ROUTES:
/dashboard                 → Student dashboard
/dashboard/assignments     → My assignments list
/dashboard/assignments/:id → Assignment detail
/dashboard/post-assignment → Post new assignment
/dashboard/messages        → Messages inbox
/dashboard/payments        → Payment history

WRITER ROUTES:
/dashboard                 → Writer dashboard
/dashboard/browse          → Browse open assignments
/dashboard/browse/:id      → Assignment detail + bid form
/dashboard/bids            → My bids list
/dashboard/active          → Active jobs
/dashboard/messages        → Messages inbox
/dashboard/earnings        → Earnings & withdrawal

FUTURE ROUTES:
/dashboard/profile         → Edit profile
/dashboard/settings        → Account settings
/admin/*                   → Admin panel (future)
```

## 🔔 Notification Triggers

```
EVENT                           → NOTIFICATION TO

New Assignment Posted           → Writers (matching expertise)
New Bid Received               → Student (assignment owner)
Bid Accepted                   → Writer (bid owner)
Bid Rejected                   → Writer (bid owner)
Payment Received               → Student (confirmation)
Work Submitted                 → Student (assignment owner)
Work Approved                  → Writer (assignment owner)
Payment Released               → Writer (payment confirmation)
New Message                    → Receiver
Review Received                → Reviewee
Assignment Deadline Approaching → Student & Writer
```

## 🎯 Status Transitions

### Assignment Status
```
[open]
  ↓ (bid accepted)
[assigned]
  ↓ (payment confirmed)
[in_progress]
  ↓ (work submitted)
[under_review]
  ↓ (student approves)
[completed]

Alternative paths:
[open/assigned] → [cancelled] (student cancels)
[any status]    → [disputed]  (dispute raised)
```

### Bid Status
```
[pending]
  ↓ (student accepts)
[accepted]

Alternative:
[pending]
  ↓ (student rejects or accepts another)
[rejected]

Or:
[pending]
  ↓ (writer withdraws)
[withdrawn]
```

### Transaction Status
```
[pending]
  ↓ (payment processed)
[held]
  ↓ (work approved)
[released]

Alternative:
[held]
  ↓ (dispute/cancellation)
[refunded]
```

## 📊 Key Metrics to Track

```
USER METRICS:
- Total users (students, writers, admins)
- Active users (last 30 days)
- New signups per week
- User retention rate

ASSIGNMENT METRICS:
- Assignments posted per week
- Average bids per assignment
- Assignment completion rate
- Average time to completion
- Cancellation rate

FINANCIAL METRICS:
- Total transaction volume
- Platform revenue (15% fees)
- Average assignment value
- Writer average earnings
- Payment success rate

QUALITY METRICS:
- Average rating (students)
- Average rating (writers)
- On-time delivery rate
- Dispute rate
- Refund rate
```

---

This diagram shows the complete system architecture. Use it as reference when building features!
