'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import {
  GraduationCap, Plus, X, CheckCircle, Clock, Send,
  AlertCircle, ExternalLink, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'
import clsx from 'clsx'

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  preparing:      { label: 'Preparing',       color: 'text-gray-600',   bg: 'bg-gray-100',    icon: Clock },
  submitted:      { label: 'Submitted',        color: 'text-blue-600',   bg: 'bg-blue-100',    icon: Send },
  offer_received: { label: 'Offer Received',   color: 'text-purple-600', bg: 'bg-purple-100',  icon: CheckCircle },
  rejected:       { label: 'Unsuccessful',     color: 'text-red-600',    bg: 'bg-red-100',     icon: X },
  withdrawn:      { label: 'Withdrawn',        color: 'text-gray-400',   bg: 'bg-gray-100',    icon: X },
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

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const appRes = await api.get('/applications')
      const app = appRes.data?.[0]
      if (!app) return
      setApplicationId(app.id)

      const uniRes = await api.get(`/universities/${app.id}`)
      setUniversities(uniRes.data || [])
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">University Applications</h1>
          <p className="text-gray-500 mt-1">Track your university applications and offers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => { setShowForm(true); setFormError('') }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={16} />
            Add University
          </button>
        </div>
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

      {/* Add University Form */}
      {showForm && (
        <div className="card border-2 border-brand-200">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Plus size={18} className="text-brand-600" />
              Add University Application
            </h2>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError('') }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">University Name *</label>
                <input
                  name="university_name"
                  type="text"
                  className="input"
                  value={form.university_name}
                  onChange={handleChange}
                  placeholder="e.g. University of Manchester"
                  required
                />
              </div>
              <div>
                <label className="label">Country</label>
                <select name="university_country" className="input" value={form.university_country} onChange={handleChange}>
                  <option value="">Select country</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Course / Programme *</label>
                <input
                  name="course_name"
                  type="text"
                  className="input"
                  value={form.course_name}
                  onChange={handleChange}
                  placeholder="e.g. MSc Computer Science"
                  required
                />
              </div>
              <div>
                <label className="label">Intake</label>
                <select name="intake" className="input" value={form.intake} onChange={handleChange}>
                  <option value="">Select intake</option>
                  {INTAKES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Application Fee (USD)</label>
                <input
                  name="application_fee"
                  type="number"
                  className="input"
                  value={form.application_fee}
                  onChange={handleChange}
                  placeholder="e.g. 50"
                  min="0"
                />
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
                <AlertCircle size={16} className="shrink-0" />
                {formError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={submitting}>
                <Plus size={16} />
                {submitting ? 'Adding...' : 'Add University'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError('') }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* University list */}
      {universities.length === 0 ? (
        <div className="card text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <GraduationCap size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">No universities added yet</h3>
          <p className="text-gray-400 text-sm mt-2 mb-6">
            Add the universities you want to apply to and track your applications here.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Add Your First University
          </button>
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
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Fee Paid</p>
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
              <li>• Add the universities you're interested in — your admissions team will prepare and submit your applications</li>
              <li>• Once submitted, you'll receive a reference number to track your application</li>
              <li>• Offer letters will appear here when received — you can accept or decline directly</li>
              <li>• Your counselor will guide you through the next steps after receiving an offer</li>
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
