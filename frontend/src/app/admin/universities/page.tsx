'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { GraduationCap, RefreshCw, Send, CheckCircle, Clock, X, Search } from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  preparing:      { label: 'Preparing',     color: 'text-gray-600',   bg: 'bg-gray-100' },
  submitted:      { label: 'Submitted',     color: 'text-blue-600',   bg: 'bg-blue-100' },
  offer_received: { label: 'Offer Received',color: 'text-purple-600', bg: 'bg-purple-100' },
  rejected:       { label: 'Unsuccessful',  color: 'text-red-600',    bg: 'bg-red-100' },
  withdrawn:      { label: 'Withdrawn',     color: 'text-gray-400',   bg: 'bg-gray-100' },
}

export default function AdminUniversitiesPage() {
  const [uniApps, setUniApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [submitting, setSubmitting] = useState('')
  const [submitForm, setSubmitForm] = useState<Record<string, { ref: string; sop: string }>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const appsRes = await api.get('/applications')
      const apps = appsRes.data || []

      const all: any[] = []
      await Promise.all(apps.map(async (app: any) => {
        try {
          const res = await api.get(`/universities/${app.id}`)
          const unis = (res.data || []).map((u: any) => ({
            ...u,
            student_name: app.student?.full_name || 'Unknown',
            student_id_code: app.student?.student_id || '—',
          }))
          all.push(...unis)
        } catch {}
      }))

      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setUniApps(all)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(uniId: string) {
    const f = submitForm[uniId] || { ref: '', sop: '' }
    setSubmitting(uniId)
    try {
      await api.patch(`/universities/${uniId}/submit`, {
        reference_number: f.ref,
        sop_url: f.sop || undefined,
      })
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting('')
    }
  }

  const filtered = uniApps.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      u.university_name?.toLowerCase().includes(q) ||
      u.course_name?.toLowerCase().includes(q) ||
      u.student_name?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || u.status === statusFilter
    return matchSearch && matchStatus
  })

  const preparingCount = uniApps.filter(u => u.status === 'preparing').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">University Applications</h1>
          <p className="text-gray-500 mt-1">
            {preparingCount > 0 && <span className="text-orange-600 font-medium">{preparingCount} ready to submit · </span>}
            {filtered.length} shown
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by university, course, or student..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <GraduationCap size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No university applications found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((u: any) => {
            const cfg = STATUS_CONFIG[u.status] || STATUS_CONFIG.preparing
            const f = submitForm[u.id] || { ref: '', sop: '' }

            return (
              <div key={u.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-brand-50 rounded-xl shrink-0">
                      <GraduationCap size={18} className="text-brand-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{u.university_name}</p>
                      <p className="text-sm text-gray-500">{u.course_name} · {u.intake || 'No intake set'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Student: <span className="font-medium">{u.student_name}</span> ({u.student_id_code})
                      </p>
                      {u.reference_number && (
                        <p className="text-xs font-mono text-gray-400 mt-0.5">Ref: {u.reference_number}</p>
                      )}
                    </div>
                  </div>
                  <span className={clsx('badge text-xs shrink-0', cfg.bg, cfg.color)}>{cfg.label}</span>
                </div>

                {/* Submit action for preparing applications */}
                {u.status === 'preparing' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      className="input text-sm flex-1 min-w-[160px]"
                      placeholder="Reference number"
                      value={f.ref}
                      onChange={e => setSubmitForm(prev => ({ ...prev, [u.id]: { ...f, ref: e.target.value } }))}
                    />
                    <input
                      type="url"
                      className="input text-sm flex-1 min-w-[160px]"
                      placeholder="SOP URL (optional)"
                      value={f.sop}
                      onChange={e => setSubmitForm(prev => ({ ...prev, [u.id]: { ...f, sop: e.target.value } }))}
                    />
                    <button
                      onClick={() => handleSubmit(u.id)}
                      disabled={submitting === u.id || !f.ref.trim()}
                      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Send size={14} />
                      {submitting === u.id ? 'Submitting...' : 'Mark Submitted'}
                    </button>
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
