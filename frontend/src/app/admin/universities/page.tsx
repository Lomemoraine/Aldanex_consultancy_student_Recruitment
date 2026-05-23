'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { GraduationCap, RefreshCw, Send, User, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  preparing:      { label: 'Preparing',     color: 'text-gray-600',   bg: 'bg-gray-100' },
  submitted:      { label: 'Submitted',     color: 'text-blue-600',   bg: 'bg-blue-100' },
  offer_received: { label: 'Offer Received',color: 'text-purple-600', bg: 'bg-purple-100' },
  rejected:       { label: 'Unsuccessful',  color: 'text-red-600',    bg: 'bg-red-100' },
  withdrawn:      { label: 'Withdrawn',     color: 'text-gray-400',   bg: 'bg-gray-100' },
}

interface StudentWithApps {
  studentId: string
  studentName: string
  studentIdCode: string
  applicationId: string
  applications: any[]
  totalApps: number
  preparingCount: number
}

export default function AdminUniversitiesPage() {
  const [students, setStudents] = useState<StudentWithApps[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentWithApps | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingApps, setLoadingApps] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [submitting, setSubmitting] = useState('')
  const [submitForm, setSubmitForm] = useState<Record<string, { ref: string; sop: string }>>({})
  const [userRole, setUserRole] = useState<string>('')
  const [userId, setUserId] = useState<string>('')

  useEffect(() => { 
    loadUserRole()
  }, [])

  useEffect(() => {
    if (userRole) {
      loadStudents()
    }
  }, [userRole, userId])

  async function loadUserRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, id')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setUserRole(profile.role)
          setUserId(profile.id)
        }
      }
    } catch (err) {
      console.error('Failed to load user role:', err)
    }
  }

  async function loadStudents() {
    setLoadingStudents(true)
    try {
      const appsRes = await api.get('/applications')
      const apps = appsRes.data || []

      console.log('Total applications loaded:', apps.length)

      // Filter applications for counselors
      const filteredApps = userRole === 'counselor' 
        ? apps.filter((a: any) => a.assigned_counselor_id === userId)
        : apps

      console.log('Filtered applications:', filteredApps.length, 'Role:', userRole)

      // Fetch student profiles
      const studentIds = Array.from(new Set(filteredApps.map((a: any) => a.student_id)))
      let studentMap: Record<string, any> = {}

      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, student_id')
          .in('id', studentIds as string[])

        ;(profiles || []).forEach((p: any) => { studentMap[p.id] = p })
        console.log('Student profiles loaded:', profiles?.length)
      }

      // Load university applications for each student
      const studentsWithApps: StudentWithApps[] = []
      
      await Promise.all(filteredApps.map(async (app: any) => {
        const profile = studentMap[app.student_id]
        if (!profile) {
          console.warn('No profile found for student_id:', app.student_id)
          return
        }

        try {
          console.log('Loading universities for application:', app.id, 'Student:', profile.full_name)
          const res = await api.get(`/universities/${app.id}`)
          const uniApps = res.data || []
          
          console.log(`Student ${profile.full_name} (app_id: ${app.id}) has ${uniApps.length} university applications`)

          // Only include students who have made university applications
          if (uniApps.length > 0) {
            studentsWithApps.push({
              studentId: app.student_id,
              studentName: profile.full_name || 'Unknown',
              studentIdCode: profile.student_id || '—',
              applicationId: app.id,
              applications: uniApps,
              totalApps: uniApps.length,
              preparingCount: uniApps.filter((u: any) => u.status === 'preparing').length,
            })
          }
        } catch (err: any) {
          console.error('Failed to load universities for app:', app.id, 'Error:', err.response?.data || err.message)
        }
      }))

      console.log('Total students with university applications:', studentsWithApps.length)

      // Sort by preparing count (descending), then by name
      studentsWithApps.sort((a, b) => 
        b.preparingCount - a.preparingCount || a.studentName.localeCompare(b.studentName)
      )

      setStudents(studentsWithApps)
    } catch (err) {
      console.error('Failed to load students:', err)
    } finally {
      setLoadingStudents(false)
    }
  }

  async function selectStudent(student: StudentWithApps) {
    setSelectedStudent(student)
    setLoadingApps(true)
    try {
      // Reload fresh data for this student
      const res = await api.get(`/universities/${student.applicationId}`)
      const uniApps = res.data || []
      
      setSelectedStudent({
        ...student,
        applications: uniApps,
        totalApps: uniApps.length,
        preparingCount: uniApps.filter((u: any) => u.status === 'preparing').length,
      })
    } catch (err) {
      console.error('Failed to reload applications:', err)
    } finally {
      setLoadingApps(false)
    }
  }

  async function handleSubmit(uniId: string) {
    const f = submitForm[uniId] || { ref: '', sop: '' }
    
    if (!f.ref.trim()) {
      alert('Please enter a reference number')
      return
    }
    
    setSubmitting(uniId)
    try {
      console.log('Submitting university application:', uniId, 'with ref:', f.ref)
      
      const response = await api.patch(`/universities/${uniId}/submit`, {
        reference_number: f.ref,
        sop_url: f.sop || undefined,
      })
      
      console.log('Submit response:', response.data)
      
      // Reload current student's applications
      if (selectedStudent) {
        await selectStudent(selectedStudent)
      }
      
      // Reload students list to update counts
      await loadStudents()
      
      // Clear form
      setSubmitForm(prev => {
        const next = { ...prev }
        delete next[uniId]
        return next
      })
      
      alert('Application submitted successfully!')
    } catch (err: any) {
      console.error('Submit error:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Failed to submit application'
      alert(`Error: ${errorMsg}`)
    } finally {
      setSubmitting('')
    }
  }

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase()
    return !search ||
      s.studentName.toLowerCase().includes(q) ||
      s.studentIdCode.toLowerCase().includes(q)
  })

  const filteredApps = selectedStudent?.applications.filter(u => {
    return !statusFilter || u.status === statusFilter
  }) || []

  const totalPreparing = students.reduce((sum, s) => sum + s.preparingCount, 0)

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">

      {/* ── LEFT: Student list ── */}
      <div className={clsx(
        'w-full sm:w-80 lg:w-96 bg-white border-r border-gray-100 flex flex-col shrink-0',
        selectedStudent ? 'hidden sm:flex' : 'flex'
      )}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold">University Applications</h1>
              {totalPreparing > 0 && (
                <p className="text-xs text-orange-600 font-medium mt-0.5">{totalPreparing} ready to submit</p>
              )}
            </div>
            <button onClick={loadStudents} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8 text-sm py-2"
              placeholder="Search students..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto">
          {loadingStudents ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <User size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                {userRole === 'counselor' 
                  ? 'No university applications from your assigned students yet.'
                  : 'No students with university applications found.'
                }
              </p>
            </div>
          ) : (
            filteredStudents.map(student => (
              <button
                key={student.studentId}
                onClick={() => selectStudent(student)}
                className={clsx(
                  'w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                  selectedStudent?.studentId === student.studentId && 'bg-brand-50 border-l-2 border-l-brand-500'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <span className="text-brand-600 font-semibold text-xs">
                      {student.studentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-900 truncate">{student.studentName}</p>
                      {student.preparingCount > 0 && (
                        <span className="text-[10px] bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          {student.preparingCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{student.studentIdCode}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {student.totalApps} application{student.totalApps !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: University applications panel ── */}
      <div className={clsx(
        'flex-1 flex flex-col bg-gray-50 overflow-hidden',
        !selectedStudent ? 'hidden sm:flex' : 'flex'
      )}>
        {!selectedStudent ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <GraduationCap size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Select a student</p>
              <p className="text-gray-400 text-sm mt-1">Choose a student from the list to view their university applications</p>
            </div>
          </div>
        ) : (
          <>
            {/* Student header */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="sm:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    ←
                  </button>
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <span className="text-brand-600 font-semibold text-sm">
                      {selectedStudent.studentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedStudent.studentName}</p>
                    <p className="text-xs text-gray-400">
                      {selectedStudent.studentIdCode} · {selectedStudent.totalApps} application{selectedStudent.totalApps !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Status filter */}
                  <select
                    className="input text-sm py-1.5 w-40"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => selectStudent(selectedStudent)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              {/* Stats */}
              {selectedStudent.preparingCount > 0 && (
                <div className="mt-3 text-xs">
                  <span className="text-orange-600 font-medium">{selectedStudent.preparingCount} ready to submit</span>
                </div>
              )}
            </div>

            {/* Applications */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingApps ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
                </div>
              ) : filteredApps.length === 0 ? (
                <div className="text-center py-12">
                  <GraduationCap size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">
                    {statusFilter ? 'No applications match this filter.' : 'No university applications yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredApps.map((u: any) => {
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
                              <p className="text-sm text-gray-500">{u.course_name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Intake: {u.intake || 'Not set'}
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
          </>
        )}
      </div>
    </div>
  )
}
