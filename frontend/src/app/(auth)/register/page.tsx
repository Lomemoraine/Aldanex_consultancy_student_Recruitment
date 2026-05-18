'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'
import Logo from '@/components/Logo'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    nationality: '',
    preferred_study_destination: '',
    password: '',
    confirm_password: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        nationality: form.nationality,
        preferred_study_destination: form.preferred_study_destination,
        password: form.password,
      })

      // In dev mode, if email failed, show the OTP directly
      if (data.dev_otp) {
        router.push(`/verify?email=${encodeURIComponent(form.email)}&dev_otp=${data.dev_otp}`)
      } else {
        router.push(`/verify?email=${encodeURIComponent(form.email)}`)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
      setLoading(false)
    }
  }

  const destinations = [
    'United Kingdom', 'United States', 'Canada', 'Australia',
    'Germany', 'Netherlands', 'Ireland', 'New Zealand', 'Other',
  ]

  const benefits = [
    'Dedicated personal counselor',
    'Real-time application tracking',
    'Document management system',
    'Visa application support',
    'Pre-departure guidance',
  ]

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-20 left-0 w-48 h-48 bg-brand-600/20 rounded-full -translate-x-1/2" />

        <div className="relative">
          <div className="mb-12">
            <Logo size="md" variant="full" theme="dark" />
          </div>

          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Start Your International<br />
            <span className="text-accent-400">Education Journey</span>
          </h2>
          <p className="text-brand-300 text-sm leading-relaxed mb-8">
            Join thousands of students who have successfully secured placements at top universities worldwide with Aldanex Global Consult.
          </p>

          <div className="space-y-3">
            {benefits.map(b => (
              <div key={b} className="flex items-center gap-3 text-brand-200 text-sm">
                <CheckCircle size={16} className="text-accent-400 shrink-0" />
                {b}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-brand-500 text-xs">
          © {new Date().getFullYear()} Aldanex Global Consult
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 overflow-y-auto bg-gray-50 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-lg">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-6">
            <Logo size="md" variant="full" theme="light" className="justify-center" />
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create Your Account</h1>
            <p className="text-gray-500 mt-1 text-sm">Fill in your details to get started</p>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-8">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input name="full_name" type="text" className="input" required
                    value={form.full_name} onChange={handleChange} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input name="phone" type="tel" className="input"
                    value={form.phone} onChange={handleChange} placeholder="+254712345678" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="label">Email Address *</label>
                <input name="email" type="email" className="input" required
                  value={form.email} onChange={handleChange} placeholder="jane@example.com" />
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nationality *</label>
                  <input name="nationality" type="text" className="input" required
                    value={form.nationality} onChange={handleChange} placeholder="e.g. Kenyan" />
                </div>
                <div>
                  <label className="label">Preferred Destination</label>
                  <select name="preferred_study_destination" className="input"
                    value={form.preferred_study_destination} onChange={handleChange}>
                    <option value="">Select country</option>
                    {destinations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Password *</label>
                  <div className="relative">
                    <input name="password" type={showPassword ? 'text' : 'password'}
                      className="input pr-10" required
                      value={form.password} onChange={handleChange} placeholder="Min. 8 characters" />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirm Password *</label>
                  <input name="confirm_password" type={showPassword ? 'text' : 'password'}
                    className="input" required
                    value={form.confirm_password} onChange={handleChange} placeholder="Repeat password" />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-3 text-base mt-2" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Creating Account...
                  </span>
                ) : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="text-accent-600 font-semibold hover:text-accent-700 hover:underline">
                  Sign in →
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            By creating an account, you agree to Aldanex Global Consult's terms of service.
          </p>
        </div>
      </div>
    </div>
  )
}
