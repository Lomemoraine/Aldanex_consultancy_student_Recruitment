'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/layout/AdminLayout'
import Image from 'next/image'

export default function Layout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      try {
        // Wait for Supabase to restore session from cookies
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          window.location.href = '/login'
          return
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (error || !profile) {
          console.warn('Profile fetch failed in admin layout:', error?.message)
          // Can't verify role — send to login to be safe
          window.location.href = '/login'
          return
        }

        if (profile.role === 'student') {
          window.location.href = '/dashboard'
          return
        }

        setAuthorized(true)
      } catch (err) {
        console.error('Admin layout auth check failed:', err)
        window.location.href = '/login'
      } finally {
        setChecking(false)
      }
    }

    check()
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-950">
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo.jpeg" alt="Aldanex" width={56} height={56} className="object-contain rounded-xl" />
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-500" />
          <p className="text-brand-400 text-sm">Loading admin portal...</p>
        </div>
      </div>
    )
  }

  if (!authorized) return null

  return <AdminLayout>{children}</AdminLayout>
}
