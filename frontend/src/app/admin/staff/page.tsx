'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { UserCog, Plus, X, RefreshCw, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  admin:        { label: 'Admin',          color: 'text-red-700',    bg: 'bg-red-100' },
  counselor:    { label: 'Counselor',      color: 'text-blue-700',   bg: 'bg-blue-100' },
  admissions:   { label: 'Admissions',     color: 'text-purple-700', bg: 'bg-purple-100' },
  visa_officer: { label: 'Visa Officer',   color: 'text-green-700',  bg: 'bg-green-100' },
}

const EMPTY_FORM = { full_name: '', email: '', password: '', role: 'counselor', phone: '' }

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/admin/staff')
      setStaff(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSuccess('')

    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/admin/staff', form)
      setSuccess(`${form.full_name} has been added as ${ROLE_CONFIG[form.role]?.label}.`)
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create staff account.')
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = staff.reduce((acc: Record<string, any[]>, s: any) => {
    if (!acc[s.role]) acc[s.role] = []
    acc[s.role].push(s)
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-gray-500 mt-1">{staff.length} staff members</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => { setShowForm(true); setFormError(''); setSuccess('') }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Add Staff
          </button>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} /> {success}
        </div>
      )}

      {/* Add Staff Form */}
      {showForm && (
        <div className="card border-2 border-brand-200">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">Add New Staff Member</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" required value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Jane Doe" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" required value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="jane@aldanex.com" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="tel" className="input" value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+254712345678" />
              </div>
              <div>
                <label className="label">Role *</label>
                <select className="input" value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="counselor">Counselor</option>
                  <option value="admissions">Admissions Officer</option>
                  <option value="visa_officer">Visa Officer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Temporary Password *</label>
                <input type="password" className="input" required value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min. 8 characters" />
              </div>
            </div>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
                {formError}
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={submitting}>
                <Plus size={16} /> {submitting ? 'Creating...' : 'Create Account'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Staff by role */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const members = grouped[role] || []
          if (members.length === 0) return null
          return (
            <div key={role} className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className={clsx('badge', cfg.bg, cfg.color)}>{cfg.label}</span>
                <span className="text-sm text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                        <UserCog size={16} className="text-brand-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{m.full_name}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {m.phone && <p className="text-xs text-gray-500">{m.phone}</p>}
                      <p className="text-xs text-gray-400">
                        Joined {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {!loading && staff.length === 0 && (
        <div className="card text-center py-12">
          <UserCog size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No staff members yet. Add your first team member above.</p>
        </div>
      )}
    </div>
  )
}
