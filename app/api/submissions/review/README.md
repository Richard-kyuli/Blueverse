# POST /api/submissions/review

Lets the **student who posted an assignment** review the writer's submission. Approving
completes the assignment; requesting a revision returns it to `in_progress` so the writer
can deliver again.

Design reference: `.kiro/specs/assignment-submission-workflow/design.md` (`POST /api/submissions/review`).

Payment release is intentionally **not** part of this endpoint — Stripe checkout/escrow is
not implemented yet.

---

## Request Headers

| Header          | Required | Description                                                     |
| --------------- | -------- | --------------------------------------------------------------- |
| `Authorization` | Yes      | `Bearer <supabase access token>` of the signed-in student        |
| `Content-Type`  | Yes      | `application/json`                                               |

The caller is identified from the verified token. `studentId` in the body is optional and,
when present, must match the authenticated user.

## Request Body

| Field           | Type                      | Required   | Description                                                          |
| --------------- | ------------------------- | ---------- | -------------------------------------------------------------------- |
| `submissionId`  | string (UUID)             | Yes        | Submission being reviewed                                            |
| `action`        | `'approve' \| 'revision'` | Yes        | `approve` completes the assignment, `revision` sends it back          |
| `feedback`      | string                    | Conditional| Required (non-empty) for `revision`; optional note for `approve`      |
| `revisionNotes` | string                    | No         | Instructions stored in `revision_notes`; defaults to `feedback`       |
| `studentId`     | string (UUID)             | No         | Must match the authenticated user if sent                            |

```json
{
  "submissionId": "3f1c...",
  "action": "revision",
  "feedback": "The conclusion needs a stronger link to the data in section 3.",
  "revisionNotes": "Rewrite conclusion, add 2 sources from 2023 or later."
}
```

## Success Response — `200`

```json
{
  "success": true,
  "submissionId": "3f1c...",
  "action": "revision",
  "assignmentStatus": "in_progress",
  "newStatus": "in_progress",
  "message": "Revision requested. The writer has been notified."
}
```

## Effects

| Action     | `submissions.status` | `assignments.status` | Other                                        |
| ---------- | -------------------- | -------------------- | -------------------------------------------- |
| `approve`  | `approved`           | `completed`          | `completed_at` set; writer notified          |
| `revision` | `revision_requested` | `in_progress`        | `student_feedback` + `revision_notes` stored; writer notified |

Notification inserts go through `lib/notify.js` and are **best-effort**: a failed insert is
logged and never fails the review, because the status change is already committed.

## Errors

| Status | When                                                                    |
| ------ | ----------------------------------------------------------------------- |
| `400`  | Missing `submissionId`/`action`, unknown `action`, empty revision feedback, invalid JSON |
| `401`  | Missing, invalid, or expired access token                               |
| `403`  | `studentId` mismatch, or caller does not own the assignment              |
| `404`  | Submission or assignment not found                                      |
| `409`  | Submission already reviewed, assignment not `under_review`, or a concurrent review won the race |
| `405`  | Any method other than `POST`                                            |
| `500`  | Server misconfiguration (missing `SUPABASE_SERVICE_ROLE_KEY`) or unexpected error |

Concurrency is handled with optimistic locking: the submission is only updated while its
status is still `submitted`, and the assignment only while it is still `under_review`. If
the assignment update fails after the submission was updated, the submission is reverted to
`submitted` so the review can be retried.

## Environment

| Variable                    | Required | Notes                                     |
| --------------------------- | -------- | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | Yes      | Supabase project URL                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Server-only; bypasses RLS (see below)     |

The route runs on a service-role client, so it performs its own authorization: the bearer
token is verified with `auth.getUser()` and the caller must match `assignments.student_id`.

## Example

```js
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch('/api/submissions/review', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    submissionId,
    action: 'approve',
    feedback: 'Looks great, thank you.',
  }),
});

const result = await response.json();
```

```bash
curl -X POST http://localhost:3000/api/submissions/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"submissionId":"<uuid>","action":"approve"}'
```
