'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import {
  GraduationCap, Plus, X, CheckCircle, Clock, Send,
  AlertCircle, ExternalLink, ChevronDown, ChevronUp, RefreshCw, DollarSign
} from 'lucide-react'
import clsx from 'clsx'

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  selected:           { label: 'Preparing',                      color: 'text-gray-600',   bg: 'bg-gray-100',    icon: Clock },
  preparing:          { label: 'Preparing',                      color: 'text-gray-600',   bg: 'bg-gray-100',    icon: Clock },
  ready_for_approval: { label: 'Ready for Your Review',          color: 'text-green-600',  bg: 'bg-green-100',   icon: CheckCircle },
  changes_requested:  { label: 'Preparing',                      color: 'text-gray-600',   bg: 'bg-gray-100',    icon: Clock },
  approved:           { label: 'Approved - Payment Pending',     color: 'text-purple-600', bg: 'bg-purple-100',  icon: CheckCircle },
  payment_pending:    { label: 'Payment Pending',                color: 'text-orange-600', bg: 'bg-orange-100',  icon: DollarSign },
  payment_complete:   { label: 'Preparing for Submission',       color: 'text-blue-600',   bg: 'bg-blue-100',    icon: Clock },
  submitted:          { label: 'Awaiting University Feedback',   color: 'text-blue-600',   bg: 'bg-blue-100',    icon: Send },
  offer_received:     { label: 'Offer Received',                 color: 'text-green-600',  bg: 'bg-green-100',   icon: CheckCircle },
  rejected:           { label: 'Unsuccessful',                   color: 'text-red-600',    bg: 'bg-red-100',     icon: X },
  withdrawn:          { label: 'Withdrawn',                      color: 'text-gray-400',   bg: 'bg-gray-100',    icon: X },
}

const OFFER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  unconditional: { label: 'Unconditional Offer', color: 'text-green-700',  bg: 'bg-green-100' },
  conditional:   { label: 'Conditional Offer',   color: 'text-yellow-700', bg: 'bg-yellow-100' },
  waitlisted:    { label: 'Waitlisted',           color: 'text-blue-700',   bg: 'bg-blue-100' },
  rejected:      { label: 'Rejected',             color: 'text-red-700',    bg: 'bg-red-100' },
}

const COUNTRIES = [
  'United Kingdom', 'United States', 'Canada', 'Australia',
  'Germany', 'Netherlands', 'Ireland', 'New Zealand', 'Other',
]

const INTAKES = [
  'January 2025', 'May 2025', 'September 2025',
  'January 2026', 'May 2026', 'September 2026',
]

// ── Empty form ────────────────────────────────────────────────
const EMPTY_FORM = {
  university_name: '',
  university_country: '',
  course_name: '',
  intake: '',
  application_fee: '',
}

export default function UniversitiesPage() {
  const [universities, setUniversities] = useState<any[]>([])
  const [applicationId, setApplicationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [documentsApproved, setDocumentsApproved] = useState(false)
  const [checkingDocuments, setCheckingDocuments] = useState(true)
  const [application, setApplication] = useState<any>(null)
  const [pendingApprovals, setPendingApprovals] = useState(0)

  useEffect(() => { checkDocuments() }, [])

  async function checkDocuments() {
    setCheckingDocuments(true)
    try {
      const appRes = await api.get('/applications')
      const app = appRes.data?.[0]
      if (!app) {
        setCheckingDocuments(false)
        return
      }

      setApplicationId(app.id)

      // Check if application has progressed beyond document upload stage
      // Stages after document_upload: initial_assessment, counseling, university_selection, etc.
      const stagesAfterDocuments = [
        'initial_assessment',
        'counseling',
        'university_selection',
        'application_submission',
        'offer_letter',
        'tuition_deposit',
        'visa_application',
        'pre_departure',
        'enrolled'
      ]
      
      // Allow access if application stage is beyond document upload
      if (stagesAfterDocuments.includes(app.current_stage)) {
        setDocumentsApproved(true)
        await loadData()
      } else {
        // Still at document upload stage - check if documents are approved
        const docsRes = await api.get(`/documents/${app.id}`)
        const documents = docsRes.data || []
        
        // Check if there are any approved documents
        const approvedDocs = documents.filter((d: any) => d.status === 'approved')
        
        // Allow access if there are approved documents (admin has started reviewing)
        if (approvedDocs.length > 0) {
          setDocumentsApproved(true)
          await loadData()
        } else {
          setDocumentsApproved(false)
        }
      }
    } catch (err) {
      console.error('Failed to check documents:', err)
      setDocumentsApproved(false)
    } finally {
      setCheckingDocuments(false)
    }
  }

  useEffect(() => { 
    if (documentsApproved) {
      loadData() 
    }
  }, [documentsApproved])

  async function loadData() {
    setLoading(true)
    try {
      const appRes = await api.get('/applications')
      const app = appRes.data?.[0]
      if (!app) return
      setApplicationId(app.id)
      setApplication(app)

      const uniRes = await api.get(`/universities/${app.id}`)
      setUniversities(uniRes.data || [])

      // Check for pending approvals
      const pendingRes = await api.get(`/universities/pending-approval/${app.id}`)
      setPendingApprovals(pendingRes.data?.length || 0)
    } catch (err) {
      console.error('Failed to load universities:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!form.university_name.trim() || !form.course_name.trim()) {
      setFormError('University name and course name are required.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/universities', {
        application_id: applicationId,
        university_name: form.university_name.trim(),
        university_country: form.university_country,
        course_name: form.course_name.trim(),
        intake: form.intake,
        application_fee: form.application_fee ? Number(form.application_fee) : null,
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
      await loadData()
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to add university. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Stats
  const total = universities.length
  const submitted = universities.filter(u => u.status !== 'preparing').length
  const offers = universities.filter(u => u.status === 'offer_received').length

  if (checkingDocuments) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Checking document status...</p>
      </div>
    )
  }

  if (!documentsApproved) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <AlertCircle size={40} className="text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Document Approval Required</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            You need to upload and get all your documents approved before you can proceed to university applications.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 text-left max-w-md mx-auto">
            <p className="text-sm font-semibold text-blue-900 mb-3">Next Steps:</p>
            <ol className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="font-bold">1.</span>
                <span>Go to the <strong>Documents</strong> section</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">2.</span>
                <span>Upload all required documents (Academic, ID, English Proficiency, Financial, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">3.</span>
                <span>Wait for our team to review and approve your documents (1-2 business days)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">4.</span>
                <span>Once all documents are approved, you can proceed to university applications</span>
              </li>
            </ol>
          </div>

          <div className="flex gap-3 justify-center">
            <a href="/dashboard/documents" className="btn-primary inline-flex items-center gap-2">
              <AlertCircle size={16} />
              Go to Documents
            </a>
            <button onClick={checkDocuments} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw size={16} />
              Check Again
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-6">
            You will receive an email and SMS notification once your documents are approved.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading university applications...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Pending Approvals Alert */}
      {pendingApprovals > 0 && (
        <div className="card bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600 rounded-full">
              <CheckCircle size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">
                {pendingApprovals} Application{pendingApprovals > 1 ? 's' : ''} Ready for Your Approval
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Your applications have been prepared by our admissions team. Please review and approve them.
              </p>
            </div>
            <a
              href="/dashboard/universities/approve"
              className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2 shrink-0"
            >
              <CheckCircle size={16} />
              Review Now
            </a>
          </div>
        </div>
      )}

      {/* Payment Pending Alert */}
      {universities.some(u => u.status === 'payment_pending' || u.status === 'approved') && (
        <div className="card bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-600 rounded-full">
              <DollarSign size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">
                Application Fee Payment Required
              </h3>
              <p className="text-sm text-orange-700 mt-1">
                You have approved applications that require application fee payment before submission.
              </p>
            </div>
            <a
              href="/dashboard/universities/payment"
              className="btn-primary bg-orange-600 hover:bg-orange-700 flex items-center gap-2 shrink-0"
            >
              <DollarSign size={16} />
              Pay Now
            </a>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">University Applications</h1>
          <p className="text-gray-500 mt-1">Track your university applications and offers</p>
        </div>
        <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Applied',    value: total,     color: 'text-brand-600',  bg: 'bg-brand-50' },
          { label: 'Submitted',        value: submitted, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Offers Received',  value: offers,    color: 'text-green-600',  bg: 'bg-green-50' },
        ].map(stat => (
          <div key={stat.label} className={clsx('card text-center py-4', stat.bg, 'border-0')}>
            <p className={clsx('text-3xl font-bold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Counselor Recommendations */}
      {application?.assessment_status === 'completed' && 
       application?.recommended_universities && 
       application.recommended_universities.length > 0 && (
        <div className="card border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-blue-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-brand-600 rounded-lg">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">Counselor's Recommended Universities</h2>
              <p className="text-sm text-gray-600">Based on your assessment, these universities are best suited for your profile</p>
            </div>
            {universities.length === 0 && (
              <a
                href="/dashboard/universities/select"
                className="btn-primary text-sm flex items-center gap-2 shrink-0"
              >
                <CheckCircle size={14} />
                Select Universities
              </a>
            )}
          </div>

          <div className="space-y-3">
            {application.recommended_universities.map((university: string, idx: number) => {
              // Parse university string - format: "University Name|Country|Portal URL" or just "University Name"
              const parts = university.split('|')
              const uniName = parts[0]
              const uniCountry = parts[1] || ''
              const portalUrl = parts[2] || ''

              return (
                <div key={idx} className="bg-white rounded-lg p-4 border border-brand-100 hover:border-brand-300 transition-all hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                          <span className="text-brand-700 font-bold text-sm">{idx + 1}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900">{uniName}</h3>
                      </div>
                      {uniCountry && (
                        <p className="text-sm text-gray-500 ml-10">{uniCountry}</p>
                      )}
                    </div>
                    {portalUrl && (
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-sm flex items-center gap-2 shrink-0"
                      >
                        <ExternalLink size={14} />
                        Learn More
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {application.counselor_recommendations && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-brand-100">
              <p className="text-sm font-semibold text-gray-700 mb-2">Counselor's Notes:</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {application.counselor_recommendations}
              </p>
            </div>
          )}

          {universities.length === 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>📝 Next Step:</strong> Click "Select Universities" above to choose which universities you'd like to apply to. 
                Our admissions team will then prepare your applications for review.
              </p>
            </div>
          )}
        </div>
      )}

      {/* University list */}
      {universities.length === 0 ? (
        <div className="card text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <GraduationCap size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">No Applications Yet</h3>
          <p className="text-gray-400 text-sm mt-2 mb-6">
            {application?.assessment_status === 'completed' && application?.recommended_universities?.length > 0
              ? 'Select universities from your counselor\'s recommendations above to get started.'
              : 'Your counselor will recommend universities after completing your assessment.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {universities.map(uni => {
            const cfg = STATUS_CONFIG[uni.status] || STATUS_CONFIG.preparing
            const Icon = cfg.icon
            const isOpen = expanded[uni.id]
            const offers = uni.offer_letters || []
            const latestOffer = offers[offers.length - 1]

            return (
              <div key={uni.id} className="card p-0 overflow-hidden">
                {/* University row */}
                <button
                  type="button"
                  onClick={() => toggleExpand(uni.id)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Flag / icon */}
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                    <GraduationCap size={20} className="text-brand-600" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{uni.university_name}</h3>
                      {uni.university_country && (
                        <span className="text-xs text-gray-400">· {uni.university_country}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{uni.course_name}</p>
                    {uni.intake && (
                      <p className="text-xs text-gray-400 mt-0.5">Intake: {uni.intake}</p>
                    )}
                  </div>

                  {/* Status + offer badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    {latestOffer && (
                      <span className={clsx(
                        'text-xs font-medium px-2.5 py-1 rounded-full hidden sm:inline-flex',
                        OFFER_CONFIG[latestOffer.outcome]?.bg,
                        OFFER_CONFIG[latestOffer.outcome]?.color
                      )}>
                        {OFFER_CONFIG[latestOffer.outcome]?.label}
                      </span>
                    )}
                    <span className={clsx('text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1', cfg.bg, cfg.color)}>
                      <Icon size={11} />
                      {cfg.label}
                    </span>
                    {isOpen
                      ? <ChevronUp size={16} className="text-gray-400" />
                      : <ChevronDown size={16} className="text-gray-400" />
                    }
                  </div>
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50/50 space-y-4">

                    {/* Details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</p>
                        <span className={clsx('text-xs font-medium px-2 py-1 rounded-full', cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      {uni.intake && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Intake</p>
                          <p className="font-medium">{uni.intake}</p>
                        </div>
                      )}
                      {uni.reference_number && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Reference No.</p>
                          <p className="font-medium font-mono text-xs">{uni.reference_number}</p>
                        </div>
                      )}
                      {uni.submitted_at && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Submitted</p>
                          <p className="font-medium">{new Date(uni.submitted_at).toLocaleDateString()}</p>
                        </div>
                      )}
                      {uni.application_fee && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Application Fee</p>
                          <p className="font-medium">${uni.application_fee}</p>
                        </div>
                      )}
                      {uni.fee_paid !== undefined && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Application Fee Paid</p>
                          <p className={clsx('font-medium', uni.fee_paid ? 'text-green-600' : 'text-red-500')}>
                            {uni.fee_paid ? 'Yes' : 'No'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Documents links */}
                    {(uni.sop_url || uni.application_form_url) && (
                      <div className="flex gap-3 flex-wrap">
                        {uni.sop_url && (
                          <a href={uni.sop_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
                            <ExternalLink size={12} /> View Statement of Purpose
                          </a>
                        )}
                        {uni.application_form_url && (
                          <a href={uni.application_form_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
                            <ExternalLink size={12} /> View Application Form
                          </a>
                        )}
                      </div>
                    )}

                    {/* Offer letters */}
                    {offers.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Offer Letters</p>
                        <div className="space-y-2">
                          {offers.map((offer: any) => {
                            const offerCfg = OFFER_CONFIG[offer.outcome]
                            return (
                              <div key={offer.id} className={clsx(
                                'flex items-center justify-between p-3 rounded-lg border',
                                offerCfg?.bg, 'border-transparent'
                              )}>
                                <div>
                                  <span className={clsx('text-sm font-semibold', offerCfg?.color)}>
                                    {offerCfg?.label}
                                  </span>
                                  {offer.conditions && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      Conditions: {offer.conditions}
                                    </p>
                                  )}
                                  {offer.offer_deadline && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      Deadline: {new Date(offer.offer_deadline).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {offer.offer_letter_url && (
                                    <a href={offer.offer_letter_url} target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                                      <ExternalLink size={12} /> View Letter
                                    </a>
                                  )}
                                  {offer.offer_status === 'pending_review' && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleOfferResponse(offer.id, 'accepted')}
                                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => handleOfferResponse(offer.id, 'declined')}
                                        className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors"
                                      >
                                        Decline
                                      </button>
                                    </div>
                                  )}
                                  {offer.offer_status === 'accepted' && (
                                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                      <CheckCircle size={12} /> Accepted
                                    </span>
                                  )}
                                  {offer.offer_status === 'declined' && (
                                    <span className="text-xs text-gray-400 font-medium">Declined</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* No offer yet message */}
                    {offers.length === 0 && uni.status === 'submitted' && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 bg-white rounded-lg p-3 border border-gray-100">
                        <Clock size={14} />
                        Awaiting response from {uni.university_name}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info note */}
      <div className="card bg-blue-50 border border-blue-100">
        <div className="flex gap-3">
          <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">How it works</p>
            <ul className="space-y-1 text-blue-600 text-xs">
              <li>• Your counselor recommends universities based on your assessment</li>
              <li>• You select which universities you'd like to apply to</li>
              <li>• Our admissions team prepares your application materials (SOP, forms, documents)</li>
              <li>• You review and approve each application before submission</li>
              <li>• Pay application fees (if applicable)</li>
              <li>• We submit your applications and track responses</li>
              <li>• Offer letters will appear here when received — you can accept or decline directly</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  )

  async function handleOfferResponse(offerId: string, decision: 'accepted' | 'declined') {
    try {
      await api.patch(`/offers/${offerId}/respond`, { decision })
      await loadData()
    } catch (err) {
      console.error('Failed to respond to offer:', err)
    }
  }
}
