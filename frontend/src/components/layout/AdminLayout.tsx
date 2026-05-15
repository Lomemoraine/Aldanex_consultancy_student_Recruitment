'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Users, FileText, GraduationCap,
  MessageSquare, Bell, CreditCard, Settings, LogOut,
  Menu, X, UserCog, Mail, ClipboardList
} from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import Logo from '@/components/Logo'

// ── Role-based nav ────────────────────────────────────────────
// roles: null = all staff | string[] = only those roles
const adminNav = [
  { href: '/admin',              label: 'Dashboard',    icon: LayoutDashboard, roles: null },
  { href: '/admin/students',     label: 'Students',     icon: Users,           roles: ['admin', 'counselor', 'admissions'] },
  { href: '/admin/applications', label: 'Applications', icon: FileText,        roles: null },
  { href: '/admin/admissions',   label: 'Admissions',   icon: ClipboardList,   roles: ['admin', 'admissions'] },
  { href: '/admin/documents',    label: 'Documents',    icon: FileText,        roles: null },
  { href: '/admin/counseling',   label: 'Counseling',   icon: MessageSquare,   roles: ['admin', 'counselor'] },
  { href: '/admin/messages',     label: 'Messages',     icon: Mail,            roles: null },
  { href: '/admin/universities', label: 'Universities', icon: GraduationCap,   roles: ['admin', 'admissions'] },
  { href: '/admin/payments',     label: 'Payments',     icon: CreditCard,      roles: ['admin', 'admissions'] },
  { href: '/admin/staff',        label: 'Staff',        icon: UserCog,         roles: ['admin'] },
  { href: '/admin/settings',     label: 'Settings',     icon: Settings,        roles: null },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => { if (data) { setUserRole(data.role); setUserName(data.full_name) } })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Filter nav by role
  const visibleNav = adminNav.filter(item => {
    if (!item.roles) return true
    if (!userRole) return false
    return item.roles.includes(userRole)
  })

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

        {/* Role + name badge */}
        {userRole && (
          <div className="px-4 py-2.5 border-b border-brand-800">
            <p className="text-xs font-semibold text-white capitalize leading-tight">
              {userName?.split(' ')[0] || ''}
            </p>
            <p className="text-[10px] text-brand-400 uppercase tracking-widest mt-0.5">
              {userRole.replace('_', ' ')}
            </p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ href, label, icon: Icon }) => (
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
          <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500">
            <span className="font-bold text-brand-800">Aldanex</span>
            <span className="text-gray-300">|</span>
            {userName && (
              <span className="font-semibold text-gray-700">{userName.split(' ')[0]}</span>
            )}
            {userRole && (
              <span className="text-gray-400 capitalize">
                ({userRole.replace('_', ' ')})
              </span>
            )}
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
