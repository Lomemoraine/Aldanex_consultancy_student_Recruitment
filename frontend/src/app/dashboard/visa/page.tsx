'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import {
  Plane, CheckCircle, Clock, XCircle, AlertCircle,
  Upload, ExternalLink, RefreshCw, FileText, Calendar,
  Shield, ChevronDown, ChevronUp, Info
} from 'lucide-react'
import clsx from 'clsx'

// ── Status config ─────────────────────────────────────────────
const VISA_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any; step: number }> = {
  not_started:          { label: 'Not Started',           color: 'text-gray-500',   bg: 'bg-gray-100',   icon: Clock,         step: 0 },
  documents_submitted:  { label: 'Documents Submitted',   color: 'text-blue-600',   bg: 'bg-blue-50',    icon: FileText,      step: 1 },
  biometrics_booked:    { label: 'Biometrics Booked',     color: 'text-purple-600', bg: 'bg-purple-50',  icon: Calendar,      step: 2 },
  submitted:            { label: 'Application Submitted', color: 'text-yellow-600', bg: 'bg-yellow-50',  icon: Clock,         step: 3 },
  approved:             { label: 'Visa Approved',         color: 'text-green-600',  bg: 'bg-green-50',   icon: CheckCircle,   step: 4 },
  rejected:             { label: 'Visa Rejected',         color: 'text-red-600',    bg: 'bg-red-50',     icon: XCircle,       step: 4 },
}

const VISA_STEPS = [
  { key: 'not_started',         label: 'Visa Process Started' },
  { key: 'documents_submitted', label: 'Documents Submitted' },
  { key: 'biometrics_booked',   label: 'Biometrics Booked' },
  { key: 'submitted',           label: 'Application Submitted' },
  { key: 'approved',            label: 'Decision Received' },
]

// Checklist items with labels
const CHECKLIST_LABELS: Record<string, string> = {
  passport:             'Valid Passport (6+ months validity)',
  photos:               'Passport Photographs (white background)',
  bank_statement:       'Bank Statement (last 6 months)',
  acceptance_letter:    'University Acceptance Letter',
  cas_i20:              'CAS / I-20 / CoE Document',
  accommodation_proof:  'Proof of Accommodation',
  travel_insurance:     'Travel Insurance',
  visa_form:            'Completed Visa Application Form',
}

export default function VisaPage() {
  const [visa, setVisa] = useState<any>(null)
  const [applicationId, setApplicationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState('')
  const [checklistOpen, setChecklistOpen] = useState(true)
  const [timelineOpen, setTimelineOpen] = useState(true)
  const [appStage, setAppStage] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const appRes = await api.get('/applications')
      const app = appRes.data?.[0]
      if (!app) return

      setApplicationId(app.id)
      setAppStage(app.current_stage)

      const visaRes = await api.get(`/visa/${app.id}`)
      setVisa(visaRes.data)
    } catch (err) {
      console.error('Failed to load visa data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDocUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    docType: string
  ) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !visa) return

    if (file.size > 5 * 1024 * 1024) return

    setUploading(docType)
    try {
      const { data: urlData } = await api.post('/documents/upload-url', {
        file_name: file.name,
        file_type: file.type,
        category: 'visa',
        application_id: applicationId,
      })

      await fetch(urlData.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      // Register document
      await api.post('/documents', {
        application_id: applicationId,
        category: 'visa',
        document_name: CHECKLIST_LABELS[docType] || docType,
        file_path: urlData.file_path,
        file_type: file.type,
        file_size_kb: Math.round(file.size / 1024),
      })

      // Update checklist
      const updatedChecklist = { ...(visa.checklist || {}), [docType]: true }
      await api.patch(`/visa/${visa.id}`, { checklist: updatedChecklist })

      // If all docs uploaded, update status
      const allDone = Object.values(updatedChecklist).every(Boolean)
      if (allDone && visa.status === 'not_started') {
        await api.patch(`/visa/${visa.id}`, { status: 'documents_submitted' })
      }

      await loadData()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading('')
    }
  }

  const currentStep = visa ? (VISA_STATUS_CONFIG[visa.status]?.step ?? 0) : -1
  const checklist = visa?.checklist || {}
  const checklistTotal = Object.keys(CHECKLIST_LABELS).length
  const checklistDone = Object.values(checklist).filter(Boolean).length
  const checklistPct = Math.round((checklistDone / checklistTotal) * 100)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading visa information...</p>
      </div>
    )
  }

  // Not yet at visa stage
  if (!visa) {
    const stagesBeforeVisa = [
      'registered', 'profile_completion', 'document_upload',
      'initial_assessment', 'counseling', 'university_selection',
      'application_submission', 'offer_letter', 'tuition_deposit',
    ]
    const isEarly = stagesBeforeVisa.includes(appStage)

    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Visa Application</h1>
          <p className="text-gray-500 mt-1">Track your visa application process</p>
        </div>

        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plane size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">
            {isEarly ? 'Visa stage not reached yet' : 'Visa application not started'}
          </h3>
          <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
            {isEarly
              ? 'Your visa application will be initiated by your visa officer once you have received and accepted a university offer and paid your tuition deposit.'
              : 'Your visa officer will start your visa application process. You will be notified when it begins.'}
          </p>

          {/* Progress indicator */}
          <div className="mt-8 max-w-sm mx-auto">
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Steps to reach visa stage</p>
            <div className="space-y-2 text-left">
              {[
                { label: 'Complete Profile',          done: !['registered'].includes(appStage) },
                { label: 'Upload Documents',          done: !['registered','profile_completion'].includes(appStage) },
                { label: 'Receive University Offer',  done: ['offer_letter','tuition_deposit','visa_application','pre_departure','enrolled'].includes(appStage) },
                { label: 'Pay Tuition Deposit',       done: ['tuition_deposit','visa_application','pre_departure','enrolled'].includes(appStage) },
                { label: 'Visa Application Begins',   done: ['visa_application','pre_departure','enrolled'].includes(appStage) },
              ].map(step => (
                <div key={step.label} className="flex items-center gap-2 text-sm">
                  {step.done
                    ? <CheckCircle size={16} className="text-green-500 shrink-0" />
                    : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                  }
                  <span className={step.done ? 'text-gray-700 font-medium' : 'text-gray-400'}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="card bg-blue-50 border border-blue-100">
          <div className="flex gap-3">
            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">About the Visa Process</p>
              <ul className="space-y-1 text-blue-600 text-xs">
                <li>• Your visa officer will guide you through the entire application process</li>
                <li>• Start gathering your documents early — passport, bank statements, photos</li>
                <li>• Visa processing times vary by country (typically 4–12 weeks)</li>
                <li>• Mock interview preparation will be provided before your visa interview</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const statusCfg = VISA_STATUS_CONFIG[visa.status] || VISA_STATUS_CONFIG.not_started
  const StatusIcon = statusCfg.icon

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visa Application</h1>
          <p className="text-gray-500 mt-1">
            {visa.visa_type} · {visa.destination_country}
          </p>
        </div>
        <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Status banner */}
      <div className={clsx('card border-l-4 flex items-center gap-4', {
        'border-gray-300':   visa.status === 'not_started',
        'border-blue-400':   visa.status === 'documents_submitted',
        'border-purple-400': visa.status === 'biometrics_booked',
        'border-yellow-400': visa.status === 'submitted',
        'border-green-400':  visa.status === 'approved',
        'border-red-400':    visa.status === 'rejected',
      })}>
        <div className={clsx('p-3 rounded-xl shrink-0', statusCfg.bg)}>
          <StatusIcon size={22} className={statusCfg.color} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{statusCfg.label}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {visa.status === 'not_started' && 'Your visa officer has started the process. Begin uploading your documents.'}
            {visa.status === 'documents_submitted' && 'All documents submitted. Your visa officer is reviewing them.'}
            {visa.status === 'biometrics_booked' && `Biometrics appointment booked${visa.biometrics_booked_at ? ` for ${new Date(visa.biometrics_booked_at).toLocaleDateString()}` : ''}.`}
            {visa.status === 'submitted' && `Application submitted${visa.visa_reference_number ? `. Reference: ${visa.visa_reference_number}` : ''}. Awaiting decision.`}
            {visa.status === 'approved' && 'Congratulations! Your visa has been approved.'}
            {visa.status === 'rejected' && 'Your visa application was unsuccessful. Please contact your visa officer.'}
          </p>
        </div>
        {visa.decision_date && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">Decision Date</p>
            <p className="text-sm font-medium">{new Date(visa.decision_date).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {/* Progress timeline */}
      <div className="card p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setTimelineOpen(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <h2 className="font-semibold">Application Timeline</h2>
          {timelineOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {timelineOpen && (
          <div className="px-5 pb-5 border-t border-gray-100">
            <div className="relative mt-4">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

              <div className="space-y-4">
                {VISA_STEPS.map((step, idx) => {
                  const isCompleted = idx < currentStep
                  const isCurrent = idx === currentStep
                  const isRejected = visa.status === 'rejected' && idx === currentStep

                  return (
                    <div key={step.key} className="flex items-center gap-4 relative pl-10">
                      <div className={clsx(
                        'absolute left-2.5 w-3 h-3 rounded-full border-2 transition-colors',
                        isRejected  ? 'bg-red-500 border-red-500' :
                        isCompleted ? 'bg-green-500 border-green-500' :
                        isCurrent   ? 'bg-brand-600 border-brand-600' :
                                      'bg-white border-gray-300'
                      )} />
                      <div className={clsx(
                        'flex-1 flex items-center justify-between p-3 rounded-lg',
                        isCurrent ? 'bg-brand-50 border border-brand-200' : 'bg-gray-50'
                      )}>
                        <span className={clsx(
                          'text-sm font-medium',
                          isRejected  ? 'text-red-600' :
                          isCompleted ? 'text-green-700' :
                          isCurrent   ? 'text-brand-700' :
                                        'text-gray-400'
                        )}>
                          {step.label}
                        </span>
                        {isCompleted && <CheckCircle size={14} className="text-green-500" />}
                        {isCurrent && !isRejected && <Clock size={14} className="text-brand-500" />}
                        {isRejected && <XCircle size={14} className="text-red-500" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Key dates */}
      {(visa.biometrics_booked_at || visa.submitted_at || visa.mock_interview_scheduled_at || visa.interview_date) && (
        <div className="card">
          <h2 className="font-semibold mb-4">Key Dates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visa.mock_interview_scheduled_at && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <Calendar size={18} className="text-purple-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Mock Interview</p>
                  <p className="text-sm font-semibold">{new Date(visa.mock_interview_scheduled_at).toLocaleString()}</p>
                </div>
              </div>
            )}
            {visa.biometrics_booked_at && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <Calendar size={18} className="text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Biometrics Appointment</p>
                  <p className="text-sm font-semibold">{new Date(visa.biometrics_booked_at).toLocaleString()}</p>
                  {visa.biometrics_appointment_url && (
                    <a href={visa.biometrics_appointment_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-0.5">
                      <ExternalLink size={10} /> View booking
                    </a>
                  )}
                </div>
              </div>
            )}
            {visa.interview_date && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <Calendar size={18} className="text-yellow-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Visa Interview</p>
                  <p className="text-sm font-semibold">{new Date(visa.interview_date).toLocaleString()}</p>
                </div>
              </div>
            )}
            {visa.submitted_at && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle size={18} className="text-green-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Application Submitted</p>
                  <p className="text-sm font-semibold">{new Date(visa.submitted_at).toLocaleDateString()}</p>
                  {visa.visa_reference_number && (
                    <p className="text-xs font-mono text-gray-500 mt-0.5">Ref: {visa.visa_reference_number}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mock interview notes */}
      {visa.mock_interview_notes && (
        <div className="card bg-purple-50 border border-purple-100">
          <div className="flex gap-3">
            <AlertCircle size={18} className="text-purple-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-purple-800 mb-1">Mock Interview Notes from Visa Officer</p>
              <p className="text-sm text-purple-700">{visa.mock_interview_notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Visa document */}
      {visa.visa_doc_url && visa.status === 'approved' && (
        <div className="card bg-green-50 border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={22} className="text-green-600" />
              <div>
                <p className="font-semibold text-green-800">Visa Document Available</p>
                <p className="text-sm text-green-600">Your visa has been approved and the document is ready.</p>
              </div>
            </div>
            <a
              href={visa.visa_doc_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <ExternalLink size={14} />
              View Visa
            </a>
          </div>
        </div>
      )}

      {/* Document checklist */}
      <div className="card p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setChecklistOpen(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Document Checklist</h2>
            <span className={clsx(
              'text-xs font-medium px-2.5 py-1 rounded-full',
              checklistDone === checklistTotal
                ? 'bg-green-100 text-green-700'
                : 'bg-brand-100 text-brand-700'
            )}>
              {checklistDone}/{checklistTotal} complete
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 bg-gray-200 rounded-full h-1.5 hidden sm:block">
              <div className="bg-brand-600 h-1.5 rounded-full transition-all" style={{ width: `${checklistPct}%` }} />
            </div>
            {checklistOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </div>
        </button>

        {checklistOpen && (
          <div className="border-t border-gray-100 divide-y divide-gray-50">
            {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
              const isDone = checklist[key] === true
              const isUploading = uploading === key
              const canUpload = !isDone && visa.status !== 'approved'

              return (
                <div key={key} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                      isDone ? 'bg-green-500' : 'border-2 border-gray-300'
                    )}>
                      {isDone && <CheckCircle size={12} className="text-white" />}
                    </div>
                    <span className={clsx(
                      'text-sm',
                      isDone ? 'text-gray-700 font-medium' : 'text-gray-500'
                    )}>
                      {label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isDone && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle size={12} /> Uploaded
                      </span>
                    )}
                    {canUpload && (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => handleDocUpload(e, key)}
                          disabled={isUploading}
                        />
                        <span className={clsx(
                          'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
                          isUploading
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-brand-600 text-white hover:bg-brand-700'
                        )}>
                          <Upload size={12} />
                          {isUploading ? 'Uploading...' : 'Upload'}
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

      {/* Tips */}
      <div className="card bg-blue-50 border border-blue-100">
        <div className="flex gap-3">
          <Shield size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Visa Application Tips</p>
            <ul className="space-y-1 text-blue-600 text-xs">
              <li>• Ensure your passport is valid for at least 6 months beyond your intended travel date</li>
              <li>• Bank statements must show sufficient funds to cover tuition and living expenses</li>
              <li>• Upload clear, high-resolution scans — blurry documents cause delays</li>
              <li>• Attend your mock interview session to prepare for the real visa interview</li>
              <li>• Do not book flights until your visa is approved</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  )
}
