'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Calendar, Plus, X, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:    { label: 'Scheduled',   color: 'text-blue-600',   bg: 'bg-blue-50' },
  completed:    { label: 'Completed',   color: 'text-green-600',  bg: 'bg-green-50' },
  cancelled:    { label: 'Cancelled',   color: 'text-red-600',    bg: 'bg-red-50' },
  rescheduled:  { label: 'Rescheduled', color: 'text-yellow-600', bg: 'bg-yellow-50' },
}

const EMPTY_FORM = {
  application_id: '', student_id: '', session_type: 'virtual',
  platform: 'Zoom', meeting_link: '', scheduled_at: '', duration_minutes: '60',
}

export default function AdminCounselingPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [statusFilter, setStatusFilter] = useState('scheduled')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const appsRes = await api.get('/applications')
      const apps = appsRes.data || []
      setApplications(apps)

      const allSessions: any[] = []
      await Promise.all(apps.map(async (app: any) => {
        try {
          const res = await api.get(`/counseling/${app.id}`)
          const sessions = (res.data || []).map((s: any) => ({
            ...s,
            student_name: app.student?.full_name || 'Unknown',
            student_id_code: app.student?.student_id || '—',
          }))
          allSessions.push(...sessions)
        } catch {}
      }))

      allSessions.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      setSessions(allSessions)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const app = applications.find(a => a.id === form.application_id)
      await api.post('/counseling', {
        ...form,
        student_id: app?.student_id || form.student_id,
        duration_minutes: Number(form.duration_minutes),
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to schedule session.')
    } finally {
      setSubmitting(false)
    }
  }

  async function markComplete(sessionId: string) {
    try {
      await api.patch(`/counseling/${sessionId}`, { status: 'completed' })
      await load()
    } catch (err) { console.error(err) }
  }

  const filtered = sessions.filter(s => !statusFilter || s.status === statusFilter)
  const upcomingCount = sessions.filter(s => s.status === 'scheduled').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Counseling Sessions</h1>
          <p className="text-gray-500 mt-1">
            {upcomingCount > 0 && <span className="text-blue-600 font-medium">{upcomingCount} upcoming · </span>}
            {filtered.length} shown
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => { setShowForm(true); setFormError('') }}
            className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Schedule Session
          </button>
        </div>
      </div>

      {/* Schedule Form */}
      {showForm && (
        <div className="card border-2 border-brand-200">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">Schedule Counseling Session</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <form onSubmit={handleSchedule} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Student / Application *</label>
                <select className="input" required value={form.application_id}
                  onChange={e => setForm(p => ({ ...p, application_id: e.target.value }))}>
                  <option value="">Select student</option>
                  {applications.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.student?.full_name || 'Unknown'} ({a.student?.student_id || a.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Session Type</label>
                <select className="input" value={form.session_type}
                  onChange={e => setForm(p => ({ ...p, session_type: e.target.value }))}>
                  <option value="virtual">Virtual</option>
                  <option value="physical">In-Person</option>
                </select>
              </div>
              <div>
                <label className="label">Platform</label>
                <select className="input" value={form.platform}
                  onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                  <option>Zoom</option>
                  <option>Google Meet</option>
                  <option>Microsoft Teams</option>
                  <option>WhatsApp</option>
                  <option>In-Person</option>
                </select>
              </div>
              <div>
                <label className="label">Date & Time *</label>
                <input type="datetime-local" className="input" required value={form.scheduled_at}
                  onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} />
              </div>
              <div>
                <label className="label">Duration (minutes)</label>
                <select className="input" value={form.duration_minutes}
                  onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))}>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Meeting Link</label>
                <input type="url" className="input" value={form.meeting_link}
                  onChange={e => setForm(p => ({ ...p, meeting_link: e.target.value }))}
                  placeholder="https://zoom.us/j/..." />
              </div>
            </div>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">{formError}</div>
            )}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={submitting}>
                <Calendar size={16} /> {submitting ? 'Scheduling...' : 'Schedule Session'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'scheduled', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={clsx('text-sm px-3 py-1.5 rounded-lg font-medium transition-colors',
              statusFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No sessions found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s: any) => {
            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled
            return (
              <div key={s.id} className="card flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={clsx('p-2.5 rounded-xl shrink-0', cfg.bg)}>
                    <Calendar size={18} className={cfg.color} />
                  </div>
                  <div>
                    <p className="font-semibold">{s.student_name}</p>
                    <p className="text-sm text-gray-500">
                      {s.session_type} · {s.platform} · {s.duration_minutes} min
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(s.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={clsx('badge text-xs', cfg.bg, cfg.color)}>{cfg.label}</span>
                  {s.meeting_link && (
                    <a href={s.meeting_link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:underline">Join</a>
                  )}
                  {s.status === 'scheduled' && (
                    <button onClick={() => markComplete(s.id)}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200">
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
