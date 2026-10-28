import { NextResponse } from 'next/server';
import { authenticateAdmin, authFailure } from '@/lib/adminAuth';
import {
  buildAdminProfileRow,
  buildAdminPromotion,
  buildMinimalAdminProfileRow,
  canPromoteToAdmin,
  isValidEmail,
  normaliseEmail,
  validateAdminAccountFields,
} from '@/lib/adminProvisioning';
import { sendNotification } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/admins
 *
 * An existing administrator mints a brand-new administrator account.
 * Body: { fullName, email, password }
 *
 * PATCH /api/admin/admins
 *
 * An existing administrator promotes an account that already exists.
 * Body: { userId } or { email }. An id is exact, an email is what the person
 * adding them usually has to hand.
 *
 * Why this is not part of PATCH /api/admin/users: that endpoint is moderation
 * (suspend, verify) and its actions deliberately never touch `user_type`. Making
 * someone an administrator is a privilege grant, so it gets its own resource, its
 * own audit surface and its own guard (canPromoteToAdmin).
 *
 * Both handlers require authenticateAdmin: the caller must already be an active
 * administrator. There is no bootstrap code here; that belongs to
 * /api/admin/signup, which exists for the first account only.
 */

/**
 * Deliberately small: the console only needs enough to confirm who was added.
 * The full directory is GET /api/admin/users.
 */
const ADMIN_FIELDS = [
  'id',
  'full_name',
  'email',
  'user_type',
  'is_active',
  'is_verified',
  'created_at',
];

function shapeAdmin(row) {
  if (!row) return null;

  const shaped = {};
  for (const field of ADMIN_FIELDS) {
    shaped[field] = row[field] ?? null;
  }
  return shaped;
}

function displayName(profile, fallback = 'An administrator') {
  return profile?.full_name || profile?.email || fallback;
}

/** 409 when the address is taken, 500 for anything else Supabase reports. */
function describeCreateFailure(message) {
  const alreadyExists = /already|exists|registered|duplicate/i.test(message || '');

  return alreadyExists
    ? {
        status: 409,
        body: {
          success: false,
          error:
            'An account with that email already exists. Promote it instead of creating a new one.',
        },
      }
    : {
        status: 500,
        body: { success: false, error: 'Could not create the administrator account.', details: message },
      };
}

export async function POST(request) {
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

  // The confirmation is the form's job: this request carries one password, and
  // the dialog has already refused to send a pair that did not match.
  const check = validateAdminAccountFields(body || {});
  if (!check.ok) {
    return NextResponse.json({ success: false, error: check.error }, { status: 400 });
  }

  const { fullName, email, password } = check.payload;

  // email_confirm is set because an administrator is creating the account for
  // somebody else; there is nobody to click a confirmation link.
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    const failure = describeCreateFailure(createError.message);
    console.error('Console admin creation failed:', createError.message);
    return NextResponse.json(failure.body, { status: failure.status });
  }

  const userId = created?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Could not create the administrator account.' },
      { status: 500 }
    );
  }

  let { error: profileError } = await supabase
    .from('profiles')
    .insert(buildAdminProfileRow({ userId, email, fullName }));

  // 42703 = undefined_column: the deployed table predates the moderation
  // columns. Retry with the columns every version of the schema has.
  if (profileError?.code === '42703') {
    ({ error: profileError } = await supabase
      .from('profiles')
      .insert(buildMinimalAdminProfileRow({ userId, email, fullName })));
  }

  if (profileError) {
    console.error('Console admin profile insert failed:', profileError);

    // An auth user without a profile can neither sign in usefully nor be
    // promoted, so do not leave one behind.
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(userId);
    if (cleanupError) {
      console.error('Could not roll back the orphaned auth user:', cleanupError.message);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'The account was created but its profile could not be saved, so it was rolled back.',
        details: profileError.message,
      },
      { status: 500 }
    );
  }

  await sendNotification(supabase, {
    userId,
    type: 'account_updated',
    title: 'Administrator access granted',
    message: `${displayName(actor)} added you as an administrator of BlueVerse. Sign in at /auth/admin/signin.`,
    link: '/dashboard/admin/users',
  });

  return NextResponse.json(
    {
      success: true,
      user: shapeAdmin({
        id: userId,
        full_name: fullName,
        email,
        user_type: 'admin',
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
      }),
      message: `${fullName} can now sign in to the admin console.`,
    },
    { status: 201 }
  );
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

  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const address = normaliseEmail(body?.email);

  if (!userId && !address) {
    return NextResponse.json(
      { success: false, error: 'Send the id or the email of the account to promote' },
      { status: 400 }
    );
  }

  if (address && !isValidEmail(address)) {
    return NextResponse.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 });
  }

  let lookup = supabase.from('profiles').select('*');
  lookup = userId ? lookup.eq('id', userId) : lookup.eq('email', address);

  const { data: target, error: lookupError } = await lookup.maybeSingle();

  if (lookupError) {
    console.error('Admin promotion lookup failed:', lookupError);
    return NextResponse.json(
      { success: false, error: 'Could not load that account', details: lookupError.message },
      { status: 500 }
    );
  }

  if (!target) {
    return NextResponse.json(
      {
        success: false,
        error: address ? `No account uses ${address}` : 'User not found',
      },
      { status: 404 }
    );
  }

  const allowed = canPromoteToAdmin(target, { actorId: actor.id });
  if (!allowed.ok) {
    return NextResponse.json({ success: false, error: allowed.reason }, { status: 409 });
  }

  let { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(buildAdminPromotion())
    .eq('id', target.id)
    .select('*')
    .single();

  if (updateError?.code === '42703') {
    ({ data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ user_type: 'admin' })
      .eq('id', target.id)
      .select('*')
      .single());
  }

  if (updateError) {
    console.error('Admin promotion update failed:', updateError);
    return NextResponse.json(
      { success: false, error: 'Could not promote that account', details: updateError.message },
      { status: 500 }
    );
  }

  const promotedName = updated?.full_name || updated?.email || target.full_name || target.email;

  await sendNotification(supabase, {
    userId: target.id,
    type: 'account_updated',
    title: 'Administrator access granted',
    message: `${displayName(actor)} gave you administrator access to BlueVerse. Sign in at /auth/admin/signin.`,
    link: '/dashboard/admin/users',
  });

  return NextResponse.json({
    success: true,
    user: shapeAdmin(updated),
    message: `${promotedName} is now an administrator.`,
  });
}

/** Listing administrators is the Users page's job (?role=admin). */
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use POST to create or PATCH to promote.' },
    { status: 405 }
  );
}
