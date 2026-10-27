import { NextResponse } from 'next/server';
import { authenticateAdmin, authFailure } from '@/lib/adminAuth';
import {
  ADMIN_ROLES,
  USER_ACTION_LABELS,
  USER_ACTIONS,
  buildUserUpdate,
  canApplyUserAction,
  pageCount,
  resolvePaging,
} from '@/lib/admin';
import { sendNotification } from '@/lib/notify';

/**
 * GET /api/admin/users
 *
 * Paginated account directory with search and role/status filters.
 *
 * PATCH /api/admin/users
 *
 * Moderate one account: suspend, reactivate, verify or remove verification.
 * Body: { userId, action, reason? } where action is one of USER_ACTIONS.
 *
 * Both handlers use the service-role client (no RLS policy lets an admin read
 * every profile the way the console needs) after authenticateAdmin confirms the
 * caller is an active administrator.
 */

/** Columns the console actually renders; keeps the payload predictable. */
const USER_FIELDS = [
  'id',
  'full_name',
  'email',
  'user_type',
  'avatar_url',
  'bio',
  'expertise',
  'location',
  'rating',
  'success_rate',
  'completed_assignments',
  'is_verified',
  'verified_at',
  'is_active',
  'suspended_at',
  'suspension_reason',
  'created_at',
];

function shapeUser(row) {
  const shaped = {};
  for (const field of USER_FIELDS) {
    shaped[field] = row[field] ?? null;
  }
  return shaped;
}

/** Strip characters that would break PostgREST's `or` filter grammar. */
function sanitiseNeedle(value) {
  return String(value || '')
    .replace(/[,()*%]/g, ' ')
    .trim();
}

export async function GET(request) {
  const auth = await authenticateAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(authFailure(auth), { status: auth.status });
  }

  const { supabase } = auth;
  const params = new URL(request.url).searchParams;

  const role = params.get('role');
  if (role && !ADMIN_ROLES.includes(role)) {
    return NextResponse.json(
      { success: false, error: `role must be one of ${ADMIN_ROLES.join(', ')}` },
      { status: 400 }
    );
  }

  const needle = sanitiseNeedle(params.get('search'));
  const status = params.get('status');
  const paging = resolvePaging({
    page: params.get('page'),
    pageSize: params.get('pageSize'),
  });

  let query = supabase.from('profiles').select('*', { count: 'exact' });

  if (role) query = query.eq('user_type', role);

  if (status === 'suspended') {
    query = query.eq('is_active', false);
  } else if (status === 'active') {
    // is_active may be NULL on accounts created before the column existed
    query = query.or('is_active.is.null,is_active.eq.true');
  } else if (status === 'unverified') {
    query = query.or('is_verified.is.null,is_verified.eq.false');
  } else if (status) {
    return NextResponse.json(
      { success: false, error: 'status must be active, suspended or unverified' },
      { status: 400 }
    );
  }

  if (needle) {
    query = query.or(`full_name.ilike.%${needle}%,email.ilike.%${needle}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(paging.from, paging.to);

  if (error) {
    console.error('Admin user list failed:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load users', details: error.message },
      { status: 500 }
    );
  }

  const total = count || 0;

  return NextResponse.json({
    success: true,
    users: (data || []).map(shapeUser),
    page: paging.page,
    pageSize: paging.pageSize,
    total,
    totalPages: pageCount(total, paging.pageSize),
  });
}

export async function PATCH(request) {
  const auth = await authenticateAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(authFailure(auth), { status: auth.status });
  }

  const { supabase, profile: actor } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, action, reason } = body || {};

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
  }

  if (!action || !Object.prototype.hasOwnProperty.call(USER_ACTIONS, action)) {
    return NextResponse.json(
      { success: false, error: `action must be one of ${Object.keys(USER_ACTIONS).join(', ')}` },
      { status: 400 }
    );
  }

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (targetError) {
    console.error('Admin user lookup failed:', targetError);
    return NextResponse.json(
      { success: false, error: 'Could not load that user', details: targetError.message },
      { status: 500 }
    );
  }

  if (!target) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const allowed = canApplyUserAction(target, action, { actorId: actor.id });
  if (!allowed.ok) {
    return NextResponse.json({ success: false, error: allowed.reason }, { status: 409 });
  }

  // Suspending or unverifying an administrator must not lock the platform out of
  // its own console.
  const removesAdmin = target.user_type === 'admin' &&
    (action === USER_ACTIONS.suspend || action === USER_ACTIONS.unverify);

  if (removesAdmin) {
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_type', 'admin')
      .or('is_active.is.null,is_active.eq.true');

    if (countError) {
      return NextResponse.json(
        { success: false, error: 'Could not verify the administrator count', details: countError.message },
        { status: 500 }
      );
    }

    if ((count || 0) <= 1) {
      return NextResponse.json(
        { success: false, error: 'The platform needs at least one active administrator' },
        { status: 409 }
      );
    }
  }

  const update = buildUserUpdate(action, { reason });

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select('*')
    .single();

  if (updateError) {
    console.error('Admin user update failed:', updateError);

    // 42703 = undefined_column: the deployed profiles table predates the
    // is_active / is_verified columns this action needs.
    const missingColumn = updateError.code === '42703';
    return NextResponse.json(
      {
        success: false,
        error: missingColumn
          ? 'The profiles table is missing the moderation columns. Run supabase-profile-fields-update.sql in Supabase, then try again.'
          : 'Could not update that user',
        details: updateError.message,
      },
      { status: missingColumn ? 409 : 500 }
    );
  }

  const notices = {
    [USER_ACTIONS.suspend]: {
      title: 'Account suspended',
      message: update.suspension_reason
        ? `Your BlueVerse account was suspended. Reason: ${update.suspension_reason}`
        : 'Your BlueVerse account was suspended. Contact support if you think this is a mistake.',
    },
    [USER_ACTIONS.reactivate]: {
      title: 'Account reactivated',
      message: 'Your BlueVerse account is active again.',
    },
    [USER_ACTIONS.verify]: {
      title: 'Profile verified',
      message: 'Your BlueVerse profile has been verified.',
    },
    [USER_ACTIONS.unverify]: {
      title: 'Verification removed',
      message: 'The verified badge was removed from your BlueVerse profile.',
    },
  };

  const notice = notices[action];
  if (notice) {
    await sendNotification(supabase, {
      userId,
      type: 'account_updated',
      title: notice.title,
      message: notice.message,
      link: '/dashboard',
    });
  }

  return NextResponse.json({
    success: true,
    user: shapeUser(updated),
    message: `${USER_ACTION_LABELS[action]} applied to ${updated.full_name || updated.email}.`,
  });
}
