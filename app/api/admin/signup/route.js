import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  buildAdminProfileRow,
  buildMinimalAdminProfileRow,
  validateAdminSignup,
} from '@/lib/adminProvisioning';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/signup
 *
 * The only server-side path that mints an administrator. Two independent
 * requirements stand in front of it:
 *
 *   1. ADMIN_SIGNUP_CODE must be configured on the deployment (fails closed
 *      when it is not), and the request must carry it.
 *   2. The profiles trigger in supabase-profiles-privilege-guard.sql pins
 *      user_type for every non-service-role caller, so a browser can never
 *      write 'admin' itself even if this route has a bug.
 *
 * Only brand-new accounts are created. An existing email is refused rather than
 * adopted, so holding the bootstrap code cannot take over a student account.
 */
export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Send a JSON body.' },
      { status: 400 }
    );
  }

  const check = validateAdminSignup({
    ...body,
    expectedCode: process.env.ADMIN_SIGNUP_CODE,
  });

  if (!check.ok) {
    return NextResponse.json({ success: false, error: check.error }, { status: check.status });
  }

  const { fullName, email, password } = check.payload;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error('Admin provisioning unavailable:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: 'Administrator provisioning is not available on this deployment.',
      },
      { status: 500 }
    );
  }

  // 1. Create the auth user. email_confirm is set because the account is being
  //    created by someone holding the bootstrap code, not by an anonymous
  //    visitor who still has to prove they own the address.
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    const message = createError.message || '';
    const alreadyExists = /already|exists|registered|duplicate/i.test(message);

    console.error('Admin auth user creation failed:', message);

    return NextResponse.json(
      {
        success: false,
        error: alreadyExists
          ? 'An account with that email already exists. Promote it from the Supabase SQL editor instead.'
          : 'Could not create the administrator account.',
        ...(alreadyExists ? {} : { details: message }),
      },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  const userId = created?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Could not create the administrator account.' },
      { status: 500 }
    );
  }

  // 2. Create the profile row. The service role is a trusted caller in the
  //    profiles guard trigger, which is why user_type: 'admin' is accepted here
  //    and nowhere else.
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
    console.error('Admin profile insert failed:', profileError);

    // Compensating action: an auth user without a profile is unusable (it cannot
    // be promoted by the app), so do not leave one behind.
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

  return NextResponse.json(
    { success: true, email, userId },
    { status: 201 }
  );
}
