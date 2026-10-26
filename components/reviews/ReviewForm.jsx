'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  RATING_VALUES,
  REVIEW_COMMENT_MAX_LENGTH,
  isValidRating,
  ratingLabel,
} from '@/lib/reviews';
import ReviewCard from './ReviewCard';

/**
 * ReviewForm Component
 *
 * Shown to the student once an assignment is completed: pick 1-5 stars and leave
 * an optional comment about the writer. Saved through POST /api/reviews, which
 * also refreshes the writer's profile rating and notifies them.
 *
 * An existing review is displayed read-only with an "Edit review" affordance, so
 * a rating can be corrected without a second review being created.
 *
 * @param {Object} props
 * @param {string} props.assignmentId - Assignment being reviewed
 * @param {string} [props.writerName] - Writer's display name
 * @param {Object} [props.existingReview] - The caller's review for this assignment
 * @param {Function} [props.onSaved] - Called with the saved review row
 */
export default function ReviewForm({ assignmentId, writerName, existingReview, onSaved }) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [savedReview, setSavedReview] = useState(existingReview || null);
  const [isEditing, setIsEditing] = useState(!existingReview);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Local copy first, so the confirmation card appears the moment the request
  // succeeds; the page's refetch replaces it with the stored row.
  const currentReview = existingReview || savedReview;

  // The page fetches the existing review asynchronously, so a review that arrives
  // after mount must switch the form into its read-only state.
  useEffect(() => {
    if (!existingReview) return;

    setRating(existingReview.rating);
    setComment(existingReview.comment || '');
    setIsEditing(false);
  }, [existingReview?.id]);

  if (!assignmentId) return null;

  if (currentReview && !isEditing) {
    return (
      <ReviewCard
        review={{ ...currentReview, reviewer_name: 'You' }}
        heading="Your review"
        onEdit={() => setIsEditing(true)}
      />
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValidRating(rating)) {
      setError('Choose a rating from 1 to 5 stars');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assignmentId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save your review');
      }

      toast.success(result.message || 'Thanks for reviewing this writer');
      setSavedReview(result.review || null);
      setComment(result.review?.comment || '');
      setIsEditing(false);

      if (onSaved) {
        await onSaved(result.review);
      }
    } catch (submitError) {
      console.error('Review submit error:', submitError);
      setError(submitError.message || 'Could not save your review');
      toast.error(submitError.message || 'Could not save your review');
    } finally {
      setSubmitting(false);
    }
  };

  const activeRating = hovered || rating;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-brandGrid bg-white p-6"
      aria-label="Review the writer"
    >
      <h3 className="text-lg font-bold text-brandNavy">
        Rate {writerName || 'your writer'}
      </h3>
      <p className="mt-1 text-sm text-textMuted">
        Your rating is shown on the writer&apos;s profile and helps other students choose.
      </p>

      <fieldset className="mt-4" disabled={submitting}>
        <legend className="sr-only">Star rating</legend>

        <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
          {RATING_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHovered(value)}
              onFocus={() => setHovered(value)}
              onBlur={() => setHovered(0)}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              aria-pressed={rating === value}
              className="rounded p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brandBlue"
            >
              <Star
                aria-hidden="true"
                className={`h-8 w-8 ${
                  value <= activeRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                }`}
              />
            </button>
          ))}

          <span className="ml-2 text-sm font-medium text-textDark">
            {rating > 0 ? `${rating}/5 · ${ratingLabel(rating)}` : 'Select a rating'}
          </span>
        </div>

        <label htmlFor="review-comment" className="mt-4 block text-sm font-semibold text-brandNavy">
          Comment (optional)
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          maxLength={REVIEW_COMMENT_MAX_LENGTH}
          placeholder="How was the quality, communication and turnaround?"
          className="mt-2 w-full resize-none rounded-lg border border-brandGrid px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-brandBlue"
        />
        <p className="mt-1 text-right text-xs text-textMuted">
          {comment.length}/{REVIEW_COMMENT_MAX_LENGTH}
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={submitting || !isValidRating(rating)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brandBlue py-2.5 font-medium text-white transition-colors hover:bg-brandAccent disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {currentReview ? 'Update review' : 'Submit review'}
        </button>

        {currentReview && (
          <button
            type="button"
            onClick={() => {
              setRating(currentReview.rating);
              setComment(currentReview.comment || '');
              setError(null);
              setIsEditing(false);
            }}
            disabled={submitting}
            className="rounded-lg border-2 border-brandGrid px-6 py-2.5 font-medium text-textDark transition-colors hover:border-brandBlue disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
