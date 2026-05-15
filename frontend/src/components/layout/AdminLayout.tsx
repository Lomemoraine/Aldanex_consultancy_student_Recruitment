'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Users, FileText, GraduationCap,
  MessageSquare, Bell, CreditCard, Settings, LogOut, Menu, X, UserCog
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import Logo from '@/components/Logo'

const adminNav = [
  { href: '/admin',                label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/admin/students',       label: 'Students',     icon: Users },
  { href: '/admin/applications',   label: 'Applications', icon: FileText },
  { href: '/admin/documents',      label: 'Documents',    icon: FileText },
  { href: '/admin/counseling',     label: 'Counseling',   icon: MessageSquare },
  { href: '/admin/universities',   label: 'Universities', icon: GraduationCap },
  { href: '/admin/payments',       label: 'Payments',     icon: CreditCard },
  { href: '/admin/staff',          label: 'Staff',        icon: UserCog },
  { href: '/admin/settings',       label: 'Settings',     icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 bg-brand-900 text-white transform transition-transform duration-200 flex flex-col',
        'lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-brand-800 shrink-0">
          <Logo size="md" />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-brand-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {adminNav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                pathname === href || (href !== '/admin' && pathname.startsWith(href))
                  ? 'bg-accent-500 text-white shadow-sm'
                  : 'text-brand-300 hover:bg-brand-800 hover:text-white'
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-brand-800 shrink-0">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-brand-200 hover:bg-red-900/50 hover:text-red-300 transition-colors">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-sm shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <Menu size={20} />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-sm text-gray-400">
            <span className="font-semibold text-brand-800">Aldanex</span>
            <span>/</span>
            <span>Admin Portal</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Link href="/admin/notifications"
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
