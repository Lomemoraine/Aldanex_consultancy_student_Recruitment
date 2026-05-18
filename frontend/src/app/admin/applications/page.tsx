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
      const studentIds = [...new Set(apps.map((a: any) => a.student_id))]
      let studentMap: Record<string, any> = {}

      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, student_id, nationality, preferred_study_destination')
          .in('id', studentIds as string[])

        ;(profiles || []).forEach((p: any) => { studentMap[p.id] = p })
      }

      // Fetch counselor profiles
      const counselorIds = [...new Set(
        apps.filter((a: any) => a.assigned_counselor_id).map((a: any) => a.assigned_counselor_id)
      )]
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-gray-500 mt-1">{filtered.length} of {applications.length} applications</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

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
                <th className="px-4 py-3" />
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
                    <Link href={`/admin/applications/${app.id}`}
                      className="text-brand-600 hover:text-brand-700">
                      <ChevronRight size={16} />
                    </Link>
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
