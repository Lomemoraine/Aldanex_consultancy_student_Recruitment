'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { 
  Plane, CheckCircle, Clock, AlertCircle, FileText, 
  Calendar, Upload, ExternalLink, RefreshCw 
} from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  not_started:    { label: 'Not Started',      color: 'text-gray-600',   bg: 'bg-gray-100',    icon: Clock },
  in_progress:    { label: 'In Progress',      color: 'text-blue-600',   bg: 'bg-blue-100',    icon: Clock },
  documents_ready:{ label: 'Documents Ready',  color: 'text-purple-600', bg: 'bg-purple-100',  icon: FileText },
  submitted:      { label: 'Submitted',        color: 'text-orange-600', bg: 'bg-orange-100',  icon: Clock },
  interview:      { label: 'Interview Stage',  color: 'text-yellow-600', bg: 'bg-yellow-100',  icon: Calendar },
  approved:       { label: 'Approved',         color: 'text-green-600',  bg: 'bg-green-100',   icon: CheckCircle },
  rejected:       { label: 'Rejected',         color: 'text-red-600',    bg: 'bg-red-100',     icon: AlertCircle },
}

const CHECKLIST_ITEMS = [
  { key: 'passport', label: 'Valid Passport' },
  { key: 'photos', label: 'Passport Photos' },
  { key: 'bank_statement', label: 'Bank Statement' },
  { key: 'acceptance_letter', label: 'University Acceptance Letter' },
  { key: 'cas_i20', label: 'CAS / I-20 Document' },
  { key: 'accommodation_proof', label: 'Accommodation Proof' },
  { key: 'travel_insurance', label: 'Travel Insurance' },
  { key: 'visa_form', label: 'Completed Visa Application Form' },
]

export default function StudentVisaPage() {
  const [visa, setVisa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [applicationId, setApplicationId] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const appRes = await api.get('/applications')
      const app = appRes.data?.[0]
      if (!app) return

      setApplicationId(app.id)

      const visaRes = await api.get(`/visa/${app.id}`)
      setVisa(visaRes.data)
    } catch (err) {
      console.error('Failed to load visa:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading visa information...</p>
      </div>
    )
  }

  if (!visa) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Visa Application</h1>
          <p className="text-gray-500 mt-1">Track your visa application progress</p>
        </div>

        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plane size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">Visa Process Not Started</h3>
          <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
            Your visa application process will begin after you've accepted a university offer and paid your tuition deposit.
            Your counselor will guide you through the visa process.
          </p>
        </div>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[visa.status] || STATUS_CONFIG.not_started
  const Icon = cfg.icon
  const checklist = visa.checklist || {}
  const completedItems = Object.values(checklist).filter(Boolean).length
  const totalItems = CHECKLIST_ITEMS.length
  const progress = (completedItems / totalItems) * 100

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visa Application</h1>
          <p className="text-gray-500 mt-1">{visa.visa_type || 'Student Visa'} - {visa.destination_country}</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Status Card */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className={clsx('p-3 rounded-xl', cfg.bg)}>
              <Icon size={24} className={cfg.color} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Status</p>
              <p className="text-2xl font-bold text-gray-900">{cfg.label}</p>
            </div>
          </div>
          {visa.visa_reference_number && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Reference Number</p>
              <p className="font-mono text-sm font-semibold text-brand-600">{visa.visa_reference_number}</p>
            </div>
          )}
        </div>

        {visa.status === 'approved' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-semibold flex items-center gap-2">
              <CheckCircle size={18} />
              Congratulations! Your visa has been approved!
            </p>
            {visa.decision_date && (
              <p className="text-green-600 text-sm mt-1">
                Decision Date: {new Date(visa.decision_date).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {visa.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-semibold flex items-center gap-2">
              <AlertCircle size={18} />
              Visa application was not successful
            </p>
            <p className="text-red-600 text-sm mt-1">
              Please contact your counselor to discuss next steps and reapplication options.
            </p>
          </div>
        )}
      </div>

      {/* Document Checklist */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText size={18} className="text-brand-600" />
            Document Checklist
          </h2>
          <span className="text-sm text-gray-500">{completedItems} of {totalItems} complete</span>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-brand-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          {CHECKLIST_ITEMS.map(item => {
            const isComplete = checklist[item.key]
            return (
              <div 
                key={item.key}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  isComplete 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                )}
              >
                <div className={clsx(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                  isComplete ? 'bg-green-500' : 'bg-gray-300'
                )}>
                  {isComplete && <CheckCircle size={14} className="text-white" />}
                </div>
                <span className={clsx(
                  'text-sm font-medium',
                  isComplete ? 'text-green-800' : 'text-gray-600'
                )}>
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
          <strong>Note:</strong> Your counselor will update this checklist as you submit documents. 
          Make sure to upload all required documents to the Documents section.
        </div>
      </div>

      {/* Important Dates */}
      {(visa.biometrics_booked_at || visa.interview_date) && (
        <div className="card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-brand-600" />
            Important Dates
          </h2>

          <div className="space-y-3">
            {visa.biometrics_booked_at && (
              <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <Calendar size={16} className="text-purple-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-purple-900">Biometrics Appointment</p>
                  <p className="text-sm text-purple-700">
                    {new Date(visa.biometrics_booked_at).toLocaleString()}
                  </p>
                  {visa.biometrics_appointment_url && (
                    <a 
                      href={visa.biometrics_appointment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      <ExternalLink size={12} />
                      View Appointment Details
                    </a>
                  )}
                </div>
              </div>
            )}

            {visa.interview_date && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Calendar size={16} className="text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-900">Visa Interview</p>
                  <p className="text-sm text-yellow-700">
                    {new Date(visa.interview_date).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {visa.mock_interview_scheduled_at && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Calendar size={16} className="text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Mock Interview (Practice)</p>
                  <p className="text-sm text-blue-700">
                    {new Date(visa.mock_interview_scheduled_at).toLocaleString()}
                  </p>
                  {visa.mock_interview_notes && (
                    <p className="text-xs text-blue-600 mt-1">{visa.mock_interview_notes}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Clock size={18} className="text-brand-600" />
          Application Timeline
        </h2>

        <div className="space-y-4">
          {visa.submitted_at && (
            <div className="flex gap-3">
              <div className="w-2 h-2 bg-brand-600 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-900">Application Submitted</p>
                <p className="text-xs text-gray-500">{new Date(visa.submitted_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}

          {visa.biometrics_booked_at && (
            <div className="flex gap-3">
              <div className="w-2 h-2 bg-purple-600 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-900">Biometrics Scheduled</p>
                <p className="text-xs text-gray-500">{new Date(visa.biometrics_booked_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}

          {visa.interview_date && (
            <div className="flex gap-3">
              <div className="w-2 h-2 bg-yellow-600 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-900">Interview Scheduled</p>
                <p className="text-xs text-gray-500">{new Date(visa.interview_date).toLocaleDateString()}</p>
              </div>
            </div>
          )}

          {visa.decision_date && (
            <div className="flex gap-3">
              <div className={clsx(
                'w-2 h-2 rounded-full mt-2',
                visa.decision === 'approved' ? 'bg-green-600' : 'bg-red-600'
              )} />
              <div>
                <p className="text-sm font-medium text-gray-900">Decision Received</p>
                <p className="text-xs text-gray-500">{new Date(visa.decision_date).toLocaleDateString()}</p>
                <p className={clsx(
                  'text-sm font-semibold mt-1',
                  visa.decision === 'approved' ? 'text-green-600' : 'text-red-600'
                )}>
                  {visa.decision?.toUpperCase()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="card bg-gray-50 border border-gray-200">
        <h2 className="font-semibold mb-3">Need Help?</h2>
        <p className="text-sm text-gray-600 mb-3">
          Your counselor is here to guide you through the visa process. Contact them if you have any questions or concerns.
        </p>
        <button className="btn-secondary text-sm">
          Message Counselor
        </button>
      </div>

    </div>
  )
}
