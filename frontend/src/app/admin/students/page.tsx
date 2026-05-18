'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'
import { STAGES, STAGE_COLORS } from '@/lib/constants'
import { Search, ChevronRight, RefreshCw, Trash2, X, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [deleting, setDeleting] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null) // student to confirm delete

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, student_id, nationality, preferred_study_destination, phone, created_at')
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError
      if (!profiles || profiles.length === 0) { setStudents([]); setLoading(false); return }

      const studentIds = profiles.map((p: any) => p.id)
      const { data: applications } = await supabase
        .from('applications')
        .select('id, student_id, current_stage')
        .in('student_id', studentIds)

      const appMap: Record<string, any> = {}
      ;(applications || []).forEach((a: any) => { appMap[a.student_id] = a })

      setStudents(profiles.map((p: any) => ({ ...p, application: appMap[p.id] || null })))
    } catch (err: any) {
      setError(err.message || 'Failed to load students.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(student: any) {
    setDeleting(student.id)
    setConfirmDelete(null)
    try {
      await api.delete(`/admin/students/${student.id}`)
      setStudents(prev => prev.filter(s => s.id !== student.id))
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete student.')
    } finally {
      setDeleting('')
    }
  }

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.student_id?.toLowerCase().includes(q) ||
      s.nationality?.toLowerCase().includes(q)
    const matchStage = !stageFilter || s.application?.current_stage === stageFilter
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
                <h3 className="font-bold text-gray-900">Delete Student</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              You are about to permanently delete:
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              <p className="font-semibold text-red-800">{confirmDelete.full_name}</p>
              <p className="text-xs text-red-600">{confirmDelete.email} · {confirmDelete.student_id}</p>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              This will delete the student's account, profile, all documents, applications, messages and payment records.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting === confirmDelete.id ? 'Deleting...' : 'Yes, Delete Student'}
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
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-gray-500 mt-1">
            {loading ? 'Loading...' : `${filtered.length} of ${students.length} students`}
          </p>
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name, ID, email, nationality..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-52" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nationality</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Destination</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registered</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600" />
                    Loading students...
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                  {students.length === 0 ? 'No students registered yet.' : 'No students match your search.'}
                </td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.full_name}</p>
                    <p className="text-gray-400 text-xs">{s.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.student_id || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.nationality || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.preferred_study_destination || '—'}</td>
                  <td className="px-4 py-3">
                    {s.application?.current_stage ? (
                      <span className={clsx('badge text-xs', STAGE_COLORS[s.application.current_stage])}>
                        {STAGES.find(st => st.key === s.application.current_stage)?.label}
                      </span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {s.application?.id && (
                        <Link href={`/admin/applications/${s.application.id}`}
                          className="text-brand-600 hover:text-brand-700 p-1.5 rounded-lg hover:bg-brand-50">
                          <ChevronRight size={16} />
                        </Link>
                      )}
                      <button
                        onClick={() => setConfirmDelete(s)}
                        disabled={deleting === s.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete student"
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
