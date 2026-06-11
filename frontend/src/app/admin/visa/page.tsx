'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'
import {
  Plane, CheckCircle, Clock, AlertCircle, FileText,
  Calendar, RefreshCw, ChevronDown, ChevronUp, Send, User
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

export default function AdminVisaPage() {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [actionLoading, setActionLoading] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [userId, setUserId] = useState<string>('')

  // Form states
  const [createForms, setCreateForms] = useState<Record<string, { visa_type: string; destination_country: string }>>({})
  
  // Track which visa is being edited to prevent refetch during typing
  const [editingVisa, setEditingVisa] = useState<string | null>(null)

  useEffect(() => { 
    loadUserRole()
  }, [])

  useEffect(() => {
    if (userRole) {
      load()
    }
  }, [userRole, userId])

  async function loadUserRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, id')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setUserRole(profile.role)
          setUserId(profile.id)
        }
      }
    } catch (err) {
      console.error('Failed to load user role:', err)
    }
  }

  async function load() {
    setLoading(true)
    try {
      // Use backend API which handles RLS policies and data enrichment
      // Add timestamp to prevent caching
      const response = await api.get(`/visa?t=${Date.now()}`);
      const enriched = response.data || [];

      console.log('Applications from API:', enriched);
      console.log('Applications with visa:', enriched.filter((a: any) => a.visa));
      console.log('Applications without visa:', enriched.filter((a: any) => !a.visa));
      
      setApplications(enriched);
    } catch (err) {
      console.error('Failed to load visa data:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleCreateVisa(appId: string, studentId: string) {
    const f = createForms[appId]
    if (!f?.visa_type || !f?.destination_country) {
      alert('Please fill in all required fields')
      return
    }
    
    console.log('Creating visa with:', { appId, studentId, form: f })
    
    setActionLoading(`create-${appId}`)
    try {
      const response = await api.post('/visa', {
        application_id: appId,
        student_id: studentId,
        visa_type: f.visa_type,
        destination_country: f.destination_country,
      })
      
      console.log('Visa created successfully:', response.data)
      
      // Reload the data
      await load()
      
      // Clear the form
      setCreateForms(prev => ({ ...prev, [appId]: { visa_type: '', destination_country: '' } }))
      
      // Keep the application expanded so user can see the result
      setExpanded(prev => ({ ...prev, [appId]: true }))
      
      // Show success message
      alert('Visa application created successfully!')
    } catch (err: any) {
      console.error('Failed to create visa:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create visa application'
      alert(`Error: ${errorMessage}`)
    } finally {
      setActionLoading('')
    }
  }

  async function handleUpdateVisa(visaId: string, updates: any) {
    setActionLoading(`update-${visaId}`)
    try {
      const response = await api.patch(`/visa/${visaId}`, updates)
      
      // Update local state instead of reloading everything
      setApplications(prev => prev.map(app => {
        if (app.visa?.id === visaId) {
          return {
            ...app,
            visa: response.data
          }
        }
        return app
      }))
      
      console.log('Visa updated successfully:', response.data)
    } catch (err) {
      console.error('Failed to update visa:', err)
      alert('Failed to update visa application')
    } finally {
      setActionLoading('')
    }
  }

  async function handleToggleChecklistItem(visaId: string, checklist: any, itemKey: string) {
    const updated = { ...checklist, [itemKey]: !checklist[itemKey] }
    await handleUpdateVisa(visaId, { checklist: updated })
  }

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = applications.filter(a => a.visa?.status === s).length
    return acc
  }, {} as Record<string, number>)

  const noVisaCount = applications.filter(a => !a.visa).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visa Management</h1>
          <p className="text-gray-500 mt-1">
            {applications.length} student{applications.length !== 1 ? 's' : ''} at visa application stage
            {userRole === 'counselor' && ' (assigned to you)'}
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card bg-gray-50">
          <p className="text-2xl font-bold text-gray-600">{noVisaCount}</p>
          <p className="text-xs text-gray-500 mt-1">Not Started</p>
        </div>
        <div className="card bg-blue-50">
          <p className="text-2xl font-bold text-blue-600">{statusCounts.in_progress || 0}</p>
          <p className="text-xs text-blue-600 mt-1">In Progress</p>
        </div>
        <div className="card bg-orange-50">
          <p className="text-2xl font-bold text-orange-600">{statusCounts.submitted || 0}</p>
          <p className="text-xs text-orange-600 mt-1">Submitted</p>
        </div>
        <div className="card bg-green-50">
          <p className="text-2xl font-bold text-green-600">{statusCounts.approved || 0}</p>
          <p className="text-xs text-green-600 mt-1">Approved</p>
        </div>
      </div>

      {/* Applications list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : applications.length === 0 ? (
        <div className="card text-center py-12">
          <Plane size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {userRole === 'counselor' 
              ? 'No assigned students at visa application stage'
              : 'No students at visa application stage'
            }
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Students appear here after completing the tuition deposit stage.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map(app => {
            const isOpen = expanded[app.id]
            const visa = app.visa
            const cfg = visa ? STATUS_CONFIG[visa.status] || STATUS_CONFIG.not_started : STATUS_CONFIG.not_started
            const Icon = cfg.icon
            const checklist = visa?.checklist || {}
            const completedItems = Object.values(checklist).filter(Boolean).length
            const totalItems = CHECKLIST_ITEMS.length
            const progress = (completedItems / totalItems) * 100

            const createForm = createForms[app.id] || { visa_type: '', destination_country: '' }

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
                      <p className="font-semibold">
                        {app.student?.full_name || app.student?.email || 'Unknown Student'}
                      </p>
                      <span className="text-xs text-gray-400 font-mono">
                        {app.student?.student_id || 'No ID'}
                      </span>
                      {visa && (
                        <span className={clsx('badge text-xs flex items-center gap-1.5', cfg.bg, cfg.color)}>
                          <Icon size={12} />
                          {cfg.label}
                        </span>
                      )}
                      {!visa && (
                        <span className="badge text-xs bg-gray-100 text-gray-600">
                          Visa Not Created
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {app.student?.email && `${app.student.email} · `}
                      {app.student?.nationality || 'Unknown nationality'} · {app.student?.preferred_study_destination || 'Unknown destination'}
                      {visa && visa.visa_reference_number && ` · Ref: ${visa.visa_reference_number}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-5 space-y-6 bg-gray-50/50">

                    {/* ── Create Visa Application ── */}
                    {!visa && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Plane size={15} className="text-brand-600" />
                          Create Visa Application
                        </h3>
                        <div className="bg-white rounded-lg border border-gray-100 p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="label text-xs">Visa Type *</label>
                              <select
                                className="input text-sm"
                                value={createForm.visa_type}
                                onChange={e => setCreateForms(prev => ({ 
                                  ...prev, 
                                  [app.id]: { ...createForm, visa_type: e.target.value } 
                                }))}
                              >
                                <option value="">Select visa type</option>
                                <option value="Student Visa">Student Visa</option>
                                <option value="F-1 Visa">F-1 Visa (USA)</option>
                                <option value="Tier 4 Visa">Tier 4 Visa (UK)</option>
                                <option value="Study Permit">Study Permit (Canada)</option>
                                <option value="Subclass 500">Subclass 500 (Australia)</option>
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs">Destination Country *</label>
                              <input
                                type="text"
                                className="input text-sm"
                                placeholder="e.g. United Kingdom"
                                value={createForm.destination_country}
                                onChange={e => setCreateForms(prev => ({ 
                                  ...prev, 
                                  [app.id]: { ...createForm, destination_country: e.target.value } 
                                }))}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCreateVisa(app.id, app.student_id)}
                            disabled={!createForm.visa_type || !createForm.destination_country || actionLoading === `create-${app.id}`}
                            className="btn-primary text-sm mt-3 flex items-center gap-2 disabled:opacity-50"
                          >
                            <Send size={14} />
                            {actionLoading === `create-${app.id}` ? 'Creating...' : 'Create Visa Application'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Visa Details & Management ── */}
                    {visa && (
                      <>
                        {/* Status Update */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Clock size={15} className="text-brand-600" />
                            Update Status
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4">
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                                <button
                                  key={status}
                                  onClick={() => handleUpdateVisa(visa.id, { status })}
                                  disabled={visa.status === status || actionLoading === `update-${visa.id}`}
                                  className={clsx(
                                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                    visa.status === status 
                                      ? `${config.bg} ${config.color} ring-2 ring-offset-1 ring-brand-500`
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  )}
                                >
                                  {config.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Document Checklist */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <FileText size={15} className="text-brand-600" />
                            Document Checklist ({completedItems}/{totalItems})
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4">
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
                                  <button
                                    key={item.key}
                                    onClick={() => handleToggleChecklistItem(visa.id, checklist, item.key)}
                                    disabled={actionLoading === `update-${visa.id}`}
                                    className={clsx(
                                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                                      isComplete 
                                        ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
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
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Reference Number & Submission */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <FileText size={15} className="text-brand-600" />
                            Application Details
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-3">
                            <div>
                              <label className="label text-xs">Visa Reference Number</label>
                              <input
                                type="text"
                                className="input text-sm"
                                placeholder="Enter reference number"
                                defaultValue={visa.visa_reference_number || ''}
                                onBlur={e => {
                                  if (e.target.value !== visa.visa_reference_number) {
                                    handleUpdateVisa(visa.id, { visa_reference_number: e.target.value })
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <label className="label text-xs">Submission Date</label>
                              <input
                                type="datetime-local"
                                className="input text-sm"
                                defaultValue={visa.submitted_at ? new Date(visa.submitted_at).toISOString().slice(0, 16) : ''}
                                onBlur={e => {
                                  if (e.target.value && e.target.value !== visa.submitted_at) {
                                    handleUpdateVisa(visa.id, { submitted_at: new Date(e.target.value).toISOString() })
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Biometrics & Interview */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Calendar size={15} className="text-brand-600" />
                            Important Dates
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-3">
                            <div>
                              <label className="label text-xs">Biometrics Appointment</label>
                              <input
                                type="datetime-local"
                                className="input text-sm"
                                defaultValue={visa.biometrics_booked_at ? new Date(visa.biometrics_booked_at).toISOString().slice(0, 16) : ''}
                                onBlur={e => {
                                  if (e.target.value && e.target.value !== visa.biometrics_booked_at) {
                                    handleUpdateVisa(visa.id, { biometrics_booked_at: new Date(e.target.value).toISOString() })
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <label className="label text-xs">Biometrics Appointment URL</label>
                              <input
                                type="url"
                                className="input text-sm"
                                placeholder="https://..."
                                defaultValue={visa.biometrics_appointment_url || ''}
                                onBlur={e => {
                                  if (e.target.value !== visa.biometrics_appointment_url) {
                                    handleUpdateVisa(visa.id, { biometrics_appointment_url: e.target.value })
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <label className="label text-xs">Mock Interview Date</label>
                              <input
                                type="datetime-local"
                                className="input text-sm"
                                defaultValue={visa.mock_interview_scheduled_at ? new Date(visa.mock_interview_scheduled_at).toISOString().slice(0, 16) : ''}
                                onBlur={e => {
                                  if (e.target.value && e.target.value !== visa.mock_interview_scheduled_at) {
                                    handleUpdateVisa(visa.id, { mock_interview_scheduled_at: new Date(e.target.value).toISOString() })
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <label className="label text-xs">Mock Interview Notes</label>
                              <textarea
                                className="input text-sm"
                                rows={2}
                                placeholder="Notes from mock interview..."
                                defaultValue={visa.mock_interview_notes || ''}
                                onBlur={e => {
                                  if (e.target.value !== visa.mock_interview_notes) {
                                    handleUpdateVisa(visa.id, { mock_interview_notes: e.target.value })
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <label className="label text-xs">Actual Interview Date</label>
                              <input
                                type="datetime-local"
                                className="input text-sm"
                                defaultValue={visa.interview_date ? new Date(visa.interview_date).toISOString().slice(0, 16) : ''}
                                onBlur={e => {
                                  if (e.target.value && e.target.value !== visa.interview_date) {
                                    handleUpdateVisa(visa.id, { interview_date: new Date(e.target.value).toISOString() })
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Decision */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <AlertCircle size={15} className="text-brand-600" />
                            Visa Decision
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-3">
                            <div>
                              <label className="label text-xs">Decision</label>
                              <select
                                className="input text-sm"
                                value={visa.decision || ''}
                                onChange={e => handleUpdateVisa(visa.id, { 
                                  decision: e.target.value,
                                  decision_date: new Date().toISOString()
                                })}
                              >
                                <option value="">Not decided yet</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="pending_additional_docs">Pending Additional Documents</option>
                              </select>
                            </div>
                            {visa.decision && (
                              <div>
                                <label className="label text-xs">Decision Date</label>
                                <input
                                  type="date"
                                  className="input text-sm"
                                  value={visa.decision_date ? new Date(visa.decision_date).toISOString().split('T')[0] : ''}
                                  onChange={e => {
                                    if (e.target.value) {
                                      handleUpdateVisa(visa.id, { decision_date: new Date(e.target.value).toISOString() })
                                    }
                                  }}
                                />
                              </div>
                            )}
                            {visa.decision === 'approved' && (
                              <div>
                                <label className="label text-xs">Visa Document URL</label>
                                <input
                                  type="url"
                                  className="input text-sm"
                                  placeholder="https://..."
                                  defaultValue={visa.visa_doc_url || ''}
                                  onBlur={e => {
                                    if (e.target.value !== visa.visa_doc_url) {
                                      handleUpdateVisa(visa.id, { visa_doc_url: e.target.value })
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </>
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
