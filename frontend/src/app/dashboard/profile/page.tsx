'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'
import { Save, User, BookOpen, Globe, Briefcase, CheckCircle } from 'lucide-react'

const QUALIFICATION_LEVELS = ['High School', 'Diploma', 'Bachelor', 'Master', 'PhD', 'Other']
const ENGLISH_TESTS = ['IELTS', 'TOEFL', 'PTE', 'Duolingo', 'Cambridge', 'None']
const SPONSORSHIP_TYPES = ['Self-funded', 'Family', 'Government', 'Scholarship', 'Employer']
const DESTINATIONS = ['United Kingdom', 'United States', 'Canada', 'Australia', 'Germany', 'Netherlands', 'Ireland', 'New Zealand', 'Other']
const INTAKES = ['January', 'May', 'September', ]

export default function ProfilePage() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [completionPct, setCompletionPct] = useState(0)

  // All form fields — registration fields + extended profile fields
  const [form, setForm] = useState({
    // Registration fields (all editable except email)
    full_name: '',
    email: '',           // read-only
    phone: '',
    nationality: '',
    preferred_study_destination: '',
    // Personal details
    date_of_birth: '',
    gender: '',
    address: '',
    city: '',
    country: '',
    // Passport
    passport_number: '',
    passport_expiry: '',
    passport_country: '',
    // Education
    highest_qualification: '',
    qualification_level: '',
    institution_attended: '',
    graduation_year: '',
    gpa: '',
    english_test_type: '',
    english_test_score: '',
    english_test_date: '',
    // Study preferences
    preferred_course: '',
    preferred_intake: '',
    budget_range: '',
    sponsorship_type: '',
    employment_background: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const uid = session.user.id
      setUserId(uid)

      // ── Step 1: Fill from session immediately (always works, no DB needed) ──
      const meta = session.user.user_metadata || {}
      setForm(prev => ({
        ...prev,
        full_name:                    meta.full_name                    || '',
        email:                        session.user.email                || '',
        phone:                        meta.phone                        || '',
        nationality:                  meta.nationality                  || '',
        preferred_study_destination:  meta.preferred_study_destination  || '',
      }))

      // ── Step 2: Load full profile from DB (overwrites with latest saved data) ──
      const { data: p } = await supabase
        .from('profiles')
        .select('*, student_profile:student_profiles(*)')
        .eq('id', uid)
        .single()

      if (p) {
        setStudentId(p.student_id || '')
        const sp = p.student_profile || {}

        setForm({
          // Registration fields — use DB value, fall back to session metadata
          full_name:                   p.full_name                   || meta.full_name                   || '',
          email:                       p.email                       || session.user.email               || '',
          phone:                       p.phone                       || meta.phone                       || '',
          nationality:                 p.nationality                 || meta.nationality                 || '',
          preferred_study_destination: p.preferred_study_destination || meta.preferred_study_destination || '',
          // Personal details
          date_of_birth:        sp.date_of_birth        || '',
          gender:               sp.gender               || '',
          address:              sp.address              || '',
          city:                 sp.city                 || '',
          country:              sp.country              || '',
          // Passport
          passport_number:      sp.passport_number      || '',
          passport_expiry:      sp.passport_expiry      || '',
          passport_country:     sp.passport_country     || '',
          // Education
          highest_qualification: sp.highest_qualification || '',
          qualification_level:   sp.qualification_level   || '',
          institution_attended:  sp.institution_attended  || '',
          graduation_year:       sp.graduation_year       || '',
          gpa:                   sp.gpa                   || '',
          english_test_type:     sp.english_test_type     || '',
          english_test_score:    sp.english_test_score    || '',
          english_test_date:     sp.english_test_date     || '',
          // Study preferences
          preferred_course:      sp.preferred_course      || '',
          preferred_intake:      sp.preferred_intake      || '',
          budget_range:          sp.budget_range          || '',
          sponsorship_type:      sp.sponsorship_type      || '',
          employment_background: sp.employment_background || '',
        })

        setCompletionPct(sp.profile_completion_pct || 0)
      }

      setLoading(false)
    }
    load()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    if (name === 'email') return // email is read-only
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setSaveError('')

    try {
      const {
        full_name, email, phone, nationality, preferred_study_destination,
        ...studentProfileFields
      } = form

      // Update profiles table (name, phone, nationality, destination)
      await supabase
        .from('profiles')
        .update({ full_name, phone, nationality, preferred_study_destination })
        .eq('id', userId)

      // Update student_profiles table (all other fields)
      await api.put(`/students/${userId}/profile`, studentProfileFields)

      // Refresh completion %
      const { data: sp } = await supabase
        .from('student_profiles')
        .select('profile_completion_pct')
        .eq('user_id', userId)
        .single()

      if (sp) setCompletionPct(sp.profile_completion_pct || 0)

      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (err: any) {
      setSaveError('Failed to save. Please try again.')
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
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
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-gray-500 mt-1">
            Student ID:{' '}
            <span className="font-semibold text-brand-600">{studentId || '—'}</span>
          </p>
        </div>
        <div className="card py-3 px-4 min-w-[200px]">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Profile Completion</span>
            <span className="font-semibold text-brand-600">{completionPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-brand-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Account Information ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <User size={18} className="text-brand-600" />
            <h2 className="text-lg font-semibold">Account Information</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Full Name — editable */}
            <div>
              <label className="label">Full Name</label>
              <input
                name="full_name"
                type="text"
                className="input"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Your full name"
              />
            </div>

            {/* Email — read-only, clearly marked */}
            <div>
              <label className="label">
                Email Address
                <span className="ml-2 text-xs text-gray-400 font-normal">(cannot be changed)</span>
              </label>
              <input
                name="email"
                type="email"
                className="input bg-gray-50 text-gray-500 cursor-not-allowed select-none"
                value={form.email}
                readOnly
                tabIndex={-1}
              />
            </div>

            {/* Phone — pre-filled from registration, editable */}
            <div>
              <label className="label">Phone Number</label>
              <input
                name="phone"
                type="tel"
                className="input"
                value={form.phone}
                onChange={handleChange}
                placeholder="+254712345678"
              />
            </div>

            {/* Nationality — pre-filled from registration, editable */}
            <div>
              <label className="label">Nationality</label>
              <input
                name="nationality"
                type="text"
                className="input"
                value={form.nationality}
                onChange={handleChange}
                placeholder="e.g. Kenyan"
              />
            </div>

            {/* Preferred Study Destination — pre-filled from registration, editable */}
            <div className="sm:col-span-2">
              <label className="label">Preferred Study Destination</label>
              <select
                name="preferred_study_destination"
                className="input"
                value={form.preferred_study_destination}
                onChange={handleChange}
              >
                <option value="">Select country</option>
                {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Personal Details ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <User size={18} className="text-brand-600" />
            <h2 className="text-lg font-semibold">Personal Details</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Date of Birth</label>
              <input name="date_of_birth" type="date" className="input"
                value={form.date_of_birth} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Gender</label>
              <select name="gender" className="input" value={form.gender} onChange={handleChange}>
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Prefer not to say</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Street Address</label>
              <input name="address" type="text" className="input"
                value={form.address} onChange={handleChange} placeholder="Street address" />
            </div>
            <div>
              <label className="label">City</label>
              <input name="city" type="text" className="input"
                value={form.city} onChange={handleChange} placeholder="City" />
            </div>
            <div>
              <label className="label">Country of Residence</label>
              <input name="country" type="text" className="input"
                value={form.country} onChange={handleChange} placeholder="e.g. Kenya" />
            </div>
          </div>
        </div>

        {/* ── Passport ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Globe size={18} className="text-brand-600" />
            <h2 className="text-lg font-semibold">Passport Information</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Passport Number</label>
              <input name="passport_number" type="text" className="input"
                value={form.passport_number} onChange={handleChange} placeholder="A12345678" />
            </div>
            <div>
              <label className="label">Expiry Date</label>
              <input name="passport_expiry" type="date" className="input"
                value={form.passport_expiry} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Issuing Country</label>
              <input name="passport_country" type="text" className="input"
                value={form.passport_country} onChange={handleChange} placeholder="e.g. Kenya" />
            </div>
          </div>
        </div>

        {/* ── Education ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <BookOpen size={18} className="text-brand-600" />
            <h2 className="text-lg font-semibold">Educational Background</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Highest Qualification</label>
              <input name="highest_qualification" type="text" className="input"
                value={form.highest_qualification} onChange={handleChange}
                placeholder="e.g. Bachelor of Science in IT" />
            </div>
            <div>
              <label className="label">Qualification Level</label>
              <select name="qualification_level" className="input"
                value={form.qualification_level} onChange={handleChange}>
                <option value="">Select level</option>
                {QUALIFICATION_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Institution Attended</label>
              <input name="institution_attended" type="text" className="input"
                value={form.institution_attended} onChange={handleChange}
                placeholder="University / College name" />
            </div>
            <div>
              <label className="label">Graduation Year</label>
              <input name="graduation_year" type="number" className="input"
                value={form.graduation_year} onChange={handleChange}
                placeholder="e.g. 2022" min="1990" max="2030" />
            </div>
            <div>
              <label className="label">GPA / Grade</label>
              <input name="gpa" type="text" className="input"
                value={form.gpa} onChange={handleChange}
                placeholder="e.g. 3.8 or Upper Second Class" />
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">English Proficiency Test</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Test Type</label>
                <select name="english_test_type" className="input"
                  value={form.english_test_type} onChange={handleChange}>
                  <option value="">Select test</option>
                  {ENGLISH_TESTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Score / Band</label>
                <input name="english_test_score" type="text" className="input"
                  value={form.english_test_score} onChange={handleChange} placeholder="e.g. 7.0" />
              </div>
              <div>
                <label className="label">Test Date</label>
                <input name="english_test_date" type="date" className="input"
                  value={form.english_test_date} onChange={handleChange} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Study Preferences ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Briefcase size={18} className="text-brand-600" />
            <h2 className="text-lg font-semibold">Study Preferences & Funding</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Preferred Course / Programme</label>
              <input name="preferred_course" type="text" className="input"
                value={form.preferred_course} onChange={handleChange}
                placeholder="e.g. MSc Computer Science" />
            </div>
            <div>
              <label className="label">Preferred Intake</label>
              <select name="preferred_intake" className="input"
                value={form.preferred_intake} onChange={handleChange}>
                <option value="">Select intake</option>
                {INTAKES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Budget Range (USD / year)</label>
              <select name="budget_range" className="input"
                value={form.budget_range} onChange={handleChange}>
                <option value="">Select range</option>
                <option>Under $10,000</option>
                <option>$10,000 – $20,000</option>
                <option>$20,000 – $35,000</option>
                <option>$35,000 – $50,000</option>
                <option>Over $50,000</option>
              </select>
            </div>
            <div>
              <label className="label">Sponsorship Type</label>
              <select name="sponsorship_type" className="input"
                value={form.sponsorship_type} onChange={handleChange}>
                <option value="">Select type</option>
                {SPONSORSHIP_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Employment Background</label>
              <textarea name="employment_background" className="input" rows={3}
                value={form.employment_background} onChange={handleChange}
                placeholder="Briefly describe your work experience (if any)" />
            </div>
          </div>
        </div>

        {/* ── Save ── */}
        <div className="flex items-center gap-4 pb-6">
          <button type="submit" className="btn-primary flex items-center gap-2 px-6" disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
              <CheckCircle size={16} /> Profile saved successfully
            </span>
          )}
          {saveError && (
            <span className="text-red-500 text-sm">{saveError}</span>
          )}
        </div>
      </form>
    </div>
  )
}
