/**
 * Review helpers shared by the reviews API route and the UI.
 *
 * Ratings live in the `reviews` table (1-5 stars, one review per assignment and
 * reviewer). The writer's headline rating on their profile is derived from those
 * rows rather than typed in by hand, so this module owns the arithmetic.
 */

export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;
export const REVIEW_COMMENT_MAX_LENGTH = 1000;

export const REVIEW_TYPES = {
  STUDENT_TO_WRITER: 'student_to_writer',
  WRITER_TO_STUDENT: 'writer_to_student',
};

/** Star values the UI can render, in display order. */
export const RATING_VALUES = [1, 2, 3, 4, 5];

/**
 * True for a whole number of stars inside the allowed range.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidRating(value) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= REVIEW_RATING_MIN && rating <= REVIEW_RATING_MAX;
}

/**
 * Average and per-star counts for a set of reviews.
 *
 * Invalid or missing ratings are ignored instead of poisoning the average; an
 * empty set reports `average: 0, count: 0` so callers can render "No reviews yet".
 *
 * @param {Array<{ rating: number }>} reviews
 * @returns {{ average: number, count: number, distribution: Record<number, number> }}
 */
export function computeRatingSummary(reviews = []) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let count = 0;

  for (const review of reviews || []) {
    if (!isValidRating(review?.rating)) continue;

    const rating = Number(review.rating);
    distribution[rating] += 1;
    total += rating;
    count += 1;
  }

  return {
    average: count === 0 ? 0 : Math.round((total / count) * 100) / 100,
    count,
    distribution,
  };
}

/**
 * Short label for an average rating, used next to the stars.
 *
 * @param {number} average
 * @returns {string}
 */
export function ratingLabel(average) {
  const value = Number(average);

  if (!Number.isFinite(value) || value <= 0) return 'No ratings yet';
  if (value >= 4.5) return 'Excellent';
  if (value >= 3.5) return 'Good';
  if (value >= 2.5) return 'Fair';
  return 'Needs improvement';
}
