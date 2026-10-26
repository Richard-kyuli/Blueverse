'use client';

import { Star } from 'lucide-react';
import { RATING_VALUES } from '@/lib/reviews';

/**
 * Read-only star row. Screen readers get the numeric rating from the wrapper's
 * label, so the individual icons stay decorative.
 *
 * @param {Object} props
 * @param {number} props.rating - 1-5
 * @param {string} [props.className] - Extra classes for sizing the stars
 */
export function StarRating({ rating, className = 'h-5 w-5' }) {
  const value = Number(rating) || 0;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {RATING_VALUES.map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`${className} ${star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
        />
      ))}
    </span>
  );
}

/**
 * Read-only review card. Used by the student to see the review they left and by
 * the writer to see the review they received on a completed assignment.
 *
 * @param {Object} props
 * @param {Object} props.review - Row from the `reviews` table (with `reviewer_name`)
 * @param {string} [props.heading] - Card heading
 * @param {Function} [props.onEdit] - Adds an "Edit review" button when provided
 */
export default function ReviewCard({ review, heading = 'Review', onEdit }) {
  if (!review) return null;

  const created = review.created_at
    ? new Date(review.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : null;

  return (
    <section className="rounded-xl border border-brandGrid bg-white p-6" aria-label={heading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-brandNavy">{heading}</h3>
          <p className="mt-1 text-sm text-textMuted">
            {review.reviewer_name || 'Anonymous'}
            {created ? ` · ${created}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} />
          <span className="text-sm font-medium text-textDark">{review.rating}/5</span>
        </div>
      </div>

      {review.comment && (
        <p className="mt-4 whitespace-pre-wrap text-textBody">{review.comment}</p>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-4 text-sm font-medium text-brandBlue hover:text-brandAccent focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2 rounded"
        >
          Edit review
        </button>
      )}
    </section>
  );
}
