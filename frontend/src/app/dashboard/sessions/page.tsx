'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Calendar, Clock, User, FileText, CheckCircle, Video } from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:    { label: 'Scheduled',   color: 'text-blue-600',   bg: 'bg-blue-50' },
  completed:    { label: 'Completed',   color: 'text-green-600',  bg: 'bg-green-50' },
  cancelled:    { label: 'Cancelled',   color: 'text-red-600',    bg: 'bg-red-50' },
  rescheduled:  { label: 'Rescheduled', color: 'text-yellow-600', bg: 'bg-yellow-50' },
}

export default function StudentSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const appsRes = await api.get('/applications')
      const app = appsRes.data?.[0]
      
      if (app?.id) {
        const sessionsRes = await api.get(`/counseling/${app.id}`)
        setSessions(sessionsRes.data || [])
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading sessions...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Counseling Sessions</h1>
        <p className="text-gray-500 mt-1">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No counseling sessions yet</p>
          <p className="text-sm text-gray-400 mt-2">
            Your counselor will schedule sessions to discuss your application progress
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session: any) => {
            const cfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.scheduled
            const isUpcoming = session.status === 'scheduled' && new Date(session.scheduled_at) > new Date()
            const isPast = session.status === 'scheduled' && new Date(session.scheduled_at) <= new Date()

            return (
              <div key={session.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className={clsx('p-3 rounded-xl', cfg.bg)}>
                      <Calendar size={20} className={cfg.color} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">
                          {session.session_type === 'virtual' ? 'Virtual' : 'In-Person'} Session
                        </p>
                        <span className={clsx('badge text-xs', cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} />
                          <span>{new Date(session.scheduled_at).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Video size={14} />
                          <span>{session.platform}</span>
                        </div>
                      </div>
                      {session.counselor && (
                        <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                          <User size={14} />
                          <span>with {session.counselor.full_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meeting Link */}
                {isUpcoming && session.meeting_link && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Join Meeting</p>
                    <a 
                      href={session.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-sm inline-flex items-center gap-2"
                    >
                      <Video size={16} />
                      Join {session.platform} Meeting
                    </a>
                  </div>
                )}

                {/* Recommendations (if completed) */}
                {session.status === 'completed' && session.counselor_recommendations && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                      <CheckCircle size={16} />
                      Counselor's Recommendations
                    </h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {session.counselor_recommendations}
                    </p>
                  </div>
                )}

                {/* Past session without recommendations */}
                {isPast && !session.counselor_recommendations && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                    This session is pending completion by your counselor
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
