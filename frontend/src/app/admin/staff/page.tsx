'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { UserCog, Plus, RefreshCw, AlertCircle, ShieldOff, Trash2, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  admin:        { label: 'Admin',         color: 'text-red-700',    bg: 'bg-red-100' },
  counselor:    { label: 'Counselor',     color: 'text-blue-700',   bg: 'bg-blue-100' },
  admissions:   { label: 'Admissions',    color: 'text-purple-700', bg: 'bg-purple-100' },
  visa_officer: { label: 'Visa Officer',  color: 'text-green-700',  bg: 'bg-green-100' },
}

const EMPTY_FORM = { full_name: '', email: '', password: '', role: 'counselor', phone: '' }

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [currentUserId, setCurrentUserId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
  const [deleting, setDeleting] = useState('')
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete(member: any) {
    setDeleting(member.id)
    setConfirmDelete(null)
    setDeleteError('')
    try {
      await api.delete(`/admin/staff/${member.id}`)
      setStaff(prev => prev.filter(s => s.id !== member.id))
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to remove staff member.')
    } finally {
      setDeleting('')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setIsAdmin(false); setLoading(false); return }
      setCurrentUserId(session.user.id)

      supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          const admin = data?.role === 'admin'
          setIsAdmin(admin)
          if (admin) {
            load()
          } else {
            setLoading(false)
          }
        })
    })
  }, [])

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

  // ── Loading state ─────────────────────────────────────────
  if (loading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )
  }

  // ── Access denied ─────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldOff size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-500 mt-2 text-sm max-w-xs mx-auto">
            Only administrators can manage staff accounts.
          </p>
        </div>
      </div>
    )
  }

  // ── Admin view ────────────────────────────────────────────
  const grouped = staff.reduce((acc: Record<string, any[]>, s: any) => {
    if (!acc[s.role]) acc[s.role] = []
    acc[s.role].push(s)
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Remove Staff Member</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              You are about to permanently remove the following team member:
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              <p className="font-semibold text-red-800">{confirmDelete.full_name}</p>
              <p className="text-xs text-red-600">
                Email: {confirmDelete.email} · Role: {ROLE_CONFIG[confirmDelete.role]?.label}
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              This will delete their staff account. All of their existing assignments on applications, visa reviews, document approvals, and confirmations will be unassigned (set to unassigned/null) so student records are preserved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting === confirmDelete.id ? 'Removing...' : 'Yes, Remove Staff'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-gray-500 mt-1">{staff.length} staff member{staff.length !== 1 ? 's' : ''}</p>
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

      {/* Success banner */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} /> {success}
        </div>
      )}

      {/* Delete error banner */}
      {deleteError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{deleteError}</span>
          </div>
          <button onClick={() => setDeleteError('')}>✕</button>
        </div>
      )}

      {/* Add Staff Form */}
      {showForm && (
        <div className="card border-2 border-brand-200">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">Add New Staff Member</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
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
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff grouped by role */}
      {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
        const members = grouped[role] || []
        if (members.length === 0) return null
        return (
          <div key={role} className="card">
            <div className="flex items-center gap-2 mb-4">
              <span className={clsx('badge', cfg.bg, cfg.color)}>{cfg.label}</span>
              <span className="text-sm text-gray-400">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <UserCog size={16} className="text-brand-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{m.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      {m.phone && <p className="text-xs text-gray-500">{m.phone}</p>}
                      <p className="text-xs text-gray-400">
                        Joined {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {m.id !== currentUserId ? (
                      <button
                        onClick={() => setConfirmDelete(m)}
                        disabled={deleting === m.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Remove staff member"
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 bg-gray-150 font-bold px-2 py-1 rounded" title="You cannot delete yourself">
                        You
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {staff.length === 0 && (
        <div className="card text-center py-12">
          <UserCog size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No staff members yet. Add your first team member above.</p>
        </div>
      )}
    </div>
  )
}
