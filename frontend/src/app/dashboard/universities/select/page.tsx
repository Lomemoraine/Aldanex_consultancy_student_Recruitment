'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  GraduationCap, CheckCircle, Globe, DollarSign,
  ExternalLink, AlertCircle, Send, ArrowLeft
} from 'lucide-react'
import clsx from 'clsx'

export default function UniversitySelectionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [recommendations, setRecommendations] = useState<any>(null)
  const [selectedUniversities, setSelectedUniversities] = useState<Set<number>>(new Set())
  const [universityDetails, setUniversityDetails] = useState<Record<number, any>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    loadRecommendations()
  }, [])

  async function loadRecommendations() {
    setLoading(true)
    try {
      const res = await api.get('/universities/recommendations')
      setRecommendations(res.data)

      // Initialize university details from recommendations
      if (res.data.recommended_universities && res.data.recommended_universities.length > 0) {
        const details: Record<number, any> = {}
        res.data.recommended_universities.forEach((uni: string, idx: number) => {
          const parts = uni.split('|')
          details[idx] = {
            university_name: parts[0] || '',
            university_country: parts[1] || '',
            portal_url: parts[2] || '',
            course_name: '',
            intake: '',
            application_fee: null
          }
        })
        setUniversityDetails(details)
      }
    } catch (err: any) {
      console.error('Failed to load recommendations:', err)
      setError(err.response?.data?.error || 'Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelection(index: number) {
    const newSelected = new Set(selectedUniversities)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      if (newSelected.size >= 5) {
        setError('You can select a maximum of 5 universities')
        return
      }
      newSelected.add(index)
    }
    setSelectedUniversities(newSelected)
    setError('')
  }

  function updateUniversityDetail(index: number, field: string, value: any) {
    setUniversityDetails(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }))
  }

  async function handleSubmit() {
    if (selectedUniversities.size === 0) {
      setError('Please select at least one university')
      return
    }

    // Validate that selected universities have required details
    const selected = Array.from(selectedUniversities).map(idx => universityDetails[idx])
    const missingDetails = selected.some(uni => !uni.course_name || !uni.intake)

    if (missingDetails) {
      setError('Please fill in course name and intake for all selected universities')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await api.post('/universities/select', {
        selected_universities: selected
      })

      // Success - redirect to universities page
      router.push('/dashboard/universities')
    } catch (err: any) {
      console.error('Failed to submit selections:', err)
      setError(err.response?.data?.error || 'Failed to submit selections. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading recommendations...</p>
      </div>
    )
  }

  if (!recommendations || !recommendations.recommended_universities || recommendations.recommended_universities.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <AlertCircle size={40} className="text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Recommendations Yet</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Your counselor hasn't completed your assessment yet. Once complete, you'll see recommended universities here.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const selectedCount = selectedUniversities.size
  const maxSelections = 5

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard/universities')}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={14} />
          Back to Universities
        </button>
        <h1 className="text-2xl font-bold">Select Universities</h1>
        <p className="text-gray-500 mt-1">
          Choose up to {maxSelections} universities from your counselor's recommendations
        </p>
      </div>

      {/* Selection Counter */}
      <div className="card bg-gradient-to-r from-brand-50 to-blue-50 border-brand-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Universities Selected</p>
            <p className="text-3xl font-bold text-brand-600">{selectedCount} / {maxSelections}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-2">Assessment Score</p>
            <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
              <CheckCircle size={18} className="text-green-600" />
              <span className="text-xl font-bold text-gray-900">{recommendations.assessment_score || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Counselor's Notes */}
      {recommendations.counselor_recommendations && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Counselor's Recommendations:</h3>
          <p className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">
            {recommendations.counselor_recommendations}
          </p>
        </div>
      )}

      {/* University Selection Cards */}
      <div className="space-y-4">
        {recommendations.recommended_universities.map((uni: string, idx: number) => {
          const details = universityDetails[idx]
          const isSelected = selectedUniversities.has(idx)

          return (
            <div
              key={idx}
              className={clsx(
                'card p-0 overflow-hidden transition-all cursor-pointer',
                isSelected ? 'border-2 border-brand-500 shadow-lg' : 'border border-gray-200 hover:border-brand-300'
              )}
              onClick={() => toggleSelection(idx)}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="shrink-0 mt-1">
                    <div className={clsx(
                      'w-6 h-6 rounded border-2 flex items-center justify-center transition-all',
                      isSelected ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
                    )}>
                      {isSelected && <CheckCircle size={16} className="text-white" />}
                    </div>
                  </div>

                  {/* University Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <GraduationCap size={18} className="text-brand-600" />
                          <h3 className="font-semibold text-lg text-gray-900">{details.university_name}</h3>
                        </div>
                        {details.university_country && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-500">
                            <Globe size={14} />
                            {details.university_country}
                          </div>
                        )}
                      </div>
                      {details.portal_url && (
                        <a
                          href={details.portal_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="btn-secondary text-xs flex items-center gap-1.5"
                        >
                          <ExternalLink size={12} />
                          Learn More
                        </a>
                      )}
                    </div>

                    {/* Additional Details (shown when selected) */}
                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">Course / Programme *</label>
                            <input
                              type="text"
                              className="input text-sm"
                              placeholder="e.g., MSc Computer Science"
                              value={details.course_name}
                              onChange={(e) => updateUniversityDetail(idx, 'course_name', e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <label className="label text-xs">Intake *</label>
                            <select
                              className="input text-sm"
                              value={details.intake}
                              onChange={(e) => updateUniversityDetail(idx, 'intake', e.target.value)}
                              required
                            >
                              <option value="">Select intake</option>
                              <option value="January">January</option>
                              <option value="May">May</option>
                              <option value="September">September</option>
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">Application Fee (USD)</label>
                            <div className="relative">
                              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="number"
                                className="input text-sm pl-8"
                                placeholder="50"
                                min="0"
                                value={details.application_fee || ''}
                                onChange={(e) => updateUniversityDetail(idx, 'application_fee', e.target.value ? Number(e.target.value) : null)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isSelected && (
                <div className="bg-brand-50 px-5 py-2 border-t border-brand-100">
                  <p className="text-xs text-brand-700">
                    ✓ Selected - Fill in the details above
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Error Message */}
      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle size={16} />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="card bg-gray-50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">Ready to proceed?</p>
            <p className="text-sm text-gray-500 mt-1">
              {selectedCount === 0 
                ? 'Select at least one university to continue'
                : `You've selected ${selectedCount} ${selectedCount === 1 ? 'university' : 'universities'}. Our admissions team will prepare your applications.`
              }
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={selectedCount === 0 || submitting}
            className="btn-primary flex items-center gap-2 shrink-0"
          >
            <Send size={16} />
            {submitting ? 'Submitting...' : 'Submit Selections'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">What happens next?</p>
            <ol className="space-y-1 text-xs text-blue-600">
              <li>1. Our admissions team will prepare your application materials (SOP, forms, documents)</li>
              <li>2. You'll review and approve each application before submission</li>
              <li>3. Pay application fees (if applicable)</li>
              <li>4. We'll submit your applications to the universities</li>
              <li>5. Track your application status and receive offers</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
