import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ReviewForm from './ReviewForm';
import { supabase } from '@/lib/supabase';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const savedReview = {
  id: 'review-1',
  assignment_id: 'assignment-1',
  reviewer_id: 'student-1',
  reviewee_id: 'writer-1',
  rating: 5,
  comment: 'Great work, delivered early.',
  review_type: 'student_to_writer',
  created_at: '2026-10-26T10:00:00.000Z',
};

describe('ReviewForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-access-token' } },
      error: null,
    });
  });

  it('renders the star picker with submit disabled until a rating is chosen', () => {
    render(<ReviewForm assignmentId="assignment-1" writerName="Ada Writer" />);

    expect(screen.getByText('Rate Ada Writer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 stars' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeDisabled();
    expect(screen.getByText('Select a rating')).toBeInTheDocument();
  });

  it('posts the rating and comment, then reports the saved review', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        review: savedReview,
        message: 'Thanks for reviewing this writer.',
      }),
    });

    render(<ReviewForm assignmentId="assignment-1" writerName="Ada Writer" onSaved={onSaved} />);

    await user.click(screen.getByRole('button', { name: '5 stars' }));
    await user.type(screen.getByLabelText('Comment (optional)'), 'Great work, delivered early.');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedReview), { timeout: 3000 });

    const [url, options] = global.fetch.mock.calls[0];

    expect(url).toBe('/api/reviews');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-access-token');
    expect(JSON.parse(options.body)).toEqual({
      assignmentId: 'assignment-1',
      rating: 5,
      comment: 'Great work, delivered early.',
    });

    // The saved review replaces the form
    expect(await screen.findByText('Your review', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('shows an existing review read-only and allows editing it', async () => {
    const user = userEvent.setup();

    render(
      <ReviewForm
        assignmentId="assignment-1"
        writerName="Ada Writer"
        existingReview={{ ...savedReview, reviewer_name: 'Grace Student' }}
      />
    );

    expect(screen.getByText('Your review')).toBeInTheDocument();
    expect(screen.getByText('Great work, delivered early.')).toBeInTheDocument();
    expect(screen.getByText('5/5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit review' }));

    expect(screen.getByRole('button', { name: 'Update review' })).toBeEnabled();
    expect(screen.getByLabelText('Comment (optional)')).toHaveValue('Great work, delivered early.');
  });

  it('surfaces the API error instead of pretending the review saved', async () => {
    const user = userEvent.setup();

    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: 'You can review the writer once the assignment is completed' }),
    });

    render(<ReviewForm assignmentId="assignment-1" />);

    await user.click(screen.getByRole('button', { name: '4 stars' }));
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(
      await screen.findByRole('alert', {}, { timeout: 3000 })
    ).toHaveTextContent('You can review the writer once the assignment is completed');
  });

  it('refuses to submit without a token', async () => {
    const user = userEvent.setup();

    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(<ReviewForm assignmentId="assignment-1" />);

    await user.click(screen.getByRole('button', { name: '3 stars' }));
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('session has expired');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
