'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { CheckCircle, Clock, XCircle, RefreshCw, Eye, Search } from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:  { label: 'Pending',      color: 'text-yellow-600', bg: 'bg-yellow-50',  icon: Clock },
  uploaded: { label: 'Under Review', color: 'text-blue-600',   bg: 'bg-blue-50',    icon: Clock },
  verified: { label: 'Verified',     color: 'text-green-600',  bg: 'bg-green-50',   icon: CheckCircle },
  failed:   { label: 'Failed',       color: 'text-red-600',    bg: 'bg-red-50',     icon: XCircle },
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  application_fee: 'Application Fee',
  tuition_deposit: 'Tuition Deposit',
  visa_fee:        'Visa Fee',
  service_fee:     'Service Fee',
  other:           'Other',
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('uploaded')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // Load all applications then their payments
      const appsRes = await api.get('/applications')
      const apps = appsRes.data || []

      const allPayments: any[] = []
      await Promise.all(apps.map(async (app: any) => {
        try {
          const payRes = await api.get(`/payments/${app.id}`)
          const pays = (payRes.data || []).map((p: any) => ({
            ...p,
            student_name: app.student?.full_name || 'Unknown',
            student_id_code: app.student?.student_id || '—',
          }))
          allPayments.push(...pays)
        } catch {}
      }))

      allPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPayments(allPayments)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(paymentId: string) {
    setVerifying(paymentId)
    try {
      await api.patch(`/payments/${paymentId}/verify`)
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setVerifying('')
    }
  }

  const filtered = payments.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      p.student_name?.toLowerCase().includes(q) ||
      p.student_id_code?.toLowerCase().includes(q) ||
      p.provider_reference?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalVerified = payments.filter(p => p.status === 'verified').reduce((s, p) => s + Number(p.amount), 0)
  const pendingCount = payments.filter(p => p.status === 'uploaded').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-gray-500 mt-1">
            {pendingCount > 0 && <span className="text-orange-600 font-medium">{pendingCount} awaiting verification · </span>}
            Total verified: <span className="font-semibold text-green-600">${totalVerified.toLocaleString()}</span>
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by student or reference..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Method</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No payments found</td></tr>
              ) : filtered.map(p => {
                const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending
                const Icon = cfg.icon
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.student_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.student_id_code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {p.currency} {Number(p.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.provider}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {p.provider_reference || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full w-fit', cfg.bg, cfg.color)}>
                        <Icon size={11} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.receipt_url && (
                          <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                            <Eye size={12} /> Receipt
                          </a>
                        )}
                        {p.status === 'uploaded' && (
                          <button
                            onClick={() => handleVerify(p.id)}
                            disabled={verifying === p.id}
                            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {verifying === p.id ? 'Verifying...' : 'Verify'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
