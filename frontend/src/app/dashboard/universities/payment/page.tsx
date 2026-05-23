'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  DollarSign, CreditCard, Upload, CheckCircle, AlertCircle,
  ArrowLeft, FileText, Clock
} from 'lucide-react'
import clsx from 'clsx'

export default function PaymentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<any[]>([])
  const [selectedApp, setSelectedApp] = useState<any>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'manual'>('online')
  const [paymentReference, setPaymentReference] = useState('')
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

      // Get all applications
      const res = await api.get(`/universities/${app.id}`)
      
      // Filter for payment_pending status
      const pendingPayment = (res.data || []).filter((a: any) => 
        a.status === 'payment_pending' && a.application_fee && a.application_fee > 0
      )
      
      setApplications(pendingPayment)
    } catch (err) {
      console.error('Failed to load applications:', err)
    } finally {
      setLoading(false)
    }
  }

  function openPaymentModal(app: any) {
    setSelectedApp(app)
    setShowPaymentModal(true)
    setPaymentMethod('online')
    setPaymentReference('')
    setError('')
  }

  async function handlePayment() {
    if (paymentMethod === 'manual' && !paymentReference.trim()) {
      setError('Please enter payment reference or upload receipt')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await api.post(`/universities/${selectedApp.id}/payment`, {
        payment_reference: paymentReference.trim() || `MANUAL-${Date.now()}`,
        fee_paid_at: new Date().toISOString()
      })

      // Success
      setShowPaymentModal(false)
      await loadApplications()
      alert('Payment recorded successfully! Your application will be submitted soon.')
      router.push('/dashboard/universities')
    } catch (err: any) {
      console.error('Failed to record payment:', err)
      setError(err.response?.data?.error || 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading payment information...</p>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Pending Payments</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            You don't have any application fees to pay at the moment.
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

  const totalAmount = applications.reduce((sum, app) => sum + (app.application_fee || 0), 0)

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
        <h1 className="text-2xl font-bold">Application Fee Payment</h1>
        <p className="text-gray-500 mt-1">
          Pay application fees to proceed with submission
        </p>
      </div>

      {/* Total Amount Card */}
      <div className="card bg-gradient-to-r from-brand-50 to-blue-50 border-brand-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Amount Due</p>
            <p className="text-4xl font-bold text-brand-600 mt-1">${totalAmount.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {applications.length} application{applications.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="p-4 bg-brand-600 rounded-full">
            <DollarSign size={32} className="text-white" />
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Applications Requiring Payment</h2>
        
        {applications.map(app => (
          <div key={app.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{app.university_name}</h3>
                <p className="text-sm text-gray-500 mt-1">{app.university_country}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span>{app.course_name}</span>
                  <span>·</span>
                  <span>{app.intake}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-brand-600">${app.application_fee}</p>
                <button
                  onClick={() => openPaymentModal(app)}
                  className="btn-primary text-sm mt-2 flex items-center gap-2"
                >
                  <CreditCard size={14} />
                  Pay Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Info */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Payment Information</p>
            <ul className="space-y-1 text-xs text-blue-600">
              <li>• Application fees are paid directly to the universities</li>
              <li>• You can pay online or upload proof of manual payment</li>
              <li>• Once payment is confirmed, your application will be submitted</li>
              <li>• Keep your payment reference for tracking purposes</li>
              <li>• Contact support if you have any payment issues</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Pay Application Fee</h3>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-700 mb-1">{selectedApp.university_name}</p>
              <p className="text-xs text-gray-500 mb-2">{selectedApp.course_name}</p>
              <p className="text-2xl font-bold text-brand-600">${selectedApp.application_fee} USD</p>
            </div>

            {/* Payment Method Selection */}
            <div className="mb-4">
              <label className="label">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('online')}
                  className={clsx(
                    'p-3 rounded-lg border-2 transition-all text-sm font-medium',
                    paymentMethod === 'online'
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <CreditCard size={20} className="mx-auto mb-1" />
                  Online Payment
                </button>
                <button
                  onClick={() => setPaymentMethod('manual')}
                  className={clsx(
                    'p-3 rounded-lg border-2 transition-all text-sm font-medium',
                    paymentMethod === 'manual'
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <Upload size={20} className="mx-auto mb-1" />
                  Manual Payment
                </button>
              </div>
            </div>

            {/* Online Payment */}
            {paymentMethod === 'online' && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-3">
                  <strong>Coming Soon:</strong> Online payment integration with Flutterwave is being set up.
                </p>
                <p className="text-xs text-yellow-700">
                  For now, please use manual payment option and upload your payment receipt.
                </p>
              </div>
            )}

            {/* Manual Payment */}
            {paymentMethod === 'manual' && (
              <div className="mb-4">
                <label className="label">Payment Reference / Receipt Number</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter payment reference or transaction ID"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the reference number from your bank transfer or payment receipt
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
                onClick={handlePayment}
                disabled={submitting || (paymentMethod === 'online')}
                className="btn-primary flex items-center gap-2 flex-1"
              >
                <CheckCircle size={16} />
                {submitting ? 'Processing...' : 'Confirm Payment'}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
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
