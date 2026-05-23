'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import Logo from '@/components/Logo'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, { email })
      setSuccess(true)
      // Redirect to reset password page after 2 seconds
      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(email)}`)
      }, 2000)
    } catch (err: any) {
      console.error('Forgot password error:', err)
      
      // Provide specific error messages
      if (err.code === 'ERR_NETWORK' || err.message?.toLowerCase().includes('network')) {
        setError('Unable to connect to the server. Please check your internet connection and try again.')
      } else if (!err.response) {
        setError('Cannot reach the server. Please check if the server is running and try again.')
      } else {
        setError(err.response?.data?.error || 'Failed to send reset code. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="mb-12">
            <Logo size="lg" />
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Reset Your Password
          </h2>
          <p className="text-brand-300 text-sm leading-relaxed">
            Enter your email address and we'll send you a code to reset your password.
          </p>
        </div>
        <p className="relative text-brand-500 text-xs">
          © {new Date().getFullYear()} Aldanex Global Consult
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Logo size="md" />
          </div>

          <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Forgot Password?</h1>
            <p className="text-gray-500 mt-2 text-sm">
              No worries, we'll send you reset instructions
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-8">
            {success ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✓</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h3>
                <p className="text-gray-600 text-sm mb-4">
                  We've sent a password reset code to <strong>{email}</strong>
                </p>
                <p className="text-gray-500 text-xs">
                  Redirecting you to enter the code...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <button 
                  type="submit" 
                  className="btn-primary w-full py-3 text-base" 
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Sending...
                    </span>
                  ) : 'Send Reset Code'}
                </button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <Link href="/login" className="text-sm text-brand-600 hover:text-brand-700 hover:underline flex items-center justify-center gap-1">
                <span>←</span> Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
