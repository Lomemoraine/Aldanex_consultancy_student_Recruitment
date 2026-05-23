'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import Logo from '@/components/Logo'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [tokenVerified, setTokenVerified] = useState(false)

  useEffect(() => {
    const emailParam = searchParams.get('email')
    const tokenParam = searchParams.get('token')
    
    if (emailParam) setEmail(emailParam)
    if (tokenParam) {
      setToken(tokenParam)
      // Auto-verify token if provided in URL
      verifyToken(emailParam || '', tokenParam)
    }
  }, [searchParams])

  async function verifyToken(emailValue: string, tokenValue: string) {
    if (!emailValue || !tokenValue) return

    setVerifying(true)
    setError('')

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-reset-token`, {
        email: emailValue,
        token: tokenValue
      })
      setTokenVerified(true)
    } catch (err: any) {
      console.error('Verify token error:', err)
      
      if (err.code === 'ERR_NETWORK' || err.message?.toLowerCase().includes('network')) {
        setError('Unable to connect to the server. Please check your internet connection.')
      } else if (!err.response) {
        setError('Cannot reach the server. Please try again.')
      } else {
        setError(err.response?.data?.error || 'Invalid or expired reset code')
      }
      setTokenVerified(false)
    } finally {
      setVerifying(false)
    }
  }

  async function handleVerifyToken(e: React.FormEvent) {
    e.preventDefault()
    await verifyToken(email, token)
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`, {
        email,
        token,
        new_password: newPassword
      })
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      console.error('Reset password error:', err)
      
      if (err.code === 'ERR_NETWORK' || err.message?.toLowerCase().includes('network')) {
        setError('Unable to connect to the server. Please check your internet connection.')
      } else if (!err.response) {
        setError('Cannot reach the server. Please try again.')
      } else {
        setError(err.response?.data?.error || 'Failed to reset password. Please try again.')
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
            Create New Password
          </h2>
          <p className="text-brand-300 text-sm leading-relaxed">
            Enter the code we sent to your email and choose a new secure password for your account.
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
              <span className="text-3xl">🔑</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-gray-500 mt-2 text-sm">
              {tokenVerified ? 'Enter your new password below' : 'Enter the code sent to your email'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-8">
            {success ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✓</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Password Reset Successful!</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Your password has been successfully changed.
                </p>
                <p className="text-gray-500 text-xs">
                  Redirecting you to sign in...
                </p>
              </div>
            ) : verifying ? (
              <div className="text-center py-8">
                <svg className="animate-spin h-8 w-8 mx-auto text-brand-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <p className="text-gray-500 text-sm mt-4">Verifying reset code...</p>
              </div>
            ) : !tokenVerified ? (
              <form onSubmit={handleVerifyToken} className="space-y-5">
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

                <div>
                  <label className="label">Reset Code</label>
                  <input
                    type="text"
                    className="input text-center text-2xl tracking-widest font-mono"
                    value={token}
                    onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="000000"
                    maxLength={6}
                    pattern="\d{6}"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the 6-digit code from your email</p>
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
                  Verify Code
                </button>

                <div className="text-center">
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-brand-600 hover:text-brand-700 hover:underline"
                  >
                    Didn't receive a code? Request new one
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg flex items-center gap-2 mb-4">
                  <span>✓</span> Code verified! Now set your new password.
                </div>

                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                </div>

                <div>
                  <label className="label">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="input pr-10"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
                      Resetting...
                    </span>
                  ) : 'Reset Password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
