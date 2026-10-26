import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUnreadCount, markAllNotificationsAsRead, markNotificationAsRead } from './notifications';
import { supabase } from './supabase';

/**
 * Tests for the notification query helpers used by the dashboard NotificationBell.
 *
 * Each helper builds a different PostgREST chain. The mock builder is thenable so
 * `await chain` (how PostgREST terminal calls resolve) works, while still allowing
 * `.select()` / `.single()` to continue the chain.
 */
const { chain } = vi.hoisted(() => {
  const builder = {
    result: { count: 0, error: null },
    then: (resolve) => resolve(builder.result),
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  return { chain: builder };
});

vi.mock('./supabase', () => ({
  supabase: { from: vi.fn(() => chain) },
}));

describe('notification helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    chain.result = { count: 3, error: null };
    chain.select.mockReturnValue(chain);
    chain.update.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: { id: 'notification-1' }, error: null });
  });

  describe('getUnreadCount', () => {
    it('counts unread notifications for the user', async () => {
      const result = await getUnreadCount('user-1');

      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(chain.eq).toHaveBeenCalledWith('is_read', false);
      expect(result).toEqual({ count: 3, error: null });
    });

    it('returns zero when the query fails', async () => {
      const error = { message: 'permission denied' };
      chain.result = { count: null, error };

      const result = await getUnreadCount('user-1');

      expect(result.count).toBe(0);
      expect(result.error).toBe(error);
    });

    it('rejects without a user id', async () => {
      const result = await getUnreadCount('');

      expect(result.count).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('updates every unread row for the user', async () => {
      chain.result = { error: null };

      const result = await markAllNotificationsAsRead('user-1');

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: true, read_at: expect.any(String) })
      );
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(chain.eq).toHaveBeenCalledWith('is_read', false);
      expect(result).toEqual({ success: true, error: null });
    });

    it('reports a failure without throwing', async () => {
      const error = { message: 'permission denied' };
      chain.result = { error };

      const result = await markAllNotificationsAsRead('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });
  });

  describe('markNotificationAsRead', () => {
    it('updates a single notification', async () => {
      const result = await markNotificationAsRead('notification-1');

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: true, read_at: expect.any(String) })
      );
      expect(chain.eq).toHaveBeenCalledWith('id', 'notification-1');
      expect(result).toEqual({ success: true, error: null });
    });
  });
});
