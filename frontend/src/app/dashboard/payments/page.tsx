'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import {
  CreditCard, CheckCircle, Clock, XCircle, AlertCircle,
  Upload, ExternalLink, RefreshCw, DollarSign, FileText, Shield
} from 'lucide-react'
import clsx from 'clsx'

// ── Types ─────────────────────────────────────────────────────
interface Payment {
  id: string
  payment_type: string
  amount: number
  currency: string
  provider: string
  provider_reference: string
  status: 'pending' | 'uploaded' | 'verified' | 'failed'
  receipt_url: string | null
  created_at: string
  updated_at: string
}

// ── Config ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:  { label: 'Pending',    color: 'text-yellow-600', bg: 'bg-yellow-50',  icon: Clock },
  uploaded: { label: 'Under Review', color: 'text-blue-600',   bg: 'bg-blue-50',    icon: Clock },
  verified: { label: 'Verified',   color: 'text-green-600',  bg: 'bg-green-50',   icon: CheckCircle },
  failed:   { label: 'Failed',     color: 'text-red-600',    bg: 'bg-red-50',     icon: XCircle },
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  application_fee:  'Application Fee',
  tuition_deposit:  'Tuition Deposit',
  visa_fee:         'Visa Fee',
  service_fee:      'Service Fee',
  other:            'Other Payment',
}

const PAYMENT_TYPES = [
  { value: 'application_fee', label: 'Application Fee' },
  { value: 'tuition_deposit', label: 'Tuition Deposit' },
  { value: 'visa_fee',        label: 'Visa Fee' },
  { value: 'service_fee',     label: 'Service Fee' },
]

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [applicationId, setApplicationId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [uploadError, setUploadError] = useState('')

  const [form, setForm] = useState({
    payment_type: '',
    amount: '',
    currency: 'USD',
    provider: 'Bank Transfer',
    provider_reference: '',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const appRes = await api.get('/applications')
      const app = appRes.data?.[0]
      if (!app) return

      setApplicationId(app.id)
      setStudentId(app.student_id)

      const payRes = await api.get(`/payments/${app.id}`)
      setPayments(payRes.data || [])
    } catch (err) {
      console.error('Failed to load payments:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleReceiptUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    paymentId: string
  ) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File must be under 5MB.')
      return
    }

    setUploading(paymentId)
    setUploadError('')

    try {
      // Upload to Supabase Storage via backend signed URL
      const { data: urlData } = await api.post('/documents/upload-url', {
        file_name: file.name,
        file_type: file.type,
        category: 'financial',
        application_id: applicationId,
      })

      await fetch(urlData.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      // Update payment record with receipt URL
      await api.patch(`/payments/${paymentId}/receipt`, {
        receipt_url: urlData.file_path,
        status: 'uploaded',
      })

      await loadData()
    } catch (err) {
      setUploadError('Failed to upload receipt. Please try again.')
    } finally {
      setUploading('')
    }
  }

  async function handleLogPayment(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!form.payment_type || !form.amount) {
      setFormError('Payment type and amount are required.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/payments/log', {
        application_id: applicationId,
        student_id: studentId,
        payment_type: form.payment_type,
        amount: Number(form.amount),
        currency: form.currency,
        provider: form.provider,
        provider_reference: form.provider_reference,
        status: 'pending',
      })

      setForm({ payment_type: '', amount: '', currency: 'USD', provider: 'Bank Transfer', provider_reference: '' })
      setShowForm(false)
      await loadData()
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to log payment.')
    } finally {
      setSubmitting(false)
    }
  }

  // Stats
  const totalPaid = payments
    .filter(p => p.status === 'verified')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const totalPending = payments
    .filter(p => p.status === 'pending' || p.status === 'uploaded')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading payments...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-gray-500 mt-1">Track your application fees and payments</p>
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
            <FileText size={16} />
            Log Payment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-xl shrink-0">
            <CheckCircle size={22} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Verified</p>
            <p className="text-2xl font-bold text-green-600">
              ${totalPaid.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-xl shrink-0">
            <Clock size={22} className="text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600">
              ${totalPending.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-brand-100 rounded-xl shrink-0">
            <CreditCard size={22} className="text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Transactions</p>
            <p className="text-2xl font-bold text-brand-600">{payments.length}</p>
          </div>
        </div>
      </div>

      {/* Log Payment Form */}
      {showForm && (
        <div className="card border-2 border-brand-200">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText size={18} className="text-brand-600" />
              Log a Payment
            </h2>
            <button
              onClick={() => { setShowForm(false); setFormError('') }}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >✕</button>
          </div>

          <form onSubmit={handleLogPayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Payment Type *</label>
                <select
                  className="input"
                  value={form.payment_type}
                  onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}
                  required
                >
                  <option value="">Select type</option>
                  {PAYMENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount *</label>
                <div className="flex gap-2">
                  <select
                    className="input w-24 shrink-0"
                    value={form.currency}
                    onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                  >
                    <option>USD</option>
                    <option>GBP</option>
                    <option>EUR</option>
                    <option>KES</option>
                    <option>AUD</option>
                    <option>CAD</option>
                  </select>
                  <input
                    type="number"
                    className="input flex-1"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select
                  className="input"
                  value={form.provider}
                  onChange={e => setForm(p => ({ ...p, provider: e.target.value }))}
                >
                  <option>Bank Transfer</option>
                  <option>Stripe</option>
                  <option>Flutterwave</option>
                  <option>PayPal</option>
                  <option>M-Pesa</option>
                  <option>Cash</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="label">Reference / Transaction ID</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. TXN123456"
                  value={form.provider_reference}
                  onChange={e => setForm(p => ({ ...p, provider_reference: e.target.value }))}
                />
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
                <AlertCircle size={16} className="shrink-0" />
                {formError}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-600">
              <strong>Note:</strong> After logging your payment, upload the receipt/proof below. Your admissions team will verify it within 1–2 business days.
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={submitting}>
                <FileText size={16} />
                {submitting ? 'Logging...' : 'Log Payment'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
          <AlertCircle size={16} className="shrink-0" />
          {uploadError}
          <button onClick={() => setUploadError('')} className="ml-auto">✕</button>
        </div>
      )}

      {/* Payment history */}
      {payments.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">No payments yet</h3>
          <p className="text-gray-400 text-sm mt-2 mb-6 max-w-sm mx-auto">
            When you make a payment (application fee, tuition deposit, etc.), log it here and upload your receipt for verification.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <FileText size={16} />
            Log Your First Payment
          </button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold">Payment History</h2>
          </div>

          <div className="divide-y divide-gray-50">
            {payments.map(payment => {
              const cfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending
              const Icon = cfg.icon
              const isUploading = uploading === payment.id

              return (
                <div key={payment.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: icon + details */}
                    <div className="flex items-start gap-3">
                      <div className={clsx('p-2.5 rounded-xl shrink-0 mt-0.5', cfg.bg)}>
                        <CreditCard size={18} className={cfg.color} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {payment.provider}
                          {payment.provider_reference && (
                            <span className="ml-2 font-mono text-xs text-gray-400">
                              #{payment.provider_reference}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(payment.created_at).toLocaleDateString([], {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Right: amount + status + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="text-lg font-bold text-gray-900">
                        {payment.currency} {Number(payment.amount).toLocaleString()}
                      </p>

                      <span className={clsx(
                        'flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full',
                        cfg.bg, cfg.color
                      )}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-1">
                        {/* View receipt */}
                        {payment.receipt_url && (
                          <a
                            href={payment.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                          >
                            <ExternalLink size={12} />
                            View Receipt
                          </a>
                        )}

                        {/* Upload receipt */}
                        {(payment.status === 'pending' || payment.status === 'failed') && (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={e => handleReceiptUpload(e, payment.id)}
                              disabled={isUploading}
                            />
                            <span className={clsx(
                              'flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
                              isUploading
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-brand-600 text-white hover:bg-brand-700'
                            )}>
                              <Upload size={12} />
                              {isUploading ? 'Uploading...' : 'Upload Receipt'}
                            </span>
                          </label>
                        )}

                        {/* Replace receipt */}
                        {payment.status === 'uploaded' && (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={e => handleReceiptUpload(e, payment.id)}
                              disabled={isUploading}
                            />
                            <span className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-colors">
                              <Upload size={12} />
                              Replace Receipt
                            </span>
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Security note */}
      <div className="card bg-gray-50 border border-gray-100">
        <div className="flex gap-3">
          <Shield size={18} className="text-gray-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-500">
            <p className="font-medium text-gray-600 mb-1">Payment Security</p>
            <ul className="space-y-1 text-xs">
              <li>• All payments are verified by our admissions team before being marked as confirmed</li>
              <li>• Upload clear, legible receipts in PDF, JPG, or PNG format (max 5MB)</li>
              <li>• For bank transfers, include the transaction reference number</li>
              <li>• Contact your counselor if you have any payment queries</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  )
}
