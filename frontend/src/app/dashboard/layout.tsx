'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Image from 'next/image'

export default function Layout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      try {
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
          console.warn('Profile fetch failed in layout:', error?.message)
          setAuthorized(true)
          setChecking(false)
          return
        }

        if (profile.role !== 'student') {
          window.location.href = '/admin'
          return
        }

        setAuthorized(true)
      } catch (err) {
        console.error('Layout auth check failed:', err)
        setAuthorized(true)
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
          <Image
            src="/logo.jpeg"
            alt="Aldanex Consultancy"
            width={56}
            height={56}
            className="object-contain rounded-xl"
            priority
          />
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-500" />
          <p className="text-brand-400 text-sm">Loading your portal...</p>
        </div>
      </div>
    )
  }

  if (!authorized) return null

  return <DashboardLayout>{children}</DashboardLayout>
}
