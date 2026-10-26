'use client';

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import ProfileModal from './ProfileModal';
import NotificationBell from './NotificationBell';
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  MessageSquare, 
  CreditCard,
  Search,
  Briefcase,
  Zap,
  DollarSign,
  LogOut,
  User,
  Settings
} from 'lucide-react';

export default function DashboardLayout({ children }) {
  const { profile, signOut, loading } = useAuth();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const studentNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Assignments', href: '/dashboard/assignments', icon: FileText },
    { name: 'Post Assignment', href: '/dashboard/post-assignment', icon: PlusCircle },
    { name: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
    { name: 'Payments', href: '/dashboard/payments', icon: CreditCard },
  ];

  const writerNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Browse Jobs', href: '/dashboard/browse', icon: Search },
    { name: 'My Bids', href: '/dashboard/bids', icon: Briefcase },
    { name: 'Active Jobs', href: '/dashboard/active', icon: Zap },
    { name: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
    { name: 'Earnings', href: '/dashboard/earnings', icon: DollarSign },
  ];

  const navigation = profile?.user_type === 'student' ? studentNav : writerNav;

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brandBlue border-r-transparent" role="status" aria-label="Loading"></div>
          <p className="mt-4 text-textBody">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error if no profile
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6" role="alert">
            <h3 className="text-xl font-bold text-red-800 mb-2">Profile Not Found</h3>
            <p className="text-red-600 mb-4">Unable to load your profile. Please sign in again.</p>
            <Link
              href="/auth/signin"
              className="inline-block bg-brandBlue text-white px-6 py-3 rounded-lg hover:bg-brandAccent transition-colors focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to main content link for accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brandBlue focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-30 h-16" role="banner">
        <div className="h-full px-6 flex items-center justify-between">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2 rounded-lg"
            aria-label="BlueVerse Dashboard Home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brandBlue text-lg font-extrabold text-white" aria-hidden="true">
              B
            </span>
            <span className="text-xl font-bold text-brandBlue">BlueVerse</span>
          </Link>

          {/* Notifications + User Info */}
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationBell userId={profile.id} />

            <div className="flex items-center gap-3" aria-label="User information">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="h-10 w-10 rounded-full object-cover border-2 border-brandGrid"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-brandBlue/10 flex items-center justify-center" aria-hidden="true">
                  <User className="h-5 w-5 text-brandBlue" />
                </div>
              )}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-textDark">{profile?.full_name}</p>
                <p className="text-xs text-textMuted capitalize">{profile?.user_type}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar Navigation - Fixed */}
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 flex flex-col bg-white border-r border-gray-200 z-20" role="navigation" aria-label="Main navigation">
        <div className="flex-1 overflow-y-auto py-6 px-3">
          <nav className="space-y-1" aria-label="Dashboard navigation">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all text-sm focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2 ${
                    isActive
                      ? 'bg-brandBlue text-white shadow-sm'
                      : 'text-textBody hover:bg-brandIce hover:text-brandBlue'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile at Bottom */}
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={() => setIsProfileOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 mb-2 rounded-lg hover:bg-brandIce transition-colors"
            aria-label="Open profile settings"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-10 w-10 rounded-full object-cover border-2 border-brandGrid flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-brandBlue/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <User className="h-5 w-5 text-brandBlue" />
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-textDark truncate">{profile?.full_name}</p>
              <p className="text-xs text-textMuted capitalize">{profile?.user_type}</p>
            </div>
            <Settings className="h-4 w-4 text-textMuted" />
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-textBody hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label="Sign out of your account"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {/* Main Content - With left margin for sidebar on desktop */}
      <main className="ml-64 mt-16 p-6 lg:p-8" id="main-content" role="main">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
