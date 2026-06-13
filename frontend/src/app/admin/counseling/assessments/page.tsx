'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import {
  ClipboardCheck, User, DollarSign, Globe, GraduationCap,
  CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  RefreshCw, Send, Calendar, Save, Plus, X
} from 'lucide-react'
import clsx from 'clsx'

const ASSESSMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  not_started: { label: 'Not Started', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
  completed: { label: 'Completed', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
}

export default function AssessmentsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState('')
  const [userRole, setUserRole] = useState('')

  // Assessment forms
  const [assessmentForms, setAssessmentForms] = useState<Record<string, any>>({})
  const [sessionForms, setSessionForms] = useState<Record<string, any>>({})

  useEffect(() => {
    loadUserRole()
    load()
  }, [])

  async function loadUserRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profile) setUserRole(profile.role)
      }
    } catch (err) {
      console.error('Failed to load user role:', err)
    }
  }

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/counseling/assessments')
      setStudents(res.data || [])
    } catch (err) {
      console.error('Failed to load assessments:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleStartAssessment(applicationId: string) {
    setSaving(applicationId)
    try {
      await api.post('/counseling/assessment/start', { application_id: applicationId })
      await load()
    } catch (err) {
      console.error('Failed to start assessment:', err)
      alert('Failed to start assessment')
    } finally {
      setSaving('')
    }
  }

  async function handleSaveAssessment(applicationId: string) {
    setSaving(`save-${applicationId}`)
    try {
      const form = assessmentForms[applicationId] || {}
      await api.patch(`/counseling/assessment/${applicationId}`, form)
      await load()
      alert('Assessment saved successfully')
    } catch (err) {
      console.error('Failed to save assessment:', err)
      alert('Failed to save assessment')
    } finally {
      setSaving('')
    }
  }

  async function handleCompleteAssessment(applicationId: string, scheduleSession: boolean) {
    setSaving(`complete-${applicationId}`)
    try {
      const sessionDetails = scheduleSession ? sessionForms[applicationId] : null
      await api.post('/counseling/assessment/complete', {
        application_id: applicationId,
        schedule_session: scheduleSession,
        session_details: sessionDetails,
      })
      await load()
      alert(scheduleSession 
        ? 'Assessment completed and session scheduled!' 
        : 'Assessment completed successfully!')
    } catch (err) {
      console.error('Failed to complete assessment:', err)
      alert('Failed to complete assessment')
    } finally {
      setSaving('')
    }
  }

  function updateAssessmentForm(appId: string, field: string, value: any) {
    setAssessmentForms(prev => ({
      ...prev,
      [appId]: { ...(prev[appId] || {}), [field]: value }
    }))
  }

  function updateSessionForm(appId: string, field: string, value: any) {
    setSessionForms(prev => ({
      ...prev,
      [appId]: { ...(prev[appId] || {}), [field]: value }
    }))
  }

  const notStarted = students.filter(s => s.assessment_status === 'not_started')
  const inProgress = students.filter(s => s.assessment_status === 'in_progress')
  const completed = students.filter(s => s.assessment_status === 'completed')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Student Assessments</h1>
          <p className="text-gray-500 mt-1">
            {students.length} student{students.length !== 1 ? 's' : ''} ready for assessment
            {userRole === 'counselor' && ' (assigned to you)'}
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-gray-50">
          <p className="text-2xl font-bold text-gray-600">{notStarted.length}</p>
          <p className="text-sm text-gray-500 mt-1">Not Started</p>
        </div>
        <div className="card bg-blue-50">
          <p className="text-2xl font-bold text-blue-600">{inProgress.length}</p>
          <p className="text-sm text-blue-600 mt-1">In Progress</p>
        </div>
        <div className="card bg-green-50">
          <p className="text-2xl font-bold text-green-600">{completed.length}</p>
          <p className="text-sm text-green-600 mt-1">Completed</p>
        </div>
      </div>

      {/* Students List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : students.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardCheck size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {userRole === 'counselor' 
              ? 'No assigned students ready for assessment'
              : 'No students ready for assessment'
            }
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Students appear here after their documents are verified
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {students.map(student => {
            const isOpen = expanded[student.id]
            const cfg = ASSESSMENT_STATUS_CONFIG[student.assessment_status] || ASSESSMENT_STATUS_CONFIG.not_started
            const Icon = cfg.icon
            const profile = student.profiles
            const form = assessmentForms[student.id] || {}
            const sessionForm = sessionForms[student.id] || {
              session_type: 'virtual',
              platform: 'Zoom',
              duration_minutes: 60,
            }

            return (
              <div key={student.id} className="card p-0 overflow-hidden">
                {/* Student Header */}
                <button
                  type="button"
                  onClick={() => setExpanded(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                  className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold">{profile?.full_name || 'Unknown'}</p>
                      <span className="text-xs text-gray-400 font-mono">{profile?.student_id}</span>
                      <span className={clsx('badge text-xs flex items-center gap-1.5', cfg.bg, cfg.color)}>
                        <Icon size={12} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {profile?.nationality} · {profile?.preferred_study_destination}
                      {student.assessment_score && ` · Score: ${student.assessment_score}/100`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-5 space-y-6 bg-gray-50/50">

                    {/* Not Started State */}
                    {student.assessment_status === 'not_started' && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                        <ClipboardCheck size={32} className="text-gray-300 mx-auto mb-3" />
                        <h3 className="font-semibold text-gray-700 mb-2">Ready for Assessment</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          Start the assessment process to evaluate this student's profile and eligibility
                        </p>
                        <button
                          onClick={() => handleStartAssessment(student.id)}
                          disabled={saving === student.id}
                          className="btn-primary flex items-center gap-2 mx-auto"
                        >
                          <Send size={16} />
                          {saving === student.id ? 'Starting...' : 'Start Assessment'}
                        </button>
                      </div>
                    )}

                    {/* In Progress / Completed State */}
                    {(student.assessment_status === 'in_progress' || student.assessment_status === 'completed') && (
                      <>
                        {/* Academic Evaluation */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <GraduationCap size={15} className="text-brand-600" />
                            Academic Evaluation
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-3">
                            <div>
                              <label className="label text-xs">Highest Qualification</label>
                              <input
                                type="text"
                                className="input text-sm"
                                placeholder="e.g., Bachelor's Degree in Computer Science"
                                value={form.academic_evaluation?.qualification || ''}
                                onChange={e => updateAssessmentForm(student.id, 'academic_evaluation', {
                                  ...(form.academic_evaluation || {}),
                                  qualification: e.target.value
                                })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label text-xs">GPA / Grade</label>
                                <input
                                  type="text"
                                  className="input text-sm"
                                  placeholder="e.g., 3.5/4.0"
                                  value={form.academic_evaluation?.gpa || ''}
                                  onChange={e => updateAssessmentForm(student.id, 'academic_evaluation', {
                                    ...(form.academic_evaluation || {}),
                                    gpa: e.target.value
                                  })}
                                />
                              </div>
                              <div>
                                <label className="label text-xs">Eligibility Rating</label>
                                <select
                                  className="input text-sm"
                                  value={form.academic_evaluation?.rating || ''}
                                  onChange={e => updateAssessmentForm(student.id, 'academic_evaluation', {
                                    ...(form.academic_evaluation || {}),
                                    rating: e.target.value
                                  })}
                                >
                                  <option value="">Select rating</option>
                                  <option value="excellent">Excellent</option>
                                  <option value="good">Good</option>
                                  <option value="average">Average</option>
                                  <option value="below_average">Below Average</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Financial Evaluation */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <DollarSign size={15} className="text-brand-600" />
                            Financial Capability
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-3">
                            <div>
                              <label className="label text-xs">Funding Source</label>
                              <select
                                className="input text-sm"
                                value={form.financial_evaluation?.funding_source || ''}
                                onChange={e => updateAssessmentForm(student.id, 'financial_evaluation', {
                                  ...(form.financial_evaluation || {}),
                                  funding_source: e.target.value
                                })}
                              >
                                <option value="">Select source</option>
                                <option value="self_funded">Self-Funded</option>
                                <option value="family_sponsored">Family Sponsored</option>
                                <option value="scholarship">Scholarship</option>
                                <option value="loan">Education Loan</option>
                                <option value="mixed">Mixed Sources</option>
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs">Financial Capability Rating</label>
                              <select
                                className="input text-sm"
                                value={form.financial_evaluation?.rating || ''}
                                onChange={e => updateAssessmentForm(student.id, 'financial_evaluation', {
                                  ...(form.financial_evaluation || {}),
                                  rating: e.target.value
                                })}
                              >
                                <option value="">Select rating</option>
                                <option value="strong">Strong</option>
                                <option value="adequate">Adequate</option>
                                <option value="needs_support">Needs Support</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* English Proficiency */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Globe size={15} className="text-brand-600" />
                            English Proficiency
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label text-xs">Test Type</label>
                                <select
                                  className="input text-sm"
                                  value={form.english_proficiency_evaluation?.test_type || ''}
                                  onChange={e => updateAssessmentForm(student.id, 'english_proficiency_evaluation', {
                                    ...(form.english_proficiency_evaluation || {}),
                                    test_type: e.target.value
                                  })}
                                >
                                  <option value="">Select test</option>
                                  <option value="IELTS">IELTS</option>
                                  <option value="TOEFL">TOEFL</option>
                                  <option value="PTE">PTE</option>
                                  <option value="Duolingo">Duolingo</option>
                                  <option value="none">Not Taken Yet</option>
                                </select>
                              </div>
                              <div>
                                <label className="label text-xs">Score</label>
                                <input
                                  type="text"
                                  className="input text-sm"
                                  placeholder="e.g., 7.0"
                                  value={form.english_proficiency_evaluation?.score || ''}
                                  onChange={e => updateAssessmentForm(student.id, 'english_proficiency_evaluation', {
                                    ...(form.english_proficiency_evaluation || {}),
                                    score: e.target.value
                                  })}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="label text-xs">Proficiency Rating</label>
                              <select
                                className="input text-sm"
                                value={form.english_proficiency_evaluation?.rating || ''}
                                onChange={e => updateAssessmentForm(student.id, 'english_proficiency_evaluation', {
                                  ...(form.english_proficiency_evaluation || {}),
                                  rating: e.target.value
                                })}
                              >
                                <option value="">Select rating</option>
                                <option value="excellent">Excellent</option>
                                <option value="good">Good</option>
                                <option value="needs_improvement">Needs Improvement</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Recommendations */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <CheckCircle size={15} className="text-brand-600" />
                            Recommendations
                          </h3>
                          <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-4">
                            {/* Recommended Countries */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="label text-xs">Recommended Countries</label>
                                <button
                                  onClick={() => {
                                    const countries = form.recommended_countries || []
                                    updateAssessmentForm(student.id, 'recommended_countries', [...countries, ''])
                                  }}
                                  className="btn-secondary text-xs flex items-center gap-1"
                                >
                                  <Plus size={12} /> Add Country
                                </button>
                              </div>
                              <div className="space-y-2">
                                {(form.recommended_countries || []).map((country: string, idx: number) => (
                                  <div key={idx} className="flex gap-2">
                                    <input
                                      type="text"
                                      className="input text-sm flex-1"
                                      placeholder="e.g., United Kingdom"
                                      value={country}
                                      onChange={e => {
                                        const countries = [...(form.recommended_countries || [])]
                                        countries[idx] = e.target.value
                                        updateAssessmentForm(student.id, 'recommended_countries', countries)
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        const countries = (form.recommended_countries || []).filter((_: any, i: number) => i !== idx)
                                        updateAssessmentForm(student.id, 'recommended_countries', countries)
                                      }}
                                      className="btn-secondary text-xs px-2"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                                {(!form.recommended_countries || form.recommended_countries.length === 0) && (
                                  <p className="text-xs text-gray-400 py-2">No countries added yet</p>
                                )}
                              </div>
                            </div>

                            {/* Recommended Universities */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="label text-xs">Recommended Universities</label>
                                <button
                                  onClick={() => {
                                    const universities = form.recommended_universities || []
                                    updateAssessmentForm(student.id, 'recommended_universities', 
                                      [...universities, 'University Name|Country|https://portal-url.com']
                                    )
                                  }}
                                  className="btn-secondary text-xs flex items-center gap-1"
                                >
                                  <Plus size={12} /> Add University
                                </button>
                              </div>
                              <div className="space-y-2">
                                {(form.recommended_universities || []).map((uni: string, idx: number) => {
                                  const parts = uni.split('|')
                                  const [uniName, country, portalUrl] = parts
                                  
                                  return (
                                    <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input
                                          type="text"
                                          className="input text-sm"
                                          placeholder="e.g., University of Manchester"
                                          value={uniName || ''}
                                          onChange={e => {
                                            const universities = [...(form.recommended_universities || [])]
                                            universities[idx] = `${e.target.value}|${country || ''}|${portalUrl || ''}`
                                            updateAssessmentForm(student.id, 'recommended_universities', universities)
                                          }}
                                        />
                                        <input
                                          type="text"
                                          className="input text-sm"
                                          placeholder="e.g., United Kingdom"
                                          value={country || ''}
                                          onChange={e => {
                                            const universities = [...(form.recommended_universities || [])]
                                            universities[idx] = `${uniName || ''}|${e.target.value}|${portalUrl || ''}`
                                            updateAssessmentForm(student.id, 'recommended_universities', universities)
                                          }}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <input
                                          type="url"
                                          className="input text-sm flex-1"
                                          placeholder="e.g., https://www.manchester.ac.uk/study/international/"
                                          value={portalUrl || ''}
                                          onChange={e => {
                                            const universities = [...(form.recommended_universities || [])]
                                            universities[idx] = `${uniName || ''}|${country || ''}|${e.target.value}`
                                            updateAssessmentForm(student.id, 'recommended_universities', universities)
                                          }}
                                        />
                                        <button
                                          onClick={() => {
                                            const universities = (form.recommended_universities || []).filter((_: any, i: number) => i !== idx)
                                            updateAssessmentForm(student.id, 'recommended_universities', universities)
                                          }}
                                          className="btn-secondary text-xs px-2"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                                {(!form.recommended_universities || form.recommended_universities.length === 0) && (
                                  <p className="text-xs text-gray-400 py-2">No universities added yet</p>
                                )}
                              </div>
                              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-800 font-semibold mb-1">💡 How to use:</p>
                                <p className="text-xs text-blue-700">
                                  Click "Add University" to add each university. Enter the university name, country, and application portal link. Students will see these as recommendations with links to apply.
                                </p>
                              </div>
                            </div>

                            <div>
                              <label className="label text-xs">Overall Assessment Score (0-100)</label>
                              <input
                                type="number"
                                className="input text-sm"
                                min="0"
                                max="100"
                                placeholder="85"
                                value={form.assessment_score || ''}
                                onChange={e => updateAssessmentForm(student.id, 'assessment_score', Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <label className="label text-xs">Assessment Notes</label>
                              <textarea
                                className="input text-sm"
                                rows={4}
                                placeholder="Add detailed notes about the student's profile, strengths, areas of concern, and recommendations..."
                                value={form.assessment_notes || ''}
                                onChange={e => updateAssessmentForm(student.id, 'assessment_notes', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        {(student.assessment_status === 'in_progress' || student.assessment_status === 'completed') && (
                          <div className="pt-3 border-t border-gray-200 space-y-4">
                            {/* Save Progress */}
                            <button
                              onClick={() => handleSaveAssessment(student.id)}
                              disabled={saving === `save-${student.id}`}
                              className="btn-secondary flex items-center gap-2"
                            >
                              <Save size={16} />
                              {saving === `save-${student.id}` ? 'Saving...' : (student.assessment_status === 'completed' ? 'Update Assessment' : 'Save Progress')}
                            </button>

                            {/* Complete Assessment */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <h4 className="font-semibold text-sm text-blue-900 mb-3">Complete Assessment & Schedule Session</h4>
                              
                              <div className="space-y-3 mb-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="label text-xs">Session Type</label>
                                    <select
                                      className="input text-sm"
                                      value={sessionForm.session_type}
                                      onChange={e => updateSessionForm(student.id, 'session_type', e.target.value)}
                                    >
                                      <option value="virtual">Virtual</option>
                                      <option value="physical">In-Person</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="label text-xs">Platform</label>
                                    <select
                                      className="input text-sm"
                                      value={sessionForm.platform}
                                      onChange={e => updateSessionForm(student.id, 'platform', e.target.value)}
                                    >
                                      <option>Zoom</option>
                                      <option>Google Meet</option>
                                      <option>Microsoft Teams</option>
                                      <option>WhatsApp</option>
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="label text-xs">Date & Time</label>
                                  <input
                                    type="datetime-local"
                                    className="input text-sm"
                                    value={sessionForm.scheduled_at || ''}
                                    onChange={e => updateSessionForm(student.id, 'scheduled_at', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="label text-xs">Meeting Link</label>
                                  <input
                                    type="url"
                                    className="input text-sm"
                                    placeholder="https://zoom.us/j/..."
                                    value={sessionForm.meeting_link || ''}
                                    onChange={e => updateSessionForm(student.id, 'meeting_link', e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCompleteAssessment(student.id, true)}
                                  disabled={!sessionForm.scheduled_at || saving === `complete-${student.id}`}
                                  className="btn-primary flex items-center gap-2 text-sm"
                                >
                                  <Calendar size={14} />
                                  {saving === `complete-${student.id}` ? 'Completing...' : 'Complete & Schedule Session'}
                                </button>
                                <button
                                  onClick={() => handleCompleteAssessment(student.id, false)}
                                  disabled={saving === `complete-${student.id}`}
                                  className="btn-secondary text-sm"
                                >
                                  Complete Without Session
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Completed State */}
                        {student.assessment_status === 'completed' && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                              <CheckCircle size={18} />
                              Assessment Completed
                            </div>
                            <p className="text-sm text-green-700">
                              Completed on {new Date(student.assessment_completed_at).toLocaleDateString()}
                            </p>
                            {student.assessment_score && (
                              <p className="text-sm text-green-700 mt-1">
                                Overall Score: <strong>{student.assessment_score}/100</strong>
                              </p>
                            )}
                          </div>
                        )}
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
