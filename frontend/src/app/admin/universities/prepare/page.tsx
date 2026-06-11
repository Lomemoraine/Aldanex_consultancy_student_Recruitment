'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import {
  GraduationCap, User, FileText, CheckCircle, Clock,
  AlertCircle, Upload, Save, Send, ChevronDown, ChevronUp,
  RefreshCw, MessageSquare, X, ExternalLink, DollarSign
} from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  selected: { label: 'Selected', color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
  preparing: { label: 'Preparing', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock },
  ready_for_approval: { label: 'Ready for Approval', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
  changes_requested: { label: 'Changes Requested', color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
  approved: { label: 'Approved - Payment Pending', color: 'text-purple-600', bg: 'bg-purple-100', icon: CheckCircle },
  payment_pending: { label: 'Payment Pending', color: 'text-orange-600', bg: 'bg-orange-100', icon: DollarSign },
  payment_complete: { label: 'Ready to Submit', color: 'text-green-600', bg: 'bg-green-100', icon: Send },
  submitted: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-100', icon: CheckCircle },
  offer_received: { label: 'Offer Received', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-100', icon: X },
}

export default function ApplicationPreparationPage() {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState('')
  const [uploading, setUploading] = useState<Record<string, string>>({})
  const [uploadError, setUploadError] = useState('')

  const [preparationForms, setPreparationForms] = useState<Record<string, any>>({})

  const [submissionModal, setSubmissionModal] = useState<{ open: boolean; appId: string; appName: string } | null>(null)
  const [submissionForm, setSubmissionForm] = useState({ reference_number: '', status: 'submitted' })

  const [offerModal, setOfferModal] = useState<{ open: boolean; appId: string; appName: string; applicationId: string; studentId: string } | null>(null)
  const [offerForm, setOfferForm] = useState({
    outcome: 'unconditional',
    offer_letter_url: '',
    conditions: '',
    offer_deadline: ''
  })
  const [uploadingOffer, setUploadingOffer] = useState(false)

  useEffect(() => {
    loadApplications()
  }, [])

  async function loadApplications() {
    setLoading(true)
    try {
      const res = await api.get('/universities/selected/all')
      setApplications(res.data || [])
    } catch (err) {
      console.error('Failed to load applications:', err)
    } finally {
      setLoading(false)
    }
  }

  function updatePreparationForm(appId: string, field: string, value: any) {
    setPreparationForms(prev => ({
      ...prev,
      [appId]: { ...(prev[appId] || {}), [field]: value }
    }))
  }

  function updateChecklist(appId: string, item: string, checked: boolean) {
    setPreparationForms(prev => ({
      ...prev,
      [appId]: {
        ...(prev[appId] || {}),
        checklist: {
          ...(prev[appId]?.checklist || {}),
          [item]: checked
        }
      }
    }))
  }

  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    appId: string,
    fileType: 'sop' | 'form'
  ) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowed.includes(file.type)) {
      setUploadError('Only PDF, JPG, and PNG files are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File must be under 5MB.')
      return
    }

    setUploading(prev => ({ ...prev, [appId]: fileType }))
    setUploadError('')

    try {
      const { data: urlData } = await api.post('/documents/upload-url', {
        file_name: file.name,
        file_type: file.type,
        category: fileType === 'sop' ? 'sop' : 'application_form',
        application_id: appId,
      })

      const uploadRes = await fetch(urlData.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!uploadRes.ok) throw new Error('Storage upload failed')

      const publicUrl = urlData.public_url || urlData.upload_url.split('?')[0]
      const fieldName = fileType === 'sop' ? 'sop_url' : 'application_form_url'
      updatePreparationForm(appId, fieldName, publicUrl)

      await api.patch(`/universities/${appId}/prepare`, {
        [fieldName]: publicUrl,
        keep_status: true
      })

      await loadApplications()
    } catch (err: any) {
      setUploadError('Failed to upload file. Please try again.')
      console.error('Upload failed:', err)
    } finally {
      setUploading(prev => {
        const newState = { ...prev }
        delete newState[appId]
        return newState
      })
    }
  }

  async function handleStartPreparation(appId: string) {
    setSaving(`start-${appId}`)
    try {
      await api.patch(`/universities/${appId}/prepare`, {
        preparation_status: 'in_progress'
      })
      await loadApplications()
    } catch (err) {
      console.error('Failed to start preparation:', err)
      alert('Failed to start preparation')
    } finally {
      setSaving('')
    }
  }

  async function handleSaveProgress(appId: string) {
    setSaving(`save-${appId}`)
    try {
      const form = preparationForms[appId] || {}
      await api.patch(`/universities/${appId}/prepare`, {
        ...form,
        keep_status: true
      })
      await loadApplications()
      alert('Progress saved successfully')
    } catch (err) {
      console.error('Failed to save progress:', err)
      alert('Failed to save progress')
    } finally {
      setSaving('')
    }
  }

  async function handleMarkReady(appId: string) {
    const form = preparationForms[appId] || {}
    const checklist = form.checklist || {}
    const allChecked = Object.values(checklist).every(v => v === true)

    if (!allChecked) {
      alert('Please complete all checklist items before marking as ready')
      return
    }

    if (!form.sop_url || !form.application_form_url) {
      alert('Please upload SOP and Application Form before marking as ready')
      return
    }

    setSaving(`ready-${appId}`)
    try {
      await api.post(`/universities/${appId}/ready-for-approval`, {
        application_fee: form.application_fee || null
      })
      await loadApplications()
      alert('Application marked as ready for student approval!')
    } catch (err) {
      console.error('Failed to mark ready:', err)
      alert('Failed to mark ready')
    } finally {
      setSaving('')
    }
  }

  async function handleSubmitApplication() {
    if (!submissionModal) return

    if (!submissionForm.reference_number.trim()) {
      alert('Please enter a reference number')
      return
    }

    setSaving(`submit-${submissionModal.appId}`)
    try {
      await api.patch(`/universities/${submissionModal.appId}/submit`, {
        reference_number: submissionForm.reference_number,
        submitted_at: new Date().toISOString()
      })
      await loadApplications()
      setSubmissionModal(null)
      setSubmissionForm({ reference_number: '', status: 'submitted' })
      alert('Application submitted successfully!')
    } catch (err) {
      console.error('Failed to submit application:', err)
      alert('Failed to submit application')
    } finally {
      setSaving('')
    }
  }

  async function handleUpdateStatus(appId: string, newStatus: string) {
    if (!confirm(`Are you sure you want to mark this application as "${newStatus.replace('_', ' ')}"?`)) {
      return
    }

    setSaving(`status-${appId}`)
    try {
      await api.patch(`/universities/${appId}/status`, { status: newStatus })
      await loadApplications()
      alert('Status updated successfully!')
    } catch (err) {
      console.error('Failed to update status:', err)
      alert('Failed to update status')
    } finally {
      setSaving('')
    }
  }

  async function handleOfferLetterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowed.includes(file.type)) {
      alert('Only PDF, JPG, and PNG files are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5MB.')
      return
    }

    setUploadingOffer(true)
    try {
      const { data: urlData } = await api.post('/documents/upload-url', {
        file_name: file.name,
        file_type: file.type,
        category: 'offer_letter',
        application_id: offerModal?.applicationId,
      })

      const uploadRes = await fetch(urlData.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!uploadRes.ok) throw new Error('Storage upload failed')

      const publicUrl = urlData.public_url || urlData.upload_url.split('?')[0]
      setOfferForm(prev => ({ ...prev, offer_letter_url: publicUrl }))
    } catch (err: any) {
      alert('Failed to upload file. Please try again.')
      console.error('Upload failed:', err)
    } finally {
      setUploadingOffer(false)
    }
  }

  async function handleSubmitOffer() {
    if (!offerModal) return

    if (!offerForm.offer_letter_url.trim()) {
      alert('Please upload an offer letter')
      return
    }

    setSaving(`offer-${offerModal.appId}`)
    try {
      await api.post('/offers', {
        university_application_id: offerModal.appId,
        application_id: offerModal.applicationId,
        student_id: offerModal.studentId,
        outcome: offerForm.outcome,
        offer_letter_url: offerForm.offer_letter_url,
        conditions: offerForm.conditions || null,
        offer_deadline: offerForm.offer_deadline || null
      })
      await loadApplications()
      setOfferModal(null)
      setOfferForm({ outcome: 'unconditional', offer_letter_url: '', conditions: '', offer_deadline: '' })
      alert('Offer letter uploaded successfully!')
    } catch (err) {
      console.error('Failed to upload offer:', err)
      alert('Failed to upload offer letter')
    } finally {
      setSaving('')
    }
  }

  const selectedApps = applications.filter(a => a.status === 'selected')
  const preparingApps = applications.filter(a => a.status === 'preparing')
  const readyApps = applications.filter(a => a.status === 'ready_for_approval')
  const changesApps = applications.filter(a => a.status === 'changes_requested')
  const paymentPendingApps = applications.filter(a => a.status === 'payment_pending')
  const readyToSubmitApps = applications.filter(a => a.status === 'payment_complete')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Application Management</h1>
          <p className="text-gray-500 mt-1">Prepare, submit, and track university applications</p>
        </div>
        <button onClick={loadApplications} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
        <div className="card bg-blue-50">
          <p className="text-2xl font-bold text-blue-600">{selectedApps.length}</p>
          <p className="text-sm text-blue-600 mt-1">New</p>
        </div>
        <div className="card bg-yellow-50">
          <p className="text-2xl font-bold text-yellow-600">{preparingApps.length}</p>
          <p className="text-sm text-yellow-600 mt-1">Preparing</p>
        </div>
        <div className="card bg-green-50">
          <p className="text-2xl font-bold text-green-600">{readyApps.length}</p>
          <p className="text-sm text-green-600 mt-1">Ready</p>
        </div>
        <div className="card bg-red-50">
          <p className="text-2xl font-bold text-red-600">{changesApps.length}</p>
          <p className="text-sm text-red-600 mt-1">Changes</p>
        </div>
        <div className="card bg-orange-50">
          <p className="text-2xl font-bold text-orange-600">{paymentPendingApps.length}</p>
          <p className="text-sm text-orange-600 mt-1">Payment</p>
        </div>
        <div className="card bg-purple-50">
          <p className="text-2xl font-bold text-purple-600">{readyToSubmitApps.length}</p>
          <p className="text-sm text-purple-600 mt-1">To Submit</p>
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : applications.length === 0 ? (
        <div className="card text-center py-12">
          <GraduationCap size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No applications to prepare</p>
          <p className="text-sm text-gray-400 mt-2">
            Applications will appear here when students select universities
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map(app => {
            const isOpen = expanded[app.id]
            const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.selected
            const Icon = cfg.icon
            const student = app.application?.student
            const form = preparationForms[app.id] || {
              sop_url: app.sop_url || '',
              application_form_url: app.application_form_url || '',
              application_fee: app.application_fee || '',
              checklist: app.checklist || {
                sop_prepared: false,
                application_form_completed: false,
                academic_documents_compiled: false,
                financial_documents_compiled: false,
                english_proficiency_compiled: false,
                reference_letters_obtained: false,
                all_documents_verified: false
              }
            }

            return (
              <div key={app.id} className="card p-0 overflow-hidden">
                {/* Application Header */}
                <button
                  type="button"
                  onClick={() => setExpanded(prev => ({ ...prev, [app.id]: !prev[app.id] }))}
                  className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <GraduationCap size={18} className="text-brand-600" />
                      <p className="font-semibold">{app.university_name}</p>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-sm text-gray-500">{app.university_country}</span>
                      <span className={clsx('badge text-xs flex items-center gap-1.5', cfg.bg, cfg.color)}>
                        <Icon size={12} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <User size={14} />
                      <span>{student?.full_name || 'Unknown'}</span>
                      <span className="text-xs text-gray-400">({student?.student_id})</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs">{app.course_name}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs">{app.intake}</span>
                    </div>
                    {app.selected_by_student_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Selected: {new Date(app.selected_by_student_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {app.status === 'payment_complete' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSubmissionModal({ open: true, appId: app.id, appName: app.university_name })
                        }}
                        className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
                      >
                        <Send size={12} />
                        Submit Now
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-5 space-y-6 bg-gray-50/50">

                    {/* Changes Requested Alert */}
                    {app.status === 'changes_requested' && app.student_comments && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                          <MessageSquare size={16} />
                          Student Requested Changes
                        </div>
                        <p className="text-sm text-red-700 whitespace-pre-wrap">{app.student_comments}</p>
                      </div>
                    )}

                    {/* Not Started State */}
                    {app.status === 'selected' && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                        <FileText size={32} className="text-gray-300 mx-auto mb-3" />
                        <h3 className="font-semibold text-gray-700 mb-2">Ready to Start</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          Begin preparing this application for {student?.full_name}
                        </p>
                        <button
                          onClick={() => handleStartPreparation(app.id)}
                          disabled={saving === `start-${app.id}`}
                          className="btn-primary flex items-center gap-2 mx-auto"
                        >
                          <Send size={16} />
                          {saving === `start-${app.id}` ? 'Starting...' : 'Start Preparation'}
                        </button>
                      </div>
                    )}

                    {/* Preparation Form */}
                    {(app.status === 'preparing' || app.status === 'changes_requested' || app.status === 'ready_for_approval') && (
                      <>
                        {/* Document Upload Section */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Upload size={15} className="text-brand-600" />
                            Application Materials
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-4">
                            {/* SOP Upload */}
                            <div>
                              <label className="label text-xs">Statement of Purpose (SOP) *</label>
                              <div className="flex items-center gap-3">
                                {form.sop_url ? (
                                  <div className="flex-1 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <FileText size={16} className="text-green-600" />
                                    <span className="text-sm text-green-700 flex-1 truncate">
                                      {form.sop_url.split('/').pop() || 'SOP uploaded'}
                                    </span>
                                    <a href={form.sop_url} target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                                      <ExternalLink size={12} /> View
                                    </a>
                                  </div>
                                ) : (
                                  <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                                    No file uploaded yet
                                  </div>
                                )}
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => handleFileUpload(e, app.id, 'sop')}
                                    disabled={uploading[app.id] === 'sop' || app.status === 'ready_for_approval'}
                                  />
                                  <span className={clsx(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                    uploading[app.id] === 'sop'
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : form.sop_url
                                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      : 'bg-brand-600 text-white hover:bg-brand-700'
                                  )}>
                                    <Upload size={14} />
                                    {uploading[app.id] === 'sop' ? 'Uploading...' : form.sop_url ? 'Replace' : 'Upload'}
                                  </span>
                                </label>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Upload PDF, JPG, or PNG (max 5MB)</p>
                            </div>

                            {/* Application Form Upload */}
                            <div>
                              <label className="label text-xs">Application Form *</label>
                              <div className="flex items-center gap-3">
                                {form.application_form_url ? (
                                  <div className="flex-1 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <FileText size={16} className="text-green-600" />
                                    <span className="text-sm text-green-700 flex-1 truncate">
                                      {form.application_form_url.split('/').pop() || 'Form uploaded'}
                                    </span>
                                    <a href={form.application_form_url} target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                                      <ExternalLink size={12} /> View
                                    </a>
                                  </div>
                                ) : (
                                  <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                                    No file uploaded yet
                                  </div>
                                )}
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => handleFileUpload(e, app.id, 'form')}
                                    disabled={uploading[app.id] === 'form' || app.status === 'ready_for_approval'}
                                  />
                                  <span className={clsx(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                    uploading[app.id] === 'form'
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : form.application_form_url
                                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      : 'bg-brand-600 text-white hover:bg-brand-700'
                                  )}>
                                    <Upload size={14} />
                                    {uploading[app.id] === 'form' ? 'Uploading...' : form.application_form_url ? 'Replace' : 'Upload'}
                                  </span>
                                </label>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Upload PDF, JPG, or PNG (max 5MB)</p>
                            </div>

                            {/* Application Fee */}
                            <div>
                              <label className="label text-xs">Application Fee (USD)</label>
                              <input
                                type="number"
                                className="input text-sm"
                                placeholder="50"
                                min="0"
                                value={form.application_fee}
                                onChange={e => updatePreparationForm(app.id, 'application_fee', e.target.value)}
                                disabled={app.status === 'ready_for_approval'}
                              />
                            </div>

                            {uploadError && (
                              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <AlertCircle size={14} className="text-red-600 shrink-0" />
                                <p className="text-xs text-red-600">{uploadError}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Readiness Checklist */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <CheckCircle size={15} className="text-brand-600" />
                            Application Readiness Checklist
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-2">
                            {[
                              { key: 'sop_prepared', label: 'Statement of Purpose prepared' },
                              { key: 'application_form_completed', label: 'Application form completed' },
                              { key: 'academic_documents_compiled', label: 'Academic documents compiled' },
                              { key: 'financial_documents_compiled', label: 'Financial documents compiled' },
                              { key: 'english_proficiency_compiled', label: 'English proficiency documents compiled' },
                              { key: 'reference_letters_obtained', label: 'Reference letters obtained' },
                              { key: 'all_documents_verified', label: 'All documents verified' },
                            ].map(item => (
                              <label key={item.key} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.checklist?.[item.key] || false}
                                  onChange={e => updateChecklist(app.id, item.key, e.target.checked)}
                                  disabled={app.status === 'ready_for_approval'}
                                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                />
                                <span className="text-sm text-gray-700">{item.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        {app.status !== 'ready_for_approval' && (
                          <div className="pt-3 border-t border-gray-200 flex gap-3">
                            <button
                              onClick={() => handleSaveProgress(app.id)}
                              disabled={saving === `save-${app.id}`}
                              className="btn-secondary flex items-center gap-2"
                            >
                              <Save size={16} />
                              {saving === `save-${app.id}` ? 'Saving...' : 'Save Progress'}
                            </button>
                            <button
                              onClick={() => handleMarkReady(app.id)}
                              disabled={saving === `ready-${app.id}`}
                              className="btn-primary flex items-center gap-2"
                            >
                              <CheckCircle size={16} />
                              {saving === `ready-${app.id}` ? 'Marking Ready...' : 'Mark Ready for Approval'}
                            </button>
                          </div>
                        )}

                        {app.status === 'ready_for_approval' && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                              <CheckCircle size={18} />
                              Ready for Student Approval
                            </div>
                            <p className="text-sm text-green-700 mb-3">
                              This application has been sent to the student for review and approval.
                            </p>
                            <div className="bg-white border border-green-200 rounded-lg p-3">
                              <p className="text-xs text-green-800 font-medium mb-2">Next Steps:</p>
                              <ol className="text-xs text-green-700 space-y-1 ml-4 list-decimal">
                                <li>Student reviews the application materials</li>
                                <li>Student approves with e-signature</li>
                                {app.application_fee && app.application_fee > 0 && (
                                  <li>Student pays application fee (${app.application_fee})</li>
                                )}
                                <li><strong>Then you can submit to university</strong></li>
                              </ol>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Approved State */}
                    {app.status === 'approved' && (
                      <div className="space-y-4">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-purple-800 font-semibold mb-2">
                            <CheckCircle size={18} />
                            Student Approved - Ready to Submit
                          </div>
                          <p className="text-sm text-purple-700 mb-3">
                            {app.student_approved_at && `Approved on ${new Date(app.student_approved_at).toLocaleDateString()}`}
                            {app.student_signature && ` by ${app.student_signature}`}
                          </p>
                          <p className="text-sm text-purple-600 bg-white border border-purple-200 rounded-lg p-3">
                            Application approved by student and ready for submission to university.
                            Click "Submit to University" below to proceed.
                          </p>
                          <button
                            onClick={() => setSubmissionModal({ open: true, appId: app.id, appName: app.university_name })}
                            className="btn-primary flex items-center gap-2 mt-4"
                          >
                            <Send size={16} />
                            Submit to University
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Payment Pending State */}
                    {app.status === 'payment_pending' && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-orange-800 font-semibold mb-2">
                          <DollarSign size={18} />
                          Awaiting Student Payment
                        </div>
                        <p className="text-sm text-orange-700">
                          The student has approved the application and needs to pay the application fee
                          {app.application_fee ? ` ($${app.application_fee})` : ''} before it can be submitted.
                        </p>
                      </div>
                    )}

                    {/* Payment Complete - Ready to Submit */}
                    {app.status === 'payment_complete' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                          <CheckCircle size={18} />
                          Payment Complete - Ready to Submit
                        </div>
                        <p className="text-sm text-green-700 mb-4">
                          The student has paid the application fee. You can now submit to the university.
                        </p>
                        <button
                          onClick={() => setSubmissionModal({ open: true, appId: app.id, appName: app.university_name })}
                          className="btn-primary flex items-center gap-2"
                        >
                          <Send size={16} />
                          Submit to University
                        </button>
                      </div>
                    )}

                    {/* Submitted State */}
                    {app.status === 'submitted' && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-blue-800 font-semibold mb-2">
                            <Send size={18} />
                            Application Submitted
                          </div>
                          <p className="text-sm text-blue-700">
                            Submitted on {app.submitted_at && new Date(app.submitted_at).toLocaleDateString()}
                            {app.reference_number && ` • Reference: ${app.reference_number}`}
                          </p>
                        </div>

                        {/* Existing offer letters on submitted status */}
                        {app.offer_letters && app.offer_letters.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-700">Offer Letters</h4>
                            {app.offer_letters.map((offer: any) => (
                              <div key={offer.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className={clsx(
                                    'text-sm font-semibold',
                                    offer.outcome === 'unconditional' ? 'text-green-600' :
                                    offer.outcome === 'conditional' ? 'text-yellow-600' :
                                    offer.outcome === 'rejected' ? 'text-red-600' : 'text-blue-600'
                                  )}>
                                    {offer.outcome === 'unconditional' ? '✓ Unconditional Offer' :
                                     offer.outcome === 'conditional' ? '⚠ Conditional Offer' :
                                     offer.outcome === 'rejected' ? '✗ Rejected' : 'Waitlisted'}
                                  </span>
                                  {offer.offer_status && (
                                    <span className={clsx(
                                      'text-xs px-2 py-1 rounded-full',
                                      offer.offer_status === 'accepted' ? 'bg-green-100 text-green-700' :
                                      offer.offer_status === 'declined' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-700'
                                    )}>
                                      {offer.offer_status === 'accepted' ? 'Accepted by Student' :
                                       offer.offer_status === 'declined' ? 'Declined by Student' :
                                       'Pending Student Response'}
                                    </span>
                                  )}
                                </div>
                                {offer.conditions && (
                                  <p className="text-xs text-gray-600 mb-2">Conditions: {offer.conditions}</p>
                                )}
                                {offer.offer_deadline && (
                                  <p className="text-xs text-gray-600 mb-2">
                                    Deadline: {new Date(offer.offer_deadline).toLocaleDateString()}
                                  </p>
                                )}
                                {offer.offer_letter_url && (
                                  <a href={offer.offer_letter_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                                    <ExternalLink size={12} /> View Offer Letter
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-3 flex-wrap">
                          <button
                            onClick={() => setOfferModal({
                              open: true,
                              appId: app.id,
                              appName: app.university_name,
                              applicationId: app.application_id,
                              studentId: app.student_id
                            })}
                            disabled={saving.startsWith('offer-')}
                            className="btn-primary flex items-center gap-2"
                          >
                            <Upload size={16} />
                            Upload Offer Letter
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app.id, 'rejected')}
                            disabled={saving === `status-${app.id}`}
                            className="btn-secondary flex items-center gap-2 text-red-600 hover:bg-red-50"
                          >
                            <X size={16} />
                            Mark as Rejected
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Offer Received State — now always shows content since offer_letters is joined */}
                    {app.status === 'offer_received' && (
                      <div className="space-y-4">
                        {/* Status header — always visible */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-green-800 font-semibold mb-1">
                            <CheckCircle size={18} />
                            Offer Received
                          </div>
                          <p className="text-sm text-green-700">
                            This application has received a response from the university.
                          </p>
                        </div>

                        {/* Offer letters — populated via offer_letters(*) join */}
                        {app.offer_letters && app.offer_letters.length > 0 ? (
                          <div className="space-y-3">
                            {app.offer_letters.map((offer: any) => (
                              <div key={offer.id} className={clsx(
                                'rounded-lg p-4 border-2',
                                offer.offer_status === 'accepted' ? 'bg-green-50 border-green-300' :
                                offer.offer_status === 'declined' ? 'bg-gray-50 border-gray-300' :
                                'bg-blue-50 border-blue-300'
                              )}>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className={clsx(
                                        'text-sm font-semibold',
                                        offer.outcome === 'unconditional' ? 'text-green-700' :
                                        offer.outcome === 'conditional' ? 'text-yellow-700' :
                                        'text-blue-700'
                                      )}>
                                        {offer.outcome === 'unconditional' ? '✓ Unconditional Offer' :
                                         offer.outcome === 'conditional' ? '⚠ Conditional Offer' :
                                         'Waitlisted'}
                                      </span>
                                    </div>
                                    {offer.conditions && (
                                      <p className="text-xs text-gray-600 mb-1">
                                        <strong>Conditions:</strong> {offer.conditions}
                                      </p>
                                    )}
                                    {offer.offer_deadline && (
                                      <p className="text-xs text-gray-600">
                                        <strong>Deadline:</strong> {new Date(offer.offer_deadline).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                  <span className={clsx(
                                    'text-xs px-3 py-1.5 rounded-full font-semibold shrink-0',
                                    offer.offer_status === 'accepted' ? 'bg-green-600 text-white' :
                                    offer.offer_status === 'declined' ? 'bg-gray-400 text-white' :
                                    'bg-blue-100 text-blue-700'
                                  )}>
                                    {offer.offer_status === 'accepted' ? '✓ Accepted' :
                                     offer.offer_status === 'declined' ? 'Declined' :
                                     'Pending Decision'}
                                  </span>
                                </div>

                                {/* Next steps when student accepted */}
                                {offer.offer_status === 'accepted' && (
                                  <div className="mt-4 pt-4 border-t border-green-200">
                                    <p className="text-sm font-semibold text-green-800 mb-3">
                                      Next Steps (Sequential):
                                    </p>
                                    <div className="space-y-3">
                                      <div className="bg-white rounded-lg p-4 border-2 border-green-400 shadow-sm">
                                        <div className="flex items-start gap-3">
                                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white font-bold text-sm shrink-0">
                                            1
                                          </div>
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                              <DollarSign size={16} className="text-green-600" />
                                              <p className="text-sm font-bold text-gray-900">Tuition Deposit Payment (Required First)</p>
                                            </div>
                                            <p className="text-xs text-gray-700 mb-3 leading-relaxed">
                                              Student must pay tuition deposit to secure their place. Visa application can only begin after payment is verified.
                                            </p>
                                            <a href="/admin/payments"
                                              className="inline-flex items-center gap-1.5 text-xs bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium transition-colors">
                                              <DollarSign size={14} />
                                              Manage Tuition Payments →
                                            </a>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                                        <div className="flex items-start gap-3">
                                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-white font-bold text-sm shrink-0">
                                            2
                                          </div>
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                              <FileText size={16} className="text-gray-500" />
                                              <p className="text-sm font-semibold text-gray-600">Visa Application (After Payment)</p>
                                            </div>
                                            <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                                              Once tuition deposit is verified, you can begin the visa application process.
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded">
                                              <Clock size={12} />
                                              <span>Available after payment verification</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                      <p className="text-xs text-blue-700 leading-relaxed">
                                        Remind the student to pay the tuition deposit immediately to avoid losing their place.
                                        Visa processing can only start after payment confirmation.
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {offer.offer_letter_url && (
                                  <div className="mt-3">
                                    <a href={offer.offer_letter_url} target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                                      <ExternalLink size={12} /> View Offer Letter
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* Fallback when no offer letters uploaded yet */
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-yellow-800 font-semibold mb-1">
                              <AlertCircle size={16} />
                              No Offer Letter Uploaded Yet
                            </div>
                            <p className="text-sm text-yellow-700">
                              Upload the offer letter received from the university below.
                            </p>
                          </div>
                        )}

                        {/* Action buttons — always visible for offer_received */}
                        <div className="flex gap-3 flex-wrap pt-2">
                          <button
                            onClick={() => setOfferModal({
                              open: true,
                              appId: app.id,
                              appName: app.university_name,
                              applicationId: app.application_id,
                              studentId: app.student_id
                            })}
                            disabled={saving.startsWith('offer-')}
                            className="btn-primary flex items-center gap-2"
                          >
                            <Upload size={16} />
                            Upload Offer Letter
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app.id, 'rejected')}
                            disabled={saving === `status-${app.id}`}
                            className="btn-secondary flex items-center gap-2 text-red-600 hover:bg-red-50"
                          >
                            <X size={16} />
                            Mark as Rejected
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Rejected State */}
                    {app.status === 'rejected' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                          <X size={18} />
                          Application Rejected
                        </div>
                        <p className="text-sm text-red-700">
                          Unfortunately, this application was not successful.
                        </p>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Submission Modal */}
      {submissionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Submit Application</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to submit the application to <strong>{submissionModal.appName}</strong>.
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">University Reference Number *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., APP-2024-12345"
                  value={submissionForm.reference_number}
                  onChange={e => setSubmissionForm(prev => ({ ...prev, reference_number: e.target.value }))}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the reference number provided by the university portal
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setSubmissionModal(null)
                  setSubmissionForm({ reference_number: '', status: 'submitted' })
                }}
                className="btn-secondary flex-1"
                disabled={saving.startsWith('submit-')}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitApplication}
                disabled={saving.startsWith('submit-')}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {saving.startsWith('submit-') ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Letter Upload Modal */}
      {offerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Upload Offer Letter</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload the offer letter for <strong>{offerModal.appName}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Offer Letter Document *</label>
                <div className="flex items-center gap-3">
                  {offerForm.offer_letter_url ? (
                    <div className="flex-1 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <FileText size={16} className="text-green-600" />
                      <span className="text-sm text-green-700 flex-1 truncate">
                        {offerForm.offer_letter_url.split('/').pop() || 'Offer letter uploaded'}
                      </span>
                      <a href={offerForm.offer_letter_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                        <ExternalLink size={12} /> View
                      </a>
                    </div>
                  ) : (
                    <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                      No file uploaded yet
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleOfferLetterUpload}
                      disabled={uploadingOffer}
                    />
                    <span className={clsx(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      uploadingOffer
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : offerForm.offer_letter_url
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    )}>
                      <Upload size={14} />
                      {uploadingOffer ? 'Uploading...' : offerForm.offer_letter_url ? 'Replace' : 'Upload'}
                    </span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Upload PDF, JPG, or PNG (max 5MB)</p>
              </div>

              <div>
                <label className="label">Offer Outcome *</label>
                <select
                  className="input"
                  value={offerForm.outcome}
                  onChange={e => setOfferForm(prev => ({ ...prev, outcome: e.target.value }))}
                >
                  <option value="unconditional">Unconditional Offer</option>
                  <option value="conditional">Conditional Offer</option>
                  <option value="waitlisted">Waitlisted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {offerForm.outcome === 'conditional' && (
                <div>
                  <label className="label">Conditions</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="e.g., IELTS 6.5 overall, GPA 3.0 minimum"
                    value={offerForm.conditions}
                    onChange={e => setOfferForm(prev => ({ ...prev, conditions: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label className="label">Response Deadline (Optional)</label>
                <input
                  type="date"
                  className="input"
                  value={offerForm.offer_deadline}
                  onChange={e => setOfferForm(prev => ({ ...prev, offer_deadline: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setOfferModal(null)
                  setOfferForm({ outcome: 'unconditional', offer_letter_url: '', conditions: '', offer_deadline: '' })
                }}
                className="btn-secondary flex-1"
                disabled={saving.startsWith('offer-')}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitOffer}
                disabled={saving.startsWith('offer-') || !offerForm.offer_letter_url}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                {saving.startsWith('offer-') ? 'Uploading...' : 'Upload Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Complete Workflow</p>
            <ol className="space-y-1 text-xs text-blue-600">
              <li><strong>1. Prepare:</strong> Upload SOP and application form, complete checklist</li>
              <li><strong>2. Mark Ready:</strong> Send to student for approval</li>
              <li><strong>3. Student Approves:</strong> Student reviews and approves with e-signature</li>
              <li><strong>4. Student Pays:</strong> Student pays application fee (if required)</li>
              <li><strong>5. You Submit:</strong> Submit to university portal with reference number</li>
              <li><strong>6. Update Status:</strong> Mark as "Offer Received" or "Rejected" when university responds</li>
            </ol>
            <div className="mt-3 p-2 bg-blue-100 rounded border border-blue-300">
              <p className="text-xs text-blue-800">
                <strong>Tip:</strong> The "Submit to University" button appears only after the student approves and pays (if fee required).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
   