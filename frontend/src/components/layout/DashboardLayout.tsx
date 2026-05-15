'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, User, FileText, GraduationCap,
  MessageSquare, Bell, CreditCard, Plane, LogOut, Menu, X
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import Logo from '@/components/Logo'

const studentNav = [
  { href: '/dashboard',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/dashboard/profile',      label: 'My Profile',   icon: User },
  { href: '/dashboard/documents',    label: 'Documents',    icon: FileText },
  { href: '/dashboard/universities', label: 'Universities', icon: GraduationCap },
  { href: '/dashboard/messages',     label: 'Messages',     icon: MessageSquare },
  { href: '/dashboard/payments',     label: 'Payments',     icon: CreditCard },
  { href: '/dashboard/visa',         label: 'Visa',         icon: Plane },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-60 bg-brand-900 text-white transform transition-transform duration-200 ease-in-out flex flex-col',
        'lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-brand-800 shrink-0">
          <Logo size="md" />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-brand-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {studentNav.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-accent-500 text-white shadow-sm'
                    : 'text-brand-300 hover:bg-brand-800 hover:text-white'
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-brand-800 shrink-0">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-brand-300 hover:bg-red-900/40 hover:text-red-300 transition-all duration-150">
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <Link href="/dashboard/notifications"
              className="relative p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
              <Bell size={19} />
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
