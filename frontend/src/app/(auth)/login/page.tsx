'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import Logo from '@/components/Logo'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setSuccess('Account created successfully! You can now sign in.')
    }
    if (searchParams.get('verified') === '1') {
      setSuccess('✓ Email verified! Your account is ready. Sign in below.')
    }
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        console.log('Auth error:', authError)
        
        // Provide specific error messages based on the error
        if (authError.message?.toLowerCase().includes('invalid login credentials')) {
          setError('This account cannot be found. Please use a different account or sign up for a new account.')
        } else if (authError.message?.toLowerCase().includes('email not confirmed')) {
          setError('Your email is not verified. Please check your inbox for the verification code.')
        } else if (authError.message?.toLowerCase().includes('user not found')) {
          setError('This account cannot be found. Please use a different account or sign up for a new account.')
        } else {
          setError(authError.message || 'Login failed. Please try again.')
        }
        setLoading(false)
        return
      }

      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      if (profileError || !profile) {
        setError('Account not found in our system. Please contact support or sign up again.')
        setLoading(false)
        return
      }

      const staffRoles = ['admin', 'counselor', 'admissions', 'visa_officer']
      window.location.href = staffRoles.includes(profile.role) ? '/admin' : '/dashboard'

    } catch (err: any) {
      console.error('Login error:', err)
      // Check if it's a network error
      if (err.message?.toLowerCase().includes('fetch') || err.message?.toLowerCase().includes('network')) {
        setError('Unable to connect to the server. Please check your internet connection and try again.')
      } else {
        setError('An unexpected error occurred. Please try again later.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-600/20 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <Logo size="xl" />
          </div>

          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Your Study Abroad<br />
            Journey Starts Here
          </h2>
          <p className="text-brand-300 text-base leading-relaxed">
            Track your application, upload documents, communicate with your counselor, and manage your entire admission process in one place.
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            { icon: '🎓', text: '2,400+ students successfully placed' },
            { icon: '🌍', text: '150+ partner universities worldwide' },
            { icon: '✅', text: '94% visa approval success rate' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-3 text-brand-200 text-sm">
              <span className="text-lg">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Logo size="md" variant="full" theme="light" className="justify-center" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 text-center">Welcome Back</h1>
            <p className="text-gray-500 mt-1 text-sm"></p>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-8">
            <form onSubmit={handleLogin} className="space-y-5">
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
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
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
              </div>

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-lg flex items-center gap-2">
                  <span>✓</span> {success}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button type="submit" className="btn-primary flex-1 py-3 text-base" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Signing in...
                    </span>
                  ) : 'Sign In'}
                </button>
                <Link 
                  href="/forgot-password" 
                  className="btn-secondary py-3 px-6 text-base whitespace-nowrap"
                >
                  Forgot Password?
                </Link>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                New student?{' '}
                <Link href="/register" className="text-accent-600 font-semibold hover:text-accent-700 hover:underline">
                  Apply here →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
