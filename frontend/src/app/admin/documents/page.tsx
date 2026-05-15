'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Search, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, Eye } from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:            { label: 'Pending',        color: 'text-gray-500',   bg: 'bg-gray-100',   icon: Clock },
  uploaded:           { label: 'Uploaded',        color: 'text-blue-600',   bg: 'bg-blue-50',    icon: Clock },
  under_review:       { label: 'Under Review',    color: 'text-yellow-600', bg: 'bg-yellow-50',  icon: Clock },
  approved:           { label: 'Approved',        color: 'text-green-600',  bg: 'bg-green-50',   icon: CheckCircle },
  rejected:           { label: 'Rejected',        color: 'text-red-600',    bg: 'bg-red-50',     icon: XCircle },
  resubmit_requested: { label: 'Resubmit',        color: 'text-orange-600', bg: 'bg-orange-50',  icon: AlertCircle },
}

export default function AdminDocumentsPage() {
  const [applications, setApplications] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('uploaded')
  const [reviewing, setReviewing] = useState('')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const appsRes = await api.get('/applications')
      const apps = appsRes.data || []
      setApplications(apps)

      // Load documents for all applications
      const allDocs: any[] = []
      await Promise.all(apps.map(async (app: any) => {
        try {
          const docsRes = await api.get(`/documents/${app.id}`)
          const docs = (docsRes.data || []).map((d: any) => ({
            ...d,
            student_name: app.student?.full_name || 'Unknown',
            student_id_code: app.student?.student_id || '—',
            application_id: app.id,
          }))
          allDocs.push(...docs)
        } catch {}
      }))
      setDocuments(allDocs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleReview(docId: string, status: string) {
    setReviewing(docId)
    try {
      await api.patch(`/documents/${docId}/review`, {
        status,
        reviewer_notes: reviewNotes[docId] || '',
      })
      await load()
      setReviewNotes(prev => { const n = { ...prev }; delete n[docId]; return n })
    } catch (err) {
      console.error(err)
    } finally {
      setReviewing('')
    }
  }

  const filtered = documents.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      d.document_name?.toLowerCase().includes(q) ||
      d.student_name?.toLowerCase().includes(q) ||
      d.student_id_code?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || d.status === statusFilter
    return matchSearch && matchStatus
  })

  const pendingCount = documents.filter(d => d.status === 'uploaded' || d.status === 'under_review').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-gray-500 mt-1">
            {pendingCount > 0 && <span className="text-orange-600 font-medium">{pendingCount} pending review · </span>}
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
          <input className="input pl-9" placeholder="Search by document name or student..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Documents list */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Uploaded</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No documents found</td></tr>
              ) : filtered.map(doc => {
                const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending
                const Icon = cfg.icon
                const isReviewing = reviewing === doc.id
                const canReview = doc.status === 'uploaded' || doc.status === 'under_review'

                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{doc.document_name}</p>
                      {doc.file_size_kb && (
                        <p className="text-xs text-gray-400">{doc.file_size_kb < 1024 ? `${doc.file_size_kb}KB` : `${(doc.file_size_kb/1024).toFixed(1)}MB`}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{doc.student_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{doc.student_id_code}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-600">
                      {doc.category?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full w-fit', cfg.bg, cfg.color)}>
                        <Icon size={11} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                            <Eye size={12} /> View
                          </a>
                        )}
                        {canReview && (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              className="input text-xs py-1 w-32"
                              placeholder="Notes (optional)"
                              value={reviewNotes[doc.id] || ''}
                              onChange={e => setReviewNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                            />
                            <button
                              onClick={() => handleReview(doc.id, 'approved')}
                              disabled={isReviewing}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {isReviewing ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleReview(doc.id, 'rejected')}
                              disabled={isReviewing}
                              className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200 disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleReview(doc.id, 'resubmit_requested')}
                              disabled={isReviewing}
                              className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-lg hover:bg-orange-200 disabled:opacity-50"
                            >
                              Resubmit
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
