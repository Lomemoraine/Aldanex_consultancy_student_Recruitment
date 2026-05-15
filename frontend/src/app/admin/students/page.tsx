'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { STAGES, STAGE_COLORS } from '@/lib/constants'
import { Search, ChevronRight, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      // Load students directly from Supabase
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, student_id, nationality, preferred_study_destination, phone, created_at')
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      if (!profiles || profiles.length === 0) {
        setStudents([])
        setLoading(false)
        return
      }

      // Load applications for all students
      const studentIds = profiles.map((p: any) => p.id)
      const { data: applications } = await supabase
        .from('applications')
        .select('id, student_id, current_stage, assigned_counselor_id')
        .in('student_id', studentIds)

      // Build a map of student_id → application
      const appMap: Record<string, any> = {}
      ;(applications || []).forEach((a: any) => { appMap[a.student_id] = a })

      // Merge
      const merged = profiles.map((p: any) => ({
        ...p,
        application: appMap[p.id] || null,
      }))

      setStudents(merged)
    } catch (err: any) {
      console.error('Failed to load students:', err)
      setError(err.message || 'Failed to load students.')
    } finally {
      setLoading(false)
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, ID, email, nationality..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-52"
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
        >
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Destination</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registered</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600" />
                      Loading students...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    {students.length === 0 ? 'No students registered yet.' : 'No students match your search.'}
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-gray-400 text-xs">{s.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {s.student_id || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.nationality || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.preferred_study_destination || '—'}</td>
                  <td className="px-4 py-3">
                    {s.application?.current_stage ? (
                      <span className={clsx('badge text-xs', STAGE_COLORS[s.application.current_stage])}>
                        {STAGES.find(st => st.key === s.application.current_stage)?.label}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {s.application?.id && (
                      <Link
                        href={`/admin/applications/${s.application.id}`}
                        className="text-brand-600 hover:text-brand-700"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    )}
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
