'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { STAGES, STAGE_COLORS } from '@/lib/constants'
import { Search, ChevronRight, RefreshCw, Trash2, X, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [deleting, setDeleting] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const appsRes = await api.get('/applications')
      const apps = appsRes.data || []

      // Fetch student profiles for all applications
      const studentIds = Array.from(new Set(apps.map((a: any) => a.student_id)))
      let studentMap: Record<string, any> = {}

      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, student_id, nationality, preferred_study_destination')
          .in('id', studentIds as string[])

        ;(profiles || []).forEach((p: any) => { studentMap[p.id] = p })
      }

      // Fetch counselor profiles
      const counselorIds = Array.from(new Set(
        apps.filter((a: any) => a.assigned_counselor_id).map((a: any) => a.assigned_counselor_id)
      ))
      let counselorMap: Record<string, any> = {}

      if (counselorIds.length > 0) {
        const { data: counselors } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', counselorIds as string[])

        ;(counselors || []).forEach((c: any) => { counselorMap[c.id] = c })
      }

      const enriched = apps.map((a: any) => ({
        ...a,
        student: studentMap[a.student_id] || null,
        counselor: counselorMap[a.assigned_counselor_id] || null,
      }))

      setApplications(enriched)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(app: any) {
    setDeleting(app.id)
    setConfirmDelete(null)
    try {
      await api.delete(`/applications/${app.id}`)
      setApplications(prev => prev.filter(a => a.id !== app.id))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete application.')
    } finally {
      setDeleting('')
    }
  }

  const filtered = applications.filter(app => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      app.student?.full_name?.toLowerCase().includes(q) ||
      app.student?.student_id?.toLowerCase().includes(q) ||
      app.student?.email?.toLowerCase().includes(q)
    const matchStage = !stageFilter || app.current_stage === stageFilter
    return matchSearch && matchStage
  })

  return (
    <div className="space-y-6">
      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Application</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              You are about to permanently delete the application for:
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              <p className="font-semibold text-red-800">{confirmDelete.student?.full_name || 'Unknown Student'}</p>
              <p className="text-xs text-red-600">
                ID: {confirmDelete.student?.student_id || '—'} · Stage: {confirmDelete.current_stage?.replace(/_/g, ' ').toUpperCase()}
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              This will delete all documents, session records, university applications, offers, deposit proofs, and visa details associated with this application.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting === confirmDelete.id ? 'Deleting...' : 'Yes, Delete Application'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-gray-500 mt-1">{filtered.length} of {applications.length} applications</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name, student ID, or email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-56" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nationality</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Counselor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No applications found</td></tr>
              ) : filtered.map(app => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{app.student?.full_name || '—'}</p>
                      <p className="text-gray-400 text-xs">{app.student?.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {app.student?.student_id || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{app.student?.nationality || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('badge text-xs', STAGE_COLORS[app.current_stage])}>
                      {STAGES.find(s => s.key === app.current_stage)?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {app.counselor?.full_name || <span className="text-gray-400 italic">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(app.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/applications/${app.id}`}
                        className="text-brand-600 hover:text-brand-700 p-1.5 rounded-lg hover:bg-brand-50">
                        <ChevronRight size={16} />
                      </Link>
                      <button
                        onClick={() => setConfirmDelete(app)}
                        disabled={deleting === app.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete application"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
