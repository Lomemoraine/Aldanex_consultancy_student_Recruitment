'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { STAGES, STAGE_COLORS } from '@/lib/constants'
import { CheckCircle, Clock, ArrowLeft, User, FileText, MessageSquare } from 'lucide-react'
import clsx from 'clsx'

export default function ApplicationDetailPage() {
  const { id } = useParams()
  const [application, setApplication] = useState<any>(null)
  const [student, setStudent] = useState<any>(null)
  const [studentProfile, setStudentProfile] = useState<any>(null)
  const [counselors, setCounselors] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [notes, setNotes] = useState('')
  const [selectedCounselor, setSelectedCounselor] = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    try {
      const appRes = await api.get(`/applications/${id}`)
      const app = appRes.data
      setApplication(app)

      // Load student profile
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', app.student_id)
        .single()
      setStudent(p)

      const { data: sp } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', app.student_id)
        .single()
      setStudentProfile(sp)

      // Load documents
      const docsRes = await api.get(`/documents/${id}`)
      setDocuments(docsRes.data || [])

      // Load counselors for assignment
      const { data: staff } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['counselor', 'admissions'])
      setCounselors(staff || [])

      if (app.assigned_counselor_id) setSelectedCounselor(app.assigned_counselor_id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function advanceStage() {
    const currentIdx = STAGES.findIndex(s => s.key === application.current_stage)
    if (currentIdx >= STAGES.length - 1) return
    const nextStage = STAGES[currentIdx + 1].key
    setAdvancing(true)
    try {
      await api.patch(`/applications/${id}/stage`, { stage: nextStage, notes })
      setApplication((prev: any) => ({ ...prev, current_stage: nextStage }))
      setNotes('')
    } finally {
      setAdvancing(false)
    }
  }

  async function assignCounselor() {
    if (!selectedCounselor) return
    setAssigning(true)
    try {
      await api.patch(`/applications/${id}/assign`, { counselor_id: selectedCounselor })
      setApplication((prev: any) => ({ ...prev, assigned_counselor_id: selectedCounselor }))
    } finally {
      setAssigning(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  )

  if (!application) return (
    <div className="text-center py-12 text-gray-400">Application not found</div>
  )

  const currentIdx = STAGES.findIndex(s => s.key === application.current_stage)
  const docStats = {
    approved: documents.filter(d => d.status === 'approved').length,
    pending: documents.filter(d => ['uploaded', 'under_review'].includes(d.status)).length,
    rejected: documents.filter(d => d.status === 'rejected').length,
    total: documents.length,
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + Header */}
      <div>
        <Link href="/admin/applications" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={14} /> Back to Applications
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{student?.full_name || 'Student'}</h1>
            <p className="text-gray-500 mt-0.5">
              {student?.student_id} · {student?.email}
            </p>
          </div>
          <span className={clsx('badge text-sm px-3 py-1', STAGE_COLORS[application.current_stage])}>
            {STAGES.find(s => s.key === application.current_stage)?.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Timeline */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-5">Application Timeline</h2>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-3">
                {STAGES.map((stage, idx) => {
                  const isCompleted = idx < currentIdx
                  const isCurrent = idx === currentIdx
                  return (
                    <div key={stage.key} className="flex items-center gap-4 relative pl-10">
                      <div className={clsx(
                        'absolute left-2.5 w-3 h-3 rounded-full border-2',
                        isCompleted ? 'bg-green-500 border-green-500' :
                        isCurrent   ? 'bg-brand-600 border-brand-600' :
                                      'bg-white border-gray-300'
                      )} />
                      <div className={clsx(
                        'flex-1 flex items-center justify-between p-2.5 rounded-lg',
                        isCurrent ? 'bg-brand-50 border border-brand-200' : 'bg-gray-50'
                      )}>
                        <span className={clsx('text-sm font-medium',
                          isCompleted ? 'text-green-700' :
                          isCurrent   ? 'text-brand-700' : 'text-gray-400')}>
                          {stage.label}
                        </span>
                        {isCompleted && <CheckCircle size={14} className="text-green-500" />}
                        {isCurrent && <Clock size={14} className="text-brand-500" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Advance stage */}
          {currentIdx < STAGES.length - 1 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3">Advance Stage</h2>
              <p className="text-sm text-gray-500 mb-3">
                Next: <strong>{STAGES[currentIdx + 1]?.label}</strong>
              </p>
              <textarea className="input mb-3" rows={2}
                placeholder="Add notes for the student (optional)..."
                value={notes} onChange={e => setNotes(e.target.value)} />
              <button onClick={advanceStage} disabled={advancing} className="btn-primary">
                {advancing ? 'Advancing...' : `Advance to ${STAGES[currentIdx + 1]?.label}`}
              </button>
            </div>
          )}

          {/* Documents */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Documents</h2>
              <Link href={`/admin/documents`} className="text-sm text-brand-600 hover:underline">
                Review all →
              </Link>
            </div>
            {documents.length === 0 ? (
              <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Approved',  value: docStats.approved,  color: 'text-green-600',  bg: 'bg-green-50' },
                  { label: 'Pending',   value: docStats.pending,   color: 'text-yellow-600', bg: 'bg-yellow-50' },
                  { label: 'Rejected',  value: docStats.rejected,  color: 'text-red-600',    bg: 'bg-red-50' },
                  { label: 'Total',     value: docStats.total,     color: 'text-gray-600',   bg: 'bg-gray-50' },
                ].map(stat => (
                  <div key={stat.label} className={clsx('p-3 rounded-lg text-center', stat.bg)}>
                    <p className={clsx('text-2xl font-bold', stat.color)}>{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Student info */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <User size={16} className="text-brand-600" />
              <h2 className="font-semibold">Student Info</h2>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ['Nationality',   student?.nationality],
                ['Phone',         student?.phone],
                ['Destination',   student?.preferred_study_destination],
                ['Course',        studentProfile?.preferred_course],
                ['Intake',        studentProfile?.preferred_intake],
                ['Qualification', studentProfile?.qualification_level],
                ['Budget',        studentProfile?.budget_range],
              ].map(([label, value]) => value ? (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-gray-400 shrink-0">{label}</dt>
                  <dd className="font-medium text-right">{value}</dd>
                </div>
              ) : null)}
            </dl>
          </div>

          {/* Assign counselor */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-brand-600" />
              <h2 className="font-semibold">Assign Counselor</h2>
            </div>
            <select className="input mb-3" value={selectedCounselor}
              onChange={e => setSelectedCounselor(e.target.value)}>
              <option value="">Select counselor</option>
              {counselors.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
            <button onClick={assignCounselor} disabled={assigning || !selectedCounselor}
              className="btn-primary w-full text-sm disabled:opacity-50">
              {assigning ? 'Assigning...' : 'Assign'}
            </button>
          </div>

          {/* Quick links */}
          <div className="card">
            <h2 className="font-semibold mb-3">Quick Links</h2>
            <div className="space-y-2">
              <Link href="/admin/documents"
                className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
                <FileText size={14} /> Review Documents
              </Link>
              <Link href="/admin/counseling"
                className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
                <MessageSquare size={14} /> Schedule Session
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
