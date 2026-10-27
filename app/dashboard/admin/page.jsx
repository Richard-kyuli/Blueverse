import { redirect } from 'next/navigation';

/**
 * The admin overview lives at /dashboard so the sidebar's "Overview" entry can
 * share the student and writer landing route. Anything that still links to
 * /dashboard/admin lands there instead of a 404.
 */
export default function AdminIndexPage() {
  redirect('/dashboard');
}
