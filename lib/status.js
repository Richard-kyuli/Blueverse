/**
 * Shared presentation helpers for assignment statuses.
 *
 * The dashboard pages used to carry their own copies of these maps, which made
 * the badges drift apart. Everything status related now lives here.
 */

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Megaphone,
  PenLine,
  UserCheck,
  XCircle,
} from 'lucide-react';

export const ACTIVE_ASSIGNMENT_STATUSES = ['assigned', 'in_progress'];
export const IN_REVIEW_STATUSES = ['under_review'];
export const COMPLETED_ASSIGNMENT_STATUSES = ['completed'];

/** Statuses where the student has already committed money to a writer. */
export const FUNDED_ASSIGNMENT_STATUSES = [
  ...ACTIVE_ASSIGNMENT_STATUSES,
  ...IN_REVIEW_STATUSES,
  ...COMPLETED_ASSIGNMENT_STATUSES,
];

export const ASSIGNMENT_STATUSES = [
  'open',
  ...FUNDED_ASSIGNMENT_STATUSES,
  'cancelled',
  'disputed',
];

/** Statuses a writer still has to act on. */
export const OPEN_WORK_STATUSES = [
  ...ACTIVE_ASSIGNMENT_STATUSES,
  ...IN_REVIEW_STATUSES,
  'disputed',
];

const TONES = {
  open: 'bg-blue-100 text-blue-800',
  assigned: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-purple-100 text-purple-800',
  under_review: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  disputed: 'bg-red-100 text-red-800',
};

/** Lucide icon component per assignment status, for compact list rows. */
const ICONS = {
  open: Megaphone,
  assigned: UserCheck,
  in_progress: PenLine,
  under_review: Eye,
  completed: CheckCircle2,
  cancelled: XCircle,
  disputed: AlertTriangle,
};

/** Lucide icon component per bid status. */
const BID_ICONS = {
  pending: Clock,
  accepted: CheckCircle2,
  rejected: XCircle,
  withdrawn: Ban,
};

/** "under_review" -> "under review" */
export function statusLabel(status) {
  if (!status) return 'Unknown';
  return String(status).replace(/_/g, ' ');
}

/** Tailwind classes for a status pill. */
export function statusTone(status) {
  return TONES[status] || TONES.open;
}

/** Icon component used in list views; render it as <Icon className="h-5 w-5" />. */
export function statusIcon(status) {
  return ICONS[status] || FileText;
}

/** Icon component for a bid status. */
export function bidStatusIcon(status) {
  return BID_ICONS[status] || ClipboardList;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days between today and the deadline (negative when overdue). */
export function daysUntil(deadline, now = new Date()) {
  const target = new Date(deadline);
  if (!deadline || Number.isNaN(target.getTime())) return null;
  const ms = startOfDay(target).getTime() - startOfDay(now).getTime();
  return Math.round(ms / 86400000);
}

/** "Due today" / "Due in 3 days" / "2 days overdue". */
export function deadlineLabel(deadline, now = new Date()) {
  const days = daysUntil(deadline, now);
  if (days === null) return 'No deadline';
  if (days < 0) {
    const overdue = Math.abs(days);
    return `${overdue} day${overdue === 1 ? '' : 's'} overdue`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export function isOverdue(deadline, now = new Date()) {
  const days = daysUntil(deadline, now);
  return days !== null && days < 0;
}
