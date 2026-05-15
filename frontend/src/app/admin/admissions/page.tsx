'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'
import { STAGE_COLORS } from '@/lib/constants'
import {
  Send, Upload, CheckCircle, Clock, AlertCircle,
  ChevronDown, ChevronUp, RefreshCw, FileText, DollarSign, GraduationCap
} from 'lucide-react'
import clsx from 'clsx'

// Stages the admissions officer handles
const ADMISSIONS_STAGES = [
  'university_selection',
  'application_submission',
  'offer_letter',
  'tuition_deposit',
]

const STAGE_LABELS: Record<string, string> = {
  university_selection:   'University Selection',
  application_submission: 'Application Submission',
  offer_letter:           'Offer Letter',
  tuition_deposit:        'Tuition Deposit & CAS/I-20',
}

const OFFER_OUTCOMES = ['unconditional', 'conditional', 'waitlisted', 'rejected']
const OFFER_LABELS: Record<string, string> = {
  unconditional: 'Unconditional Offer',
  conditional:   'Conditional Offer',
  waitlisted:    'Waitlisted',
  rejected:      'Rejected',
}

export default function AdmissionsPage() {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [stageFilter, setStageFilter] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  // Per-application form state
  const [submitForms, setSubmitForms] = useState<Record<string, { ref: string; sop: string }>>({})
  const [offerForms, setOfferForms] = useState<Record<string, { uni_app_id: string; outcome: string; conditions: string; deadline: string }>>({})
  const [casForms, setCasForms] = useState<Record<string, { type: string; number: string }>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // Load all applications at admissions stages
      const { data: apps } = await supabase
        .from('applications')
        .select('id, student_id, current_stage, created_at')
        .in('current_stage', ADMISSIONS_STAGES)
        .order('created_at', { ascending: false })

      if (!apps || apps.length === 0) { setApplications([]); setLoading(false); return }

      const studentIds = apps.map((a: any) => a.student_id)

      // Load student profiles
      const { data: students } = await supabase
        .from('profiles')
        .select('id, full_name, email, student_id, nationality, preferred_study_destination')
        .in('id', studentIds)

      const studentMap: Record<string, any> = {}
      ;(students || []).forEach((s: any) => { studentMap[s.id] = s })

      // Load university applications for each app
      const enriched = await Promise.all(apps.map(async (app: any) => {
        const { data: uniApps } = await supabase
          .from('university_applications')
          .select('*, offer_letters(*)')
          .eq('application_id', app.id)

        const { data: payments } = await supabase
          .from('payments')
          .select('id, payment_type, amount, currency, status, receipt_url')
          .eq('application_id', app.id)
          .eq('payment_type', 'tuition_deposit')

        return {
          ...app,
          student: studentMap[app.student_id] || null,
          university_applications: uniApps || [],
          tuition_payments: payments || [],
        }
      }))

      setApplications(enriched)
    } catch (err) {
      console.error('Failed to load admissions data:', err)
    } finally {
      setLoading(false)
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleMarkSubmitted(uniAppId: string, appId: string) {
    const f = submitForms[uniAppId] || { ref: '', sop: '' }
    if (!f.ref.trim()) return
    setActionLoading(uniAppId)
    try {
      await api.patch(`/universities/${uniAppId}/submit`, {
        reference_number: f.ref,
        sop_url: f.sop || undefined,
      })
      await load()
    } catch (err) { console.error(err) }
    finally { setActionLoading('') }
  }

  async function handleAddOffer(applicationId: string) {
    const f = offerForms[applicationId]
    if (!f?.uni_app_id || !f?.outcome) return
    setActionLoading(`offer-${applicationId}`)
    try {
      // Get student_id from application
      const app = applications.find(a => a.id === applicationId)
      await api.post('/offers', {
        university_application_id: f.uni_app_id,
        application_id: applicationId,
        student_id: app?.student_id,
        outcome: f.outcome,
        conditions: f.conditions || undefined,
        offer_deadline: f.deadline || undefined,
      })
      await load()
    } catch (err) { console.error(err) }
    finally { setActionLoading('') }
  }

  async function handleVerifyPayment(paymentId: string) {
    setActionLoading(`pay-${paymentId}`)
    try {
      await api.patch(`/payments/${paymentId}/verify`)
      await load()
    } catch (err) { console.error(err) }
    finally { setActionLoading('') }
  }

  async function handleAdvanceStage(appId: string, currentStage: string) {
    const stageOrder = ['university_selection', 'application_submission', 'offer_letter', 'tuition_deposit', 'visa_application']
    const nextIdx = stageOrder.indexOf(currentStage) + 1
    if (nextIdx >= stageOrder.length) return
    setActionLoading(`stage-${appId}`)
    try {
      await api.patch(`/applications/${appId}/stage`, { stage: stageOrder[nextIdx] })
      await load()
    } catch (err) { console.error(err) }
    finally { setActionLoading('') }
  }

  const filtered = stageFilter
    ? applications.filter(a => a.current_stage === stageFilter)
    : applications

  const stageCounts = ADMISSIONS_STAGES.reduce((acc, s) => {
    acc[s] = applications.filter(a => a.current_stage === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admissions Workflow</h1>
          <p className="text-gray-500 mt-1">{applications.length} active applications in admissions stages</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stage summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ADMISSIONS_STAGES.map(stage => (
          <button
            key={stage}
            onClick={() => setStageFilter(stageFilter === stage ? '' : stage)}
            className={clsx(
              'card text-left transition-all duration-150 hover:shadow-card-hover',
              stageFilter === stage ? 'border-2 border-brand-500 bg-brand-50' : ''
            )}
          >
            <p className="text-2xl font-bold text-brand-600">{stageCounts[stage] || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{STAGE_LABELS[stage]}</p>
          </button>
        ))}
      </div>

      {stageFilter && (
        <div className="flex items-center gap-2">
          <span className={clsx('badge', STAGE_COLORS[stageFilter])}>
            {STAGE_LABELS[stageFilter]}
          </span>
          <button onClick={() => setStageFilter('')} className="text-xs text-gray-400 hover:text-gray-600">
            Clear filter ✕
          </button>
        </div>
      )}

      {/* Applications list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <GraduationCap size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No applications at admissions stages{stageFilter ? ' for this filter' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(app => {
            const isOpen = expanded[app.id]
            const uniApps = app.university_applications || []
            const payments = app.tuition_payments || []
            const pendingPayment = payments.find((p: any) => p.status === 'uploaded')
            const ofF = offerForms[app.id] || { uni_app_id: '', outcome: '', conditions: '', deadline: '' }

            return (
              <div key={app.id} className="card p-0 overflow-hidden">
                {/* Application header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(app.id)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold">{app.student?.full_name || 'Unknown'}</p>
                      <span className="text-xs text-gray-400 font-mono">{app.student?.student_id}</span>
                      <span className={clsx('badge text-xs', STAGE_COLORS[app.current_stage])}>
                        {STAGE_LABELS[app.current_stage]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {app.student?.nationality} · {app.student?.preferred_study_destination}
                      {uniApps.length > 0 && ` · ${uniApps.length} universit${uniApps.length === 1 ? 'y' : 'ies'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pendingPayment && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                        Payment to verify
                      </span>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-5 space-y-6 bg-gray-50/50">

                    {/* ── University Applications ── */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <GraduationCap size={15} className="text-brand-600" />
                        University Applications ({uniApps.length})
                      </h3>

                      {uniApps.length === 0 ? (
                        <p className="text-sm text-gray-400">No universities added yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {uniApps.map((uni: any) => {
                            const sf = submitForms[uni.id] || { ref: '', sop: '' }
                            const offers = uni.offer_letters || []
                            const latestOffer = offers[offers.length - 1]

                            return (
                              <div key={uni.id} className="bg-white rounded-lg border border-gray-100 p-4">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div>
                                    <p className="font-medium text-sm">{uni.university_name}</p>
                                    <p className="text-xs text-gray-500">{uni.course_name} · {uni.intake || 'No intake'}</p>
                                    {uni.reference_number && (
                                      <p className="text-xs font-mono text-gray-400 mt-0.5">Ref: {uni.reference_number}</p>
                                    )}
                                  </div>
                                  <span className={clsx('badge text-xs shrink-0', {
                                    'bg-gray-100 text-gray-600': uni.status === 'preparing',
                                    'bg-blue-100 text-blue-600': uni.status === 'submitted',
                                    'bg-purple-100 text-purple-600': uni.status === 'offer_received',
                                    'bg-red-100 text-red-600': uni.status === 'rejected',
                                  })}>
                                    {uni.status?.replace('_', ' ')}
                                  </span>
                                </div>

                                {/* Offer letter info */}
                                {latestOffer && (
                                  <div className={clsx('text-xs px-3 py-2 rounded-lg mb-3', {
                                    'bg-green-50 text-green-700': latestOffer.outcome === 'unconditional',
                                    'bg-yellow-50 text-yellow-700': latestOffer.outcome === 'conditional',
                                    'bg-blue-50 text-blue-700': latestOffer.outcome === 'waitlisted',
                                    'bg-red-50 text-red-700': latestOffer.outcome === 'rejected',
                                  })}>
                                    <strong>{OFFER_LABELS[latestOffer.outcome]}</strong>
                                    {latestOffer.conditions && ` — ${latestOffer.conditions}`}
                                    {latestOffer.offer_deadline && ` · Deadline: ${new Date(latestOffer.offer_deadline).toLocaleDateString()}`}
                                    {' · '}
                                    <span className="capitalize">{latestOffer.offer_status}</span>
                                  </div>
                                )}

                                {/* Submit action */}
                                {uni.status === 'preparing' && (
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <input
                                      type="text"
                                      className="input text-xs py-1.5 flex-1 min-w-[140px]"
                                      placeholder="Reference number *"
                                      value={sf.ref}
                                      onChange={e => setSubmitForms(prev => ({ ...prev, [uni.id]: { ...sf, ref: e.target.value } }))}
                                    />
                                    <input
                                      type="url"
                                      className="input text-xs py-1.5 flex-1 min-w-[140px]"
                                      placeholder="SOP URL (optional)"
                                      value={sf.sop}
                                      onChange={e => setSubmitForms(prev => ({ ...prev, [uni.id]: { ...sf, sop: e.target.value } }))}
                                    />
                                    <button
                                      onClick={() => handleMarkSubmitted(uni.id, app.id)}
                                      disabled={!sf.ref.trim() || actionLoading === uni.id}
                                      className="btn-primary text-xs flex items-center gap-1.5 py-1.5 disabled:opacity-50"
                                    >
                                      <Send size={12} />
                                      {actionLoading === uni.id ? 'Saving...' : 'Mark Submitted'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Add Offer Letter ── */}
                    {uniApps.some((u: any) => u.status === 'submitted') && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <FileText size={15} className="text-brand-600" />
                          Record Offer Letter
                        </h3>
                        <div className="bg-white rounded-lg border border-gray-100 p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="label text-xs">University *</label>
                              <select
                                className="input text-sm"
                                value={ofF.uni_app_id}
                                onChange={e => setOfferForms(prev => ({ ...prev, [app.id]: { ...ofF, uni_app_id: e.target.value } }))}
                              >
                                <option value="">Select university</option>
                                {uniApps.filter((u: any) => u.status === 'submitted').map((u: any) => (
                                  <option key={u.id} value={u.id}>{u.university_name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs">Outcome *</label>
                              <select
                                className="input text-sm"
                                value={ofF.outcome}
                                onChange={e => setOfferForms(prev => ({ ...prev, [app.id]: { ...ofF, outcome: e.target.value } }))}
                              >
                                <option value="">Select outcome</option>
                                {OFFER_OUTCOMES.map(o => <option key={o} value={o}>{OFFER_LABELS[o]}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs">Conditions (if conditional)</label>
                              <input
                                type="text"
                                className="input text-sm"
                                placeholder="e.g. Achieve IELTS 7.0"
                                value={ofF.conditions}
                                onChange={e => setOfferForms(prev => ({ ...prev, [app.id]: { ...ofF, conditions: e.target.value } }))}
                              />
                            </div>
                            <div>
                              <label className="label text-xs">Offer Deadline</label>
                              <input
                                type="date"
                                className="input text-sm"
                                value={ofF.deadline}
                                onChange={e => setOfferForms(prev => ({ ...prev, [app.id]: { ...ofF, deadline: e.target.value } }))}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddOffer(app.id)}
                            disabled={!ofF.uni_app_id || !ofF.outcome || actionLoading === `offer-${app.id}`}
                            className="btn-primary text-sm mt-3 flex items-center gap-2 disabled:opacity-50"
                          >
                            <CheckCircle size={14} />
                            {actionLoading === `offer-${app.id}` ? 'Saving...' : 'Record Offer Letter'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Tuition Deposit Verification ── */}
                    {payments.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <DollarSign size={15} className="text-brand-600" />
                          Tuition Deposit
                        </h3>
                        <div className="space-y-2">
                          {payments.map((p: any) => (
                            <div key={p.id} className="bg-white rounded-lg border border-gray-100 p-4 flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium">
                                  {p.currency} {Number(p.amount).toLocaleString()}
                                </p>
                                <span className={clsx('text-xs font-medium', {
                                  'text-yellow-600': p.status === 'pending',
                                  'text-blue-600': p.status === 'uploaded',
                                  'text-green-600': p.status === 'verified',
                                })}>
                                  {p.status === 'pending' ? 'Awaiting receipt' :
                                   p.status === 'uploaded' ? 'Receipt uploaded — pending verification' :
                                   'Verified ✓'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {p.receipt_url && (
                                  <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-brand-600 hover:underline">
                                    View Receipt
                                  </a>
                                )}
                                {p.status === 'uploaded' && (
                                  <button
                                    onClick={() => handleVerifyPayment(p.id)}
                                    disabled={actionLoading === `pay-${p.id}`}
                                    className="btn-primary text-xs py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    <CheckCircle size={12} />
                                    {actionLoading === `pay-${p.id}` ? 'Verifying...' : 'Verify Payment'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Advance Stage ── */}
                    {app.current_stage !== 'tuition_deposit' && (
                      <div className="pt-3 border-t border-gray-200">
                        <button
                          onClick={() => handleAdvanceStage(app.id, app.current_stage)}
                          disabled={actionLoading === `stage-${app.id}`}
                          className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                          <Send size={14} />
                          {actionLoading === `stage-${app.id}` ? 'Advancing...' : `Advance to next stage`}
                        </button>
                      </div>
                    )}

                    {/* Advance to Visa stage from tuition_deposit */}
                    {app.current_stage === 'tuition_deposit' && (
                      <div className="pt-3 border-t border-gray-200">
                        <button
                          onClick={() => handleAdvanceStage(app.id, app.current_stage)}
                          disabled={actionLoading === `stage-${app.id}`}
                          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                          <Send size={14} />
                          {actionLoading === `stage-${app.id}` ? 'Advancing...' : 'Advance to Visa Application'}
                        </button>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
