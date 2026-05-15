'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { STAGES, STAGE_COLORS } from '@/lib/constants'
import { Search, ChevronRight, Users, RefreshCw, Download } from 'lucide-react'
import clsx from 'clsx'

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [studentsRes, appsRes] = await Promise.all([
        api.get('/students'),
        api.get('/applications'),
      ])
      // Merge application stage into student records
      const apps: Record<string, any> = {}
      ;(appsRes.data || []).forEach((a: any) => { apps[a.student_id] = a })

      const merged = (studentsRes.data?.data || []).map((s: any) => ({
        ...s,
        application: apps[s.id] || null,
      }))
      setStudents(merged)
    } catch (err) {
      console.error(err)
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
          <p className="text-gray-500 mt-1">{filtered.length} of {students.length} students</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
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
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No students found</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-gray-400 text-xs">{s.email}</p>
                    </div>
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
                    {s.application?.id && (
                      <Link href={`/admin/applications/${s.application.id}`}
                        className="text-brand-600 hover:text-brand-700">
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
