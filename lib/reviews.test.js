import { describe, it, expect } from 'vitest';
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_TYPES,
  RATING_VALUES,
  computeRatingSummary,
  isValidRating,
  ratingLabel,
} from './reviews';

describe('lib/reviews', () => {
  describe('isValidRating', () => {
    it('accepts whole numbers from 1 to 5', () => {
      expect(RATING_VALUES).toEqual([1, 2, 3, 4, 5]);
      RATING_VALUES.forEach((value) => expect(isValidRating(value)).toBe(true));
    });

    it('accepts numeric strings the way a form would send them', () => {
      expect(isValidRating('4')).toBe(true);
    });

    it('rejects 0, 6, fractions and junk', () => {
      [0, 6, 3.5, null, undefined, '', 'abc', NaN].forEach((value) => {
        expect(isValidRating(value)).toBe(false);
      });
    });
  });

  describe('computeRatingSummary', () => {
    it('averages the ratings and counts each star bucket', () => {
      const summary = computeRatingSummary([{ rating: 5 }, { rating: 4 }, { rating: 4 }]);

      expect(summary.average).toBe(4.33);
      expect(summary.count).toBe(3);
      expect(summary.distribution[4]).toBe(2);
      expect(summary.distribution[5]).toBe(1);
      expect(summary.distribution[1]).toBe(0);
    });

    it('returns a zero average for an empty list', () => {
      expect(computeRatingSummary([])).toMatchObject({ average: 0, count: 0 });
      expect(computeRatingSummary()).toMatchObject({ average: 0, count: 0 });
    });

    it('ignores malformed ratings instead of skewing the average', () => {
      const summary = computeRatingSummary([{ rating: 5 }, { rating: null }, { rating: 9 }, {}]);

      expect(summary.average).toBe(5);
      expect(summary.count).toBe(1);
    });

    it('keeps a whole-number average exact', () => {
      expect(computeRatingSummary([{ rating: 5 }, { rating: 4 }]).average).toBe(4.5);
      expect(computeRatingSummary([{ rating: 3 }, { rating: 3 }]).average).toBe(3);
    });
  });

  describe('ratingLabel', () => {
    it('describes the average in words', () => {
      expect(ratingLabel(5)).toBe('Excellent');
      expect(ratingLabel(4.5)).toBe('Excellent');
      expect(ratingLabel(4)).toBe('Good');
      expect(ratingLabel(3)).toBe('Fair');
      expect(ratingLabel(1.5)).toBe('Needs improvement');
    });

    it('falls back to a neutral label when there are no ratings', () => {
      expect(ratingLabel(0)).toBe('No ratings yet');
      expect(ratingLabel(undefined)).toBe('No ratings yet');
    });
  });

  it('exposes the review type the student->writer flow writes', () => {
    expect(REVIEW_TYPES.STUDENT_TO_WRITER).toBe('student_to_writer');
    expect(REVIEW_COMMENT_MAX_LENGTH).toBe(1000);
  });
});
