'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'
import { STAGES, STAGE_COLORS } from '@/lib/constants'
import { CheckCircle, Clock, AlertCircle, FileText, GraduationCap, CreditCard, User } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

export default function StudentDashboard() {
  const [application, setApplication] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [docStats, setDocStats] = useState({ total: 0, approved: 0, pending: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const userId = session.user.id

        // Load profile directly from Supabase (no backend needed)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*, student_profile:student_profiles(profile_completion_pct, preferred_course, preferred_intake, qualification_level, english_test_type, english_test_score)')
          .eq('id', userId)
          .single()

        if (profileError) {
          console.warn('Profile fetch failed:', profileError.message)
        } else if (profileData) {
          setProfile(profileData)
        }

        // Load applications and notifications in parallel
        const results = await Promise.allSettled([
          api.get('/applications'),
          api.get('/notifications'),
        ])

        // Applications
        if (results[0].status === 'fulfilled') {
          const app = results[0].value.data?.[0] || null
          setApplication(app)

          if (app?.id) {
            try {
              const docsRes = await api.get(`/documents/${app.id}`)
              const docs = docsRes.data || []
              setDocStats({
                total: docs.length,
                approved: docs.filter((d: any) => d.status === 'approved').length,
                pending: docs.filter((d: any) => ['pending', 'uploaded', 'under_review'].includes(d.status)).length,
              })
            } catch { /* documents not critical */ }
          }
        }

        // Notifications
        if (results[1].status === 'fulfilled') {
          setNotifications(results[1].value.data?.slice(0, 5) || [])
        }

      } catch (err: any) {
        setError('Failed to load dashboard data. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading your dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-3">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">Retry</button>
        </div>
      </div>
    )
  }

  const currentStageIndex = STAGES.findIndex(s => s.key === application?.current_stage)
  const safeStageIndex = currentStageIndex === -1 ? 0 : currentStageIndex
  const progressPct = Math.round(((safeStageIndex + 1) / STAGES.length) * 100)

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Student'} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Student ID: <span className="font-medium text-brand-600">{profile?.student_id || '—'}</span>
          </p>
        </div>
        <Link href="/dashboard/profile" className="btn-secondary flex items-center gap-2 text-sm">
          <User size={16} />
          My Profile
        </Link>
      </div>

      {/* Profile summary — visible once student fills in details */}
      {(profile?.nationality || profile?.student_profile?.preferred_course || profile?.student_profile?.preferred_intake) && (
        <div className="card bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-100">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {profile?.nationality && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Nationality</p>
                <p className="font-semibold text-gray-800">{profile.nationality}</p>
              </div>
            )}
            {profile?.preferred_study_destination && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Study Destination</p>
                <p className="font-semibold text-gray-800">{profile.preferred_study_destination}</p>
              </div>
            )}
            {profile?.student_profile?.preferred_course && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Preferred Course</p>
                <p className="font-semibold text-gray-800">{profile.student_profile.preferred_course}</p>
              </div>
            )}
            {profile?.student_profile?.preferred_intake && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Intake</p>
                <p className="font-semibold text-gray-800">{profile.student_profile.preferred_intake}</p>
              </div>
            )}
            {profile?.student_profile?.qualification_level && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Qualification</p>
                <p className="font-semibold text-gray-800">{profile.student_profile.qualification_level}</p>
              </div>
            )}
            {profile?.student_profile?.english_test_type && profile?.student_profile?.english_test_score && (
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">English Test</p>
                <p className="font-semibold text-gray-800">
                  {profile.student_profile.english_test_type} — {profile.student_profile.english_test_score}
                </p>
              </div>
            )}
            <div className="ml-auto self-center">
              <Link href="/dashboard/profile" className="text-brand-600 text-xs font-medium hover:underline">
                Edit Profile →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Application Progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Application Progress</h2>
          <div className="flex items-center gap-3">
            {profile?.student_profile?.profile_completion_pct > 0 && (
              <span className="text-xs text-gray-500">
                Profile: <span className="font-semibold text-brand-600">{profile.student_profile.profile_completion_pct}%</span>
              </span>
            )}
            {application?.current_stage && (
              <span className={clsx('badge text-xs px-3 py-1', STAGE_COLORS[application.current_stage])}>
                {STAGES.find(s => s.key === application.current_stage)?.label}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Step {safeStageIndex + 1} of {STAGES.length}</span>
            <span>{progressPct}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-brand-600 h-3 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Stage grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < safeStageIndex
            const isCurrent = idx === safeStageIndex
            return (
              <div
                key={stage.key}
                className={clsx(
                  'flex items-center gap-2 p-3 rounded-lg text-xs font-medium',
                  isCompleted ? 'bg-green-50 text-green-700' :
                  isCurrent  ? 'bg-brand-50 text-brand-700 border border-brand-200 shadow-sm' :
                               'bg-gray-50 text-gray-400'
                )}
              >
                {isCompleted ? (
                  <CheckCircle size={14} className="shrink-0 text-green-500" />
                ) : isCurrent ? (
                  <Clock size={14} className="shrink-0 text-brand-500" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                )}
                <span className="leading-tight">{stage.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/dashboard/documents" className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
          <div className="p-3 bg-blue-100 rounded-lg shrink-0">
            <FileText size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Documents</p>
            <p className="text-lg font-bold">
              {docStats.total === 0 ? 'Upload Required' : `${docStats.approved}/${docStats.total} Approved`}
            </p>
            {docStats.pending > 0 && (
              <p className="text-xs text-yellow-600">{docStats.pending} pending review</p>
            )}
          </div>
        </Link>

        <Link href="/dashboard/universities" className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
          <div className="p-3 bg-purple-100 rounded-lg shrink-0">
            <GraduationCap size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Universities</p>
            <p className="text-lg font-bold">View Applications</p>
          </div>
        </Link>

        <Link href="/dashboard/payments" className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
          <div className="p-3 bg-green-100 rounded-lg shrink-0">
            <CreditCard size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Payments</p>
            <p className="text-lg font-bold">View History</p>
          </div>
        </Link>
      </div>

      {/* Next steps prompt */}
      {(application?.current_stage === 'registered' || application?.current_stage === 'profile_completion') && (
        <div className="card bg-brand-50 border border-brand-200">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-brand-100 rounded-lg shrink-0">
              <AlertCircle size={20} className="text-brand-600" />
            </div>
            <div>
              <h3 className="font-semibold text-brand-800">
                {application?.current_stage === 'registered'
                  ? 'Complete Your Profile'
                  : 'Finish Your Profile'}
              </h3>
              <p className="text-sm text-brand-600 mt-1">
                {application?.current_stage === 'registered'
                  ? 'Your next step is to complete your student profile so your counselor can assess your eligibility.'
                  : `Your profile is ${profile?.student_profile?.profile_completion_pct || 0}% complete. Fill in all sections to move to the next stage.`}
              </p>
              <Link href="/dashboard/profile" className="btn-primary mt-3 inline-block text-sm">
                {application?.current_stage === 'registered' ? 'Complete Profile →' : 'Continue Profile →'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Notifications */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Notifications</h2>
          {notifications.length > 0 && (
            <span className="text-xs text-brand-600 font-medium">
              {notifications.filter((n: any) => !n.is_read).length} unread
            </span>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🔔</div>
            <p className="text-gray-400 text-sm">No notifications yet. You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <div key={n.id} className={clsx(
                'flex items-start gap-3 p-3 rounded-lg border',
                n.is_read ? 'bg-gray-50 border-transparent' : 'bg-brand-50 border-brand-100'
              )}>
                <div className={clsx(
                  'w-2 h-2 rounded-full mt-1.5 shrink-0',
                  n.type === 'success'          ? 'bg-green-500' :
                  n.type === 'warning'          ? 'bg-yellow-500' :
                  n.type === 'action_required'  ? 'bg-red-500' : 'bg-blue-500'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
