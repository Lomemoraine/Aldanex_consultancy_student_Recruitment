'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'
import {
  CheckCircle, XCircle, Clock, AlertCircle, Eye,
  RefreshCw, Search, FileText, User, ChevronRight, Trash2, AlertTriangle
} from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:            { label: 'Not Uploaded',   color: 'text-gray-400',   bg: 'bg-gray-50',    border: 'border-gray-200',   icon: Clock },
  uploaded:           { label: 'Uploaded',        color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: Clock },
  under_review:       { label: 'Under Review',    color: 'text-yellow-600', bg: 'bg-yellow-50',  border: 'border-yellow-200', icon: Clock },
  approved:           { label: 'Approved',        color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-200',  icon: CheckCircle },
  rejected:           { label: 'Rejected',        color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200',    icon: XCircle },
  resubmit_requested: { label: 'Resubmit Needed', color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-200', icon: AlertCircle },
}

interface StudentRow {
  studentId: string
  studentName: string
  studentEmail: string
  studentIdCode: string
  applicationId: string
  totalDocs: number
  approvedDocs: number
  pendingReview: number
}

export default function AdminDocumentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [selected, setSelected] = useState<StudentRow | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewing, setReviewing] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<any | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string>('')
  const [downloadingDocId, setDownloadingDocId] = useState<string>('')

  useEffect(() => { loadStudents() }, [])

  async function handleDownloadDocument(doc: any) {
    setDownloadingDocId(doc.id)
    try {
      // Fetch the file as a blob
      const response = await fetch(doc.file_url)
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      
      // Create a temporary URL for the blob
      const blobUrl = window.URL.createObjectURL(blob)
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = doc.document_name || 'document'
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Failed to download document. Please try again.')
    } finally {
      setDownloadingDocId('')
    }
  }

  async function handleDeleteDoc(doc: any) {
    setDeletingDocId(doc.id)
    setConfirmDeleteDoc(null)
    try {
      await api.delete(`/documents/${doc.id}`)
      
      // Update documents locally for instant feedback
      setDocuments(prev => {
        const nextDocs = prev.filter(d => d.id !== doc.id)
        
        // Update student row counts in left panel
        setStudents(prevStudents => prevStudents.map(s => {
          if (s.studentId !== selected?.studentId) return s
          return {
            ...s,
            totalDocs: nextDocs.length,
            approvedDocs: nextDocs.filter(d => d.status === 'approved').length,
            pendingReview: nextDocs.filter(d => d.status === 'uploaded' || d.status === 'under_review').length,
          }
        }))
        
        // Update currently selected student panel counts
        setSelected(prevSelected => {
          if (!prevSelected) return null
          return {
            ...prevSelected,
            totalDocs: nextDocs.length,
            approvedDocs: nextDocs.filter(d => d.status === 'approved').length,
            pendingReview: nextDocs.filter(d => d.status === 'uploaded' || d.status === 'under_review').length,
          }
        })

        return nextDocs
      })
    } catch (err) {
      console.error('Delete document failed:', err)
    } finally {
      setDeletingDocId('')
    }
  }

  async function loadStudents() {
    setLoadingStudents(true)
    try {
      console.log('Loading students for documents page...')
      const appsRes = await api.get('/applications')
      const apps = appsRes.data || []
      console.log('Applications loaded:', apps.length)
      
      if (apps.length === 0) { 
        setStudents([])
        setLoadingStudents(false)
        return
      }

      // Load doc counts per application
      const rows: StudentRow[] = []
      await Promise.all(apps.map(async (app: any) => {
        // Use student data from the application (already includes profile data from backend)
        const student = app.student
        if (!student) {
          console.warn('No student data for application:', app.id)
          return
        }
        
        try {
          const docsRes = await api.get(`/documents/${app.id}`)
          const docs = docsRes.data || []
          rows.push({
            studentId: app.student_id,
            studentName: student.full_name || 'Unknown',
            studentEmail: student.email || '',
            studentIdCode: student.student_id || '—',
            applicationId: app.id,
            totalDocs: docs.length,
            approvedDocs: docs.filter((d: any) => d.status === 'approved').length,
            pendingReview: docs.filter((d: any) => d.status === 'uploaded' || d.status === 'under_review').length,
          })
        } catch (err) {
          console.error('Error loading documents for app:', app.id, err)
        }
      }))

      console.log('Student rows created:', rows.length)
      
      // Sort: pending review first, then by name
      rows.sort((a, b) => b.pendingReview - a.pendingReview || a.studentName.localeCompare(b.studentName))
      setStudents(rows)
    } catch (err) {
      console.error('Failed to load students:', err)
    } finally {
      setLoadingStudents(false)
    }
  }

  async function selectStudent(student: StudentRow) {
    setSelected(student)
    setLoadingDocs(true)
    setDocuments([])
    setNotes({})
    try {
      const res = await api.get(`/documents/${student.applicationId}`)
      setDocuments(res.data || [])
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoadingDocs(false)
    }
  }

  async function handleReview(docId: string, status: string) {
    setReviewing(docId)
    try {
      await api.patch(`/documents/${docId}/review`, {
        status,
        reviewer_notes: notes[docId] || '',
      })
      // Update locally for instant feedback
      setDocuments(prev => prev.map(d =>
        d.id === docId ? { ...d, status, reviewer_notes: notes[docId] || d.reviewer_notes } : d
      ))
      // Update student row counts
      setStudents(prev => prev.map(s => {
        if (s.studentId !== selected?.studentId) return s
        const updatedDocs = documents.map(d => d.id === docId ? { ...d, status } : d)
        return {
          ...s,
          approvedDocs: updatedDocs.filter(d => d.status === 'approved').length,
          pendingReview: updatedDocs.filter(d => d.status === 'uploaded' || d.status === 'under_review').length,
        }
      }))
      setNotes(prev => { const n = { ...prev }; delete n[docId]; return n })
    } catch (err) {
      console.error('Review failed:', err)
    } finally {
      setReviewing('')
    }
  }

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase()
    return !search ||
      s.studentName.toLowerCase().includes(q) ||
      s.studentEmail.toLowerCase().includes(q) ||
      s.studentIdCode.toLowerCase().includes(q)
  })

  const filteredDocs = statusFilter
    ? documents.filter(d => d.status === statusFilter)
    : documents

  const totalPending = students.reduce((sum, s) => sum + s.pendingReview, 0)

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">

      {/* Confirm delete document modal */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Document</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              You are about to permanently delete this document:
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              <p className="font-semibold text-red-800">{confirmDeleteDoc.document_name}</p>
              <p className="text-xs text-red-600">Category: {confirmDeleteDoc.category?.replace(/_/g, ' ').toUpperCase()}</p>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              This will delete the document file from Supabase storage and remove all associated review status logs.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteDoc(confirmDeleteDoc)}
                disabled={deletingDocId === confirmDeleteDoc.id}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deletingDocId === confirmDeleteDoc.id ? 'Deleting...' : 'Yes, Delete Document'}
              </button>
              <button
                onClick={() => setConfirmDeleteDoc(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LEFT: Student list ── */}
      <div className={clsx(
        'w-full sm:w-80 lg:w-96 bg-white border-r border-gray-100 flex flex-col shrink-0',
        selected ? 'hidden sm:flex' : 'flex'
      )}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold">Documents</h1>
              {totalPending > 0 && (
                <p className="text-xs text-orange-600 font-medium mt-0.5">{totalPending} pending review</p>
              )}
            </div>
            <button onClick={loadStudents} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
              <p className="text-gray-400 text-sm">No students found.</p>
            </div>
          ) : (
            filteredStudents.map(student => (
              <button
                key={student.studentId}
                onClick={() => selectStudent(student)}
                className={clsx(
                  'w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                  selected?.studentId === student.studentId && 'bg-brand-50 border-l-2 border-l-brand-500'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <User size={15} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-900 truncate">{student.studentName}</p>
                      {student.pendingReview > 0 && (
                        <span className="text-[10px] bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          {student.pendingReview}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{student.studentIdCode}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 bg-gray-200 rounded-full h-1">
                        <div
                          className="bg-green-500 h-1 rounded-full transition-all"
                          style={{ width: student.totalDocs > 0 ? `${(student.approvedDocs / student.totalDocs) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {student.approvedDocs}/{student.totalDocs}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: Document detail panel ── */}
      <div className={clsx(
        'flex-1 flex flex-col bg-gray-50 overflow-hidden',
        !selected ? 'hidden sm:flex' : 'flex'
      )}>
        {!selected ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Select a student</p>
              <p className="text-gray-400 text-sm mt-1">Choose a student from the list to review their documents</p>
            </div>
          </div>
        ) : (
          <>
            {/* Student header */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    className="sm:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    ←
                  </button>
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <User size={18} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selected.studentName}</p>
                    <p className="text-xs text-gray-400">
                      {selected.studentIdCode} · {selected.studentEmail}
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
                    <option value="">All Documents</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => selectStudent(selected)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              {/* Progress summary */}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span className="text-green-600 font-medium">{selected.approvedDocs} approved</span>
                <span className="text-orange-600 font-medium">{selected.pendingReview} pending review</span>
                <span>{selected.totalDocs} total</span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-xs">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: selected.totalDocs > 0 ? `${(selected.approvedDocs / selected.totalDocs) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDocs ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">
                    {documents.length === 0 ? 'No documents uploaded yet.' : 'No documents match this filter.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocs.map(doc => {
                    const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending
                    const Icon = cfg.icon
                    const isReviewing = reviewing === doc.id
                    const canReview = doc.status === 'uploaded' || doc.status === 'under_review'
                    const isApproved = doc.status === 'approved'
                    const isRejected = doc.status === 'rejected'
                    const isResubmit = doc.status === 'resubmit_requested'

                    return (
                      <div key={doc.id} className={clsx(
                        'bg-white rounded-xl border p-5 transition-all',
                        canReview ? 'border-orange-200 shadow-sm' : 'border-gray-100'
                      )}>
                        {/* Doc header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <p className="font-semibold text-gray-900">{doc.document_name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                              <span className="capitalize">{doc.category?.replace(/_/g, ' ')}</span>
                              {doc.file_size_kb && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {doc.file_size_kb < 1024
                                      ? `${doc.file_size_kb} KB`
                                      : `${(doc.file_size_kb / 1024).toFixed(1)} MB`}
                                  </span>
                                </>
                              )}
                              {doc.uploaded_at && (
                                <>
                                  <span>·</span>
                                  <span>Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                            {doc.reviewer_notes && (
                              <p className="text-xs text-orange-600 mt-1.5 bg-orange-50 px-2 py-1 rounded">
                                Note: {doc.reviewer_notes}
                              </p>
                            )}
                          </div>

                          {/* Status badge */}
                          <span className={clsx(
                            'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border shrink-0',
                            cfg.bg, cfg.color, cfg.border
                          )}>
                            <Icon size={12} />
                            {cfg.label}
                          </span>
                        </div>

                        {/* Action row */}
                        <div className="flex items-center gap-2 flex-wrap w-full">

                          {/* View & Download */}
                          {doc.file_url && (
                            <>
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 px-3 py-2 rounded-lg border border-brand-200 hover:bg-brand-50 transition-colors font-medium"
                              >
                                <Eye size={13} /> View Document
                              </a>
                              <button
                                onClick={() => handleDownloadDocument(doc)}
                                disabled={downloadingDocId === doc.id}
                                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors font-medium disabled:opacity-50"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                {downloadingDocId === doc.id ? 'Downloading...' : 'Download'}
                              </button>
                            </>
                          )}

                          {/* Delete Document */}
                          <button
                            onClick={() => setConfirmDeleteDoc(doc)}
                            disabled={deletingDocId === doc.id}
                            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition-colors font-medium sm:ml-auto"
                            title="Delete document"
                          >
                            <Trash2 size={13} /> Delete
                          </button>

                          {/* Review actions */}
                          {canReview && (
                            <>
                              <input
                                type="text"
                                className="input text-xs py-2 w-44"
                                placeholder="Add note (optional)"
                                value={notes[doc.id] || ''}
                                onChange={e => setNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => handleReview(doc.id, 'approved')}
                                disabled={isReviewing}
                                className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                              >
                                <CheckCircle size={13} />
                                {isReviewing ? 'Saving...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleReview(doc.id, 'rejected')}
                                disabled={isReviewing}
                                className="flex items-center gap-1.5 text-xs bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors font-medium"
                              >
                                <XCircle size={13} />
                                Reject
                              </button>
                              <button
                                onClick={() => handleReview(doc.id, 'resubmit_requested')}
                                disabled={isReviewing}
                                className="flex items-center gap-1.5 text-xs bg-orange-100 text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-200 disabled:opacity-50 transition-colors font-medium"
                              >
                                <AlertCircle size={13} />
                                Request Resubmit
                              </button>
                            </>
                          )}

                          {/* Post-review status buttons */}
                          {isApproved && (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 text-xs text-green-700 font-semibold bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                                <CheckCircle size={13} /> Approved
                              </span>
                              <button
                                onClick={() => handleReview(doc.id, 'rejected')}
                                disabled={isReviewing}
                                className="text-xs text-gray-400 hover:text-red-500 underline"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {isRejected && (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 text-xs text-red-700 font-semibold bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                                <XCircle size={13} /> Rejected
                              </span>
                              <button
                                onClick={() => handleReview(doc.id, 'approved')}
                                disabled={isReviewing}
                                className="text-xs text-gray-400 hover:text-green-600 underline"
                              >
                                Approve instead
                              </button>
                            </div>
                          )}

                          {isResubmit && (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 text-xs text-orange-700 font-semibold bg-orange-50 px-4 py-2 rounded-lg border border-orange-200">
                                <AlertCircle size={13} /> Resubmit Requested
                              </span>
                              <button
                                onClick={() => handleReview(doc.id, 'approved')}
                                disabled={isReviewing}
                                className="text-xs text-gray-400 hover:text-green-600 underline"
                              >
                                Approve instead
                              </button>
                            </div>
                          )}
                        </div>
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
