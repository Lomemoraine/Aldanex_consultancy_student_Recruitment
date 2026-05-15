'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Settings, User, Lock, Save, CheckCircle, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' })
  const [passwordForm, setPasswordForm] = useState({ current: '', new_password: '', confirm: '' })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (p) {
        setProfile(p)
        setProfileForm({ full_name: p.full_name || '', phone: p.phone || '' })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileError('')
    try {
      await supabase
        .from('profiles')
        .update({ full_name: profileForm.full_name, phone: profileForm.phone })
        .eq('id', profile.id)

      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } catch (err: any) {
      setProfileError('Failed to save profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')

    if (passwordForm.new_password !== passwordForm.confirm) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }

    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new_password })
      if (error) throw error
      setPasswordSaved(true)
      setPasswordForm({ current: '', new_password: '', confirm: '' })
      setTimeout(() => setPasswordSaved(false), 3000)
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Account info */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <User size={18} className="text-brand-600" />
          <h2 className="text-lg font-semibold">Account Information</h2>
        </div>

        <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-brand-100 shrink-0">
            <Image
              src="/logo.jpeg"
              alt="Aldanex"
              width={56}
              height={56}
              className="object-contain w-full h-full"
            />
          </div>
          <div>
            <p className="font-semibold text-lg">{profile?.full_name}</p>
            <p className="text-gray-500 text-sm">{profile?.email}</p>
            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 capitalize">
              {profile?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={profileForm.full_name}
                onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input type="tel" className="input" value={profileForm.phone}
                onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+254712345678" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Email Address</label>
              <input className="input bg-gray-50 text-gray-500 cursor-not-allowed"
                value={profile?.email || ''} readOnly tabIndex={-1} />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed here. Contact system admin.</p>
            </div>
          </div>
          {profileError && <p className="text-red-500 text-sm">{profileError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={savingProfile}>
              <Save size={16} /> {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
            {profileSaved && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle size={16} /> Saved
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={18} className="text-brand-600" />
          <h2 className="text-lg font-semibold">Change Password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                value={passwordForm.new_password}
                onChange={e => setPasswordForm(p => ({ ...p, new_password: e.target.value }))}
                placeholder="Min. 8 characters"
                required
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input"
              value={passwordForm.confirm}
              onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
              placeholder="Repeat new password"
              required
            />
          </div>
          {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={savingPassword}>
              <Lock size={16} /> {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
            {passwordSaved && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle size={16} /> Password updated
              </span>
            )}
          </div>
        </form>
      </div>

      {/* System info */}
      <div className="card bg-gray-50 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-700">System Information</h2>
        </div>
        <dl className="space-y-2 text-sm">
          {[
            ['System',    'Aldanex ERP v1.0'],
            ['Stack',     'Next.js · Node.js · Supabase'],
            ['Role',      profile?.role?.replace('_', ' ')],
            ['User ID',   profile?.id?.slice(0, 8) + '...'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-gray-400">{label}</dt>
              <dd className="font-medium text-gray-600 capitalize">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
