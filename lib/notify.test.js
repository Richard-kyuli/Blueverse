import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendNotification } from './notify';

/**
 * Tests for the server-side notification helper.
 *
 * The important guarantee is that a notification problem never throws: callers
 * use this after a workflow status change has already been committed.
 */
describe('sendNotification', () => {
  let insert;
  let client;

  beforeEach(() => {
    vi.clearAllMocks();

    insert = vi.fn().mockResolvedValue({ error: null });
    client = {
      from: vi.fn(() => ({ insert })),
    };
  });

  it('inserts a row for the target user', async () => {
    const result = await sendNotification(client, {
      userId: 'user-1',
      type: 'work_approved',
      title: 'Work Approved',
      message: 'Your work was approved.',
      link: '/dashboard/assignments/a1',
    });

    expect(result.success).toBe(true);
    expect(client.from).toHaveBeenCalledWith('notifications');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      type: 'work_approved',
      title: 'Work Approved',
      message: 'Your work was approved.',
      link: '/dashboard/assignments/a1',
      is_read: false,
    });
  });

  it('defaults link to null', async () => {
    await sendNotification(client, {
      userId: 'user-1',
      type: 'revision_requested',
      title: 'Revision Required',
      message: 'Please revise.',
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ link: null }));
  });

  it('skips the insert when no user id is supplied', async () => {
    const result = await sendNotification(client, {
      type: 'work_approved',
      title: 'Work Approved',
      message: 'Your work was approved.',
    });

    expect(result.success).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('reports a database error without throwing', async () => {
    const error = { message: 'permission denied' };
    insert.mockResolvedValue({ error });

    const result = await sendNotification(client, {
      userId: 'user-1',
      type: 'work_approved',
      title: 'Work Approved',
      message: 'Your work was approved.',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
  });

  it('reports a thrown error without rethrowing', async () => {
    client.from.mockReturnValue(undefined);

    const result = await sendNotification(client, {
      userId: 'user-1',
      type: 'work_approved',
      title: 'Work Approved',
      message: 'Your work was approved.',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(TypeError);
  });
});
