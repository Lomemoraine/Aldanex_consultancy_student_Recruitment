'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  GraduationCap, FileText, CheckCircle, AlertCircle,
  ExternalLink, Send, MessageSquare, ArrowLeft, DollarSign
} from 'lucide-react'
import clsx from 'clsx'

export default function ApplicationApprovalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<any[]>([])
  const [selectedApp, setSelectedApp] = useState<any>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showChangesModal, setShowChangesModal] = useState(false)
  const [signature, setSignature] = useState('')
  const [changeComments, setChangeComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadApplications()
  }, [])

  async function loadApplications() {
    setLoading(true)
    try {
      // Get student's application ID
      const appRes = await api.get('/applications')
      const app = appRes.data?.[0]
      if (!app) return

      // Get applications ready for approval
      const res = await api.get(`/universities/pending-approval/${app.id}`)
      setApplications(res.data || [])
    } catch (err) {
      console.error('Failed to load applications:', err)
    } finally {
      setLoading(false)
    }
  }

  function openApprovalModal(app: any) {
    setSelectedApp(app)
    setShowApprovalModal(true)
    setSignature('')
    setError('')
  }

  function openChangesModal(app: any) {
    setSelectedApp(app)
    setShowChangesModal(true)
    setChangeComments('')
    setError('')
  }

  async function handleApprove() {
    if (!signature.trim()) {
      setError('Please enter your full name as signature')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await api.post(`/universities/${selectedApp.id}/approve`, {
        signature: signature.trim()
      })

      // Success
      setShowApprovalModal(false)
      await loadApplications()
      
      // Show success message
      alert('Application approved successfully! ' + 
        (selectedApp.application_fee && selectedApp.application_fee > 0 
          ? 'Please proceed to payment.' 
          : 'The admissions team will submit your application.'))
      
      // Redirect to universities page
      router.push('/dashboard/universities')
    } catch (err: any) {
      console.error('Failed to approve:', err)
      setError(err.response?.data?.error || 'Failed to approve application')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestChanges() {
    if (!changeComments.trim()) {
      setError('Please describe what changes you need')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await api.post(`/universities/${selectedApp.id}/request-changes`, {
        comments: changeComments.trim()
      })

      // Success
      setShowChangesModal(false)
      await loadApplications()
      alert('Change request submitted successfully! The admissions team will review and update your application.')
      router.push('/dashboard/universities')
    } catch (err: any) {
      console.error('Failed to request changes:', err)
      setError(err.response?.data?.error || 'Failed to submit change request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading applications...</p>
      </div>
    )
  }

  if (applications.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
            <CheckCircle size={40} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Applications Ready</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            You don't have any applications ready for approval yet. Our admissions team is preparing your applications.
          </p>
          <button
            onClick={() => router.push('/dashboard/universities')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Universities
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard/universities')}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={14} />
          Back to Universities
        </button>
        <h1 className="text-2xl font-bold">Review & Approve Applications</h1>
        <p className="text-gray-500 mt-1">
          Review your prepared applications and approve them for submission
        </p>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {applications.map(app => (
          <div key={app.id} className="card">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-brand-50 rounded-lg">
                <GraduationCap size={24} className="text-brand-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900">{app.university_name}</h3>
                <p className="text-sm text-gray-500">{app.university_country}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span>Course: {app.course_name}</span>
                  <span>·</span>
                  <span>Intake: {app.intake}</span>
                  {app.application_fee && app.application_fee > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <DollarSign size={14} />
                        {app.application_fee} USD
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Application Materials */}
            <div className="space-y-3 mb-4">
              <h4 className="text-sm font-semibold text-gray-700">Application Materials:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {app.sop_url && (
                  <a
                    href={app.sop_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <FileText size={16} className="text-brand-600" />
                    <span className="text-sm font-medium text-gray-700">Statement of Purpose</span>
                    <ExternalLink size={12} className="text-gray-400 ml-auto" />
                  </a>
                )}
                {app.application_form_url && (
                  <a
                    href={app.application_form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <FileText size={16} className="text-brand-600" />
                    <span className="text-sm font-medium text-gray-700">Application Form</span>
                    <ExternalLink size={12} className="text-gray-400 ml-auto" />
                  </a>
                )}
              </div>
            </div>

            {/* Checklist */}
            {app.checklist && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Preparation Checklist:</h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {Object.entries(app.checklist).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <CheckCircle size={12} className={clsx(value ? 'text-green-600' : 'text-gray-300')} />
                        <span className={clsx(value ? 'text-green-700' : 'text-gray-400')}>
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => openApprovalModal(app)}
                className="btn-primary flex items-center gap-2 flex-1"
              >
                <CheckCircle size={16} />
                Approve Application
              </button>
              <button
                onClick={() => openChangesModal(app)}
                className="btn-secondary flex items-center gap-2"
              >
                <MessageSquare size={16} />
                Request Changes
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Before Approving</p>
            <ul className="space-y-1 text-xs text-blue-600">
              <li>• Review the Statement of Purpose carefully</li>
              <li>• Check the application form for accuracy</li>
              <li>• Verify all personal information is correct</li>
              <li>• If you need changes, click "Request Changes" and describe what needs to be updated</li>
              <li>• Once approved, you cannot make changes (you'll need to contact support)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Approve Application</h3>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-700 mb-1">{selectedApp.university_name}</p>
              <p className="text-xs text-gray-500">{selectedApp.course_name}</p>
            </div>

            <div className="mb-4">
              <label className="label">E-Signature (Your Full Name) *</label>
              <input
                type="text"
                className="input"
                placeholder="Enter your full name"
                value={signature}
                onChange={e => setSignature(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                By entering your name, you confirm that you have reviewed and approve this application
              </p>
            </div>

            {selectedApp.application_fee && selectedApp.application_fee > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> This application requires a fee of ${selectedApp.application_fee} USD. 
                  You'll be prompted to pay after approval.
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="btn-primary flex items-center gap-2 flex-1"
              >
                <CheckCircle size={16} />
                {submitting ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => setShowApprovalModal(false)}
                disabled={submitting}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Changes Modal */}
      {showChangesModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Request Changes</h3>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-700 mb-1">{selectedApp.university_name}</p>
              <p className="text-xs text-gray-500">{selectedApp.course_name}</p>
            </div>

            <div className="mb-4">
              <label className="label">What changes do you need? *</label>
              <textarea
                className="input"
                rows={4}
                placeholder="Please describe the changes you'd like to see in your application..."
                value={changeComments}
                onChange={e => setChangeComments(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Be specific about what needs to be changed so our team can update it quickly
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRequestChanges}
                disabled={submitting}
                className="btn-primary flex items-center gap-2 flex-1"
              >
                <Send size={16} />
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button
                onClick={() => setShowChangesModal(false)}
                disabled={submitting}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
