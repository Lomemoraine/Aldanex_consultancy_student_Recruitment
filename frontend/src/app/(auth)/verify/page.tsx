'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import Logo from '@/components/Logo'

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const devOtp = searchParams.get('dev_otp') || ''

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [resendMsg, setResendMsg] = useState('')
  const [countdown, setCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-fill OTP in dev mode when email delivery fails
  useEffect(() => {
    if (devOtp && devOtp.length === 6) {
      setOtp(devOtp.split(''))
    }
  }, [devOtp])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return // digits only
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1) // only last digit
    setOtp(newOtp)
    setError('')

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-otp`, {
        email,
        otp: code,
      })
      router.push('/login?verified=1')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Verification failed. Please try again.')
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setResendMsg('')
    setError('')
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/resend-otp`, { email })
      setResendMsg('New code sent! Check your inbox.')
      setCountdown(60)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend code.')
    } finally {
      setResending(false)
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-500">No email provided.</p>
          <Link href="/register" className="text-brand-600 hover:underline mt-2 inline-block">
            Go back to register
          </Link>
        </div>
      </div>
    )
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
            One Last Step
          </h2>
          <p className="text-brand-300 text-sm leading-relaxed">
            We sent a 6-digit verification code to your email. Enter it to confirm your account and start your journey.
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
              <span className="text-3xl">📧</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
            <p className="text-gray-500 mt-2 text-sm">
              We sent a 6-digit code to
            </p>
            <p className="text-brand-700 font-semibold text-sm">{email}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-8">
            {/* Dev mode notice when email failed */}
            {devOtp && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs p-3 rounded-lg mb-4">
                <strong>Dev mode:</strong> Email delivery failed (SMTP not configured). Code auto-filled: <span className="font-mono font-bold">{devOtp}</span>
              </div>
            )}
            <form onSubmit={handleVerify} className="space-y-6">

              {/* OTP inputs */}
              <div>
                <label className="label text-center block mb-4">Enter verification code</label>
                <div className="flex gap-3 justify-center" onPaste={handlePaste}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { inputRefs.current[idx] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleKeyDown(idx, e)}
                      className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none transition-colors
                        ${digit ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-900'}
                        focus:border-brand-500`}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg text-center">
                  {error}
                </div>
              )}

              {resendMsg && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg text-center">
                  {resendMsg}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-3 text-base"
                disabled={loading || otp.join('').length !== 6}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Verifying...
                  </span>
                ) : 'Verify Account'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center space-y-3">
              <p className="text-sm text-gray-500">Didn't receive the code?</p>
              {countdown > 0 ? (
                <p className="text-sm text-gray-400">
                  Resend in <span className="font-semibold text-brand-600">{countdown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm text-accent-600 font-semibold hover:text-accent-700 hover:underline disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend verification code'}
                </button>
              )}
              <p className="text-xs text-gray-400">
                Wrong email?{' '}
                <Link href="/register" className="text-brand-600 hover:underline">
                  Register again
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
