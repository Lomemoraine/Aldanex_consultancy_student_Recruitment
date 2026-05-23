'use client'

import { ClipboardCheck, CheckCircle, Clock, Globe, GraduationCap, Star, Calendar } from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'

interface AssessmentStatusCardProps {
  application: any
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any; description: string }> = {
  not_started: {
    label: 'Pending',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    icon: Clock,
    description: 'Your counselor will begin your assessment soon.'
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    icon: Clock,
    description: 'Your counselor is reviewing your profile and documents.'
  },
  completed: {
    label: 'Completed',
    color: 'text-green-600',
    bg: 'bg-green-100',
    icon: CheckCircle,
    description: 'Your assessment is complete! Review your results below.'
  },
}

export default function AssessmentStatusCard({ application }: AssessmentStatusCardProps) {
  if (!application) return null

  const status = application.assessment_status || 'not_started'
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon

  // Don't show card if assessment hasn't started and student is at very early stages
  if (status === 'not_started' && 
      ['registered', 'profile_completion', 'document_upload'].includes(application.current_stage)) {
    return null
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardCheck size={20} className="text-brand-600" />
          Counselor Assessment
        </h2>
        <span className={clsx('badge text-xs flex items-center gap-1.5', cfg.bg, cfg.color)}>
          <Icon size={12} />
          {cfg.label}
        </span>
      </div>

      {/* Status Description */}
      <div className={clsx('p-4 rounded-lg mb-4', cfg.bg)}>
        <p className={clsx('text-sm font-medium', cfg.color)}>
          {cfg.description}
        </p>
        {status === 'in_progress' && (
          <p className="text-xs text-gray-500 mt-2">
            Estimated completion: 2-3 business days
          </p>
        )}
      </div>

      {/* Completed Assessment Details */}
      {status === 'completed' && (
        <div className="space-y-4">
          {/* Assessment Score */}
          {application.assessment_score && (
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-brand-50 to-blue-50 rounded-lg border border-brand-100">
              <div className="p-3 bg-white rounded-full shadow-sm">
                <Star size={24} className="text-brand-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Overall Assessment Score</p>
                <p className="text-3xl font-bold text-brand-600">{application.assessment_score}/100</p>
              </div>
            </div>
          )}

          {/* Recommended Countries */}
          {application.recommended_countries && application.recommended_countries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Globe size={15} className="text-brand-600" />
                Recommended Study Destinations
              </h3>
              <div className="flex flex-wrap gap-2">
                {application.recommended_countries.map((country: string, idx: number) => (
                  <span key={idx} className="badge bg-blue-100 text-blue-700 text-sm px-3 py-1.5">
                    {country}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Universities */}
          {application.recommended_universities && application.recommended_universities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <GraduationCap size={15} className="text-brand-600" />
                Recommended Universities
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {application.recommended_universities.map((university: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 bg-brand-600 rounded-full" />
                    <span className="text-gray-700">{university}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Counselor Recommendations */}
          {application.counselor_recommendations && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <CheckCircle size={15} className="text-brand-600" />
                Counselor's Recommendations
              </h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {application.counselor_recommendations}
                </p>
              </div>
            </div>
          )}

          {/* Assessment Notes (if no recommendations yet) */}
          {!application.counselor_recommendations && application.assessment_notes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Assessment Notes</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {application.assessment_notes}
                </p>
              </div>
            </div>
          )}

          {/* Completion Date */}
          {application.assessment_completed_at && (
            <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-200">
              <Calendar size={12} />
              <span>
                Assessment completed on {new Date(application.assessment_completed_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-brand-800 mb-2">Next Steps</h4>
            <ul className="space-y-1.5 text-sm text-brand-700">
              <li className="flex items-start gap-2">
                <span className="text-brand-600 mt-0.5">→</span>
                <span>Review your counselor's recommendations carefully</span>
              </li>
              {application.counselor_recommendations ? (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-brand-600 mt-0.5">→</span>
                    <span>Start selecting universities from the recommended list</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand-600 mt-0.5">→</span>
                    <span>Contact your counselor if you have any questions</span>
                  </li>
                </>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-brand-600 mt-0.5">→</span>
                  <span>Attend your scheduled counseling session to discuss options</span>
                </li>
              )}
            </ul>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <Link href="/dashboard/universities" className="btn-primary w-full text-center">
              View University Options
            </Link>
          </div>
        </div>
      )}

      {/* In Progress State */}
      {status === 'in_progress' && (
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Clock size={28} className="text-blue-600 animate-pulse" />
          </div>
          <p className="text-sm text-gray-600 mb-2">
            Your counselor is carefully reviewing:
          </p>
          <ul className="text-sm text-gray-500 space-y-1 max-w-xs mx-auto">
            <li>✓ Academic qualifications</li>
            <li>✓ Financial capability</li>
            <li>✓ English proficiency</li>
            <li>✓ Suitable study destinations</li>
          </ul>
          <p className="text-xs text-gray-400 mt-4">
            You'll receive a notification once the assessment is complete
          </p>
        </div>
      )}

      {/* Not Started State */}
      {status === 'not_started' && (
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <ClipboardCheck size={28} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">
            Your counselor will begin your assessment after your documents are verified.
          </p>
        </div>
      )}
    </div>
  )
}
