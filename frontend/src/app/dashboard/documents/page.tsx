'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'
import {
  Upload, CheckCircle, XCircle, Clock, AlertCircle,
  FileText, Eye, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react'
import clsx from 'clsx'

// ── Types ────────────────────────────────────────────────────
interface DocStatus {
  label: string
  color: string
  bg: string
  icon: any
}

const STATUS_CONFIG: Record<string, DocStatus> = {
  pending:            { label: 'Not Uploaded',   color: 'text-gray-500',   bg: 'bg-gray-100',   icon: Clock },
  uploaded:           { label: 'Uploaded',        color: 'text-blue-600',   bg: 'bg-blue-50',    icon: Clock },
  under_review:       { label: 'Under Review',    color: 'text-yellow-600', bg: 'bg-yellow-50',  icon: Clock },
  approved:           { label: 'Approved',        color: 'text-green-600',  bg: 'bg-green-50',   icon: CheckCircle },
  rejected:           { label: 'Rejected',        color: 'text-red-600',    bg: 'bg-red-50',     icon: XCircle },
  resubmit_requested: { label: 'Resubmit Needed', color: 'text-orange-600', bg: 'bg-orange-50',  icon: AlertCircle },
}

// ── Document categories and required docs ────────────────────
const CATEGORIES = [
  {
    key: 'academic',
    label: 'Academic Documents',
    description: 'Certificates, transcripts and academic records',
    docs: [
      'Degree / Diploma Certificate',
      'Academic Transcripts',
      'Secondary School Certificate (KCSE / O-Level)',
    ],
  },
  {
    key: 'identification',
    label: 'Identification',
    description: 'Valid passport and ID documents',
    docs: [
      'Passport (Bio-data page)',
      'National ID Card',
      'Passport Photograph (white background)',
    ],
  },
  {
    key: 'english_proficiency',
    label: 'English Proficiency',
    description: 'IELTS, TOEFL, PTE or equivalent test results',
    docs: [
      'IELTS / TOEFL / PTE Score Report',
    ],
  },
  {
    key: 'financial',
    label: 'Financial Documents',
    description: 'Bank statements and sponsorship letters',
    docs: [
      'Bank Statement (last 6 months)',
      'Sponsorship / Funding Letter',
    ],
  },
  {
    key: 'additional',
    label: 'Additional Documents',
    description: 'CV, personal statement and references',
    docs: [
      'CV / Resume',
      'Personal Statement / Statement of Purpose',
      'Reference / Recommendation Letter',
    ],
  },
]

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [applicationId, setApplicationId] = useState('')
  const [uploading, setUploading] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    academic: true,
    identification: true,
    english_proficiency: true,
    financial: true,
    additional: true,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const appRes = await api.get('/applications')
      const app = appRes.data?.[0]
      if (!app) return

      setApplicationId(app.id)
      const docsRes = await api.get(`/documents/${app.id}`)
      setDocuments(docsRes.data || [])
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    category: string,
    docName: string
  ) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset input so same file can be re-selected
    if (!file || !applicationId) return

    // Validate file type and size
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowed.includes(file.type)) {
      setUploadError(`${docName}: Only PDF, JPG, and PNG files are allowed.`)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`${docName}: File must be under 5MB.`)
      return
    }

    setUploading(docName)
    setUploadError('')

    try {
      // 1. Get signed upload URL from backend
      const { data: urlData } = await api.post('/documents/upload-url', {
        file_name: file.name,
        file_type: file.type,
        category,
        application_id: applicationId,
      })

      // 2. Upload file directly to Supabase Storage
      const uploadRes = await fetch(urlData.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!uploadRes.ok) throw new Error('Storage upload failed')

      // 3. Register document record in DB
      await api.post('/documents', {
        application_id: applicationId,
        category,
        document_name: docName,
        file_path: urlData.file_path,
        file_type: file.type,
        file_size_kb: Math.round(file.size / 1024),
      })

      // 4. Refresh document list
      const docsRes = await api.get(`/documents/${applicationId}`)
      setDocuments(docsRes.data || [])
    } catch (err: any) {
      setUploadError(`Failed to upload ${docName}. Please try again.`)
      console.error('Upload failed:', err)
    } finally {
      setUploading('')
    }
  }

  function getDoc(category: string, docName: string) {
    return documents.find(d => d.category === category && d.document_name === docName)
  }

  function getCategoryStats(category: string, docs: string[]) {
    const uploaded = docs.filter(d => {
      const doc = getDoc(category, d)
      return doc && doc.status !== 'pending'
    }).length
    const approved = docs.filter(d => getDoc(category, d)?.status === 'approved').length
    return { uploaded, approved, total: docs.length }
  }

  // Overall stats
  const allDocs = CATEGORIES.flatMap(c => c.docs.map(d => getDoc(c.key, d)))
  const totalRequired = CATEGORIES.reduce((sum, c) => sum + c.docs.length, 0)
  const totalUploaded = allDocs.filter(d => d && d.status !== 'pending').length
  const totalApproved = allDocs.filter(d => d?.status === 'approved').length
  const overallPct = Math.round((totalUploaded / totalRequired) * 100)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading documents...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-gray-500 mt-1">Upload all required documents for your application</p>
        </div>
        <button
          onClick={loadData}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Overall progress */}
      <div className="card">
        <div className="flex flex-wrap gap-6 mb-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-brand-600">{totalUploaded}</p>
            <p className="text-xs text-gray-500 mt-1">Uploaded</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{totalApproved}</p>
            <p className="text-xs text-gray-500 mt-1">Approved</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-400">{totalRequired - totalUploaded}</p>
            <p className="text-xs text-gray-500 mt-1">Remaining</p>
          </div>
          <div className="flex-1 flex flex-col justify-center min-w-[160px]">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Overall Progress</span>
              <span className="font-semibold text-brand-600">{overallPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-brand-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg mt-2">
            <AlertCircle size={16} className="shrink-0" />
            {uploadError}
            <button onClick={() => setUploadError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
      </div>

      {/* Document categories */}
      {CATEGORIES.map(cat => {
        const stats = getCategoryStats(cat.key, cat.docs)
        const isExpanded = expanded[cat.key]

        return (
          <div key={cat.key} className="card p-0 overflow-hidden">
            {/* Category header */}
            <button
              type="button"
              onClick={() => setExpanded(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-50 rounded-lg">
                  <FileText size={18} className="text-brand-600" />
                </div>
                <div className="text-left">
                  <h2 className="text-base font-semibold">{cat.label}</h2>
                  <p className="text-xs text-gray-400">{cat.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={clsx(
                  'text-xs font-medium px-2.5 py-1 rounded-full',
                  stats.uploaded === stats.total
                    ? 'bg-green-100 text-green-700'
                    : stats.uploaded > 0
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                )}>
                  {stats.uploaded}/{stats.total} uploaded
                </span>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {/* Document rows */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {cat.docs.map(docName => {
                  const existing = getDoc(cat.key, docName)
                  const status = existing?.status || 'pending'
                  const cfg = STATUS_CONFIG[status]
                  const Icon = cfg.icon
                  const isUploading = uploading === docName
                  const canUpload = ['pending', 'rejected', 'resubmit_requested'].includes(status)
                  const canReplace = status === 'uploaded' || status === 'under_review'

                  return (
                    <div key={docName} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={clsx('p-1.5 rounded-lg shrink-0', cfg.bg)}>
                          <Icon size={14} className={cfg.color} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{docName}</p>
                          {existing?.reviewer_notes && (
                            <p className="text-xs text-red-500 mt-0.5">{existing.reviewer_notes}</p>
                          )}
                          {existing?.file_size_kb && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {existing.file_size_kb < 1024
                                ? `${existing.file_size_kb} KB`
                                : `${(existing.file_size_kb / 1024).toFixed(1)} MB`}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        {/* Status badge */}
                        <span className={clsx('text-xs font-medium px-2 py-1 rounded-full hidden sm:inline-flex', cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>

                        {/* View button for uploaded docs */}
                        {existing?.file_url && (
                          <a
                            href={existing.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 px-2 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                          >
                            <Eye size={13} />
                            View
                          </a>
                        )}

                        {/* Upload / Replace button */}
                        {(canUpload || canReplace) && (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={e => handleUpload(e, cat.key, docName)}
                              disabled={isUploading}
                            />
                            <span className={clsx(
                              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
                              isUploading
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : canReplace
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-brand-600 text-white hover:bg-brand-700'
                            )}>
                              <Upload size={12} />
                              {isUploading ? 'Uploading...' : canReplace ? 'Replace' : 'Upload'}
                            </span>
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Help note */}
      <div className="card bg-blue-50 border border-blue-100">
        <div className="flex gap-3">
          <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Document Guidelines</p>
            <ul className="space-y-1 text-blue-600 text-xs">
              <li>• Accepted formats: PDF, JPG, PNG (max 5MB per file)</li>
              <li>• Ensure all documents are clear, legible and not expired</li>
              <li>• Passport must be valid for at least 6 months beyond your intended study start date</li>
              <li>• Bank statements must show the last 6 months of transactions</li>
              <li>• Your counselor will review and approve each document</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  )
}
