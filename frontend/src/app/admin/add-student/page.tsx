'use client'

import { useState } from 'react'
import api from '@/lib/api'
import { Upload, CheckCircle, AlertCircle, ChevronRight, User } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AddStudentPage() {
  const router = useRouter()
  
  // Step 1: Student account creation
  const [step, setStep] = useState<'account' | 'documents' | 'success'>('account')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Student form data
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    nationality: '',
    current_country: '',
    education_level: '',
    field_of_interest: '',
    password: '',
    preferred_study_destination: '',
  })
  
  // Created student data
  const [createdStudent, setCreatedStudent] = useState<any>(null)

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  // Step 1: Create student account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.full_name || !formData.email || !formData.password) {
        throw new Error('Please fill in all required fields')
      }

      console.log('Creating student with data:', {
        ...formData,
        password: '***hidden***'
      })

      // Create student account through backend
      const response = await api.post('/admin/create-student', formData)
      
      console.log('Student created successfully:', response.data)
      setCreatedStudent(response.data.student)
      setStep('documents')
    } catch (err: any) {
      console.error('Failed to create student:', err)
      console.error('Error response:', err.response?.data)
      console.error('Error status:', err.response?.status)
      
      let errorMessage = 'Failed to create student account'
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please check the backend logs.'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Reset and add another student
  const handleAddAnother = () => {
    setStep('account')
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      nationality: '',
      current_country: '',
      education_level: '',
      field_of_interest: '',
      password: '',
      preferred_study_destination: '',
    })
    setCreatedStudent(null)
    setError('')
  }

  const destinations = [
    'United Kingdom', 'United States', 'Canada', 'Australia',
    'Germany', 'Netherlands', 'Ireland', 'New Zealand', 'Other',
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Add New Student</h1>
        <p className="text-gray-500 mt-1">
          Create a student account and upload their documents
        </p>
      </div>

      {/* Progress indicator */}
      {step === 'account' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Step 1:</strong> Add student information to create their account
          </p>
        </div>
      )}

      {step === 'documents' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Step 2 of 3:</strong> Upload documents
          </p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 font-medium">Error</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Step 1: Create Account */}
      {step === 'account' && (
        <form onSubmit={handleCreateAccount} className="card space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Student Information</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter the student's details to create their account
            </p>
          </div>

          <div className="space-y-4">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="label">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="+254712345678"
                />
              </div>
            </div>

            {/* Email - full width */}
            <div>
              <label className="label">Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="input"
                placeholder="student@example.com"
                required
              />
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nationality *</label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="e.g. Kenyan"
                  required
                />
              </div>

              <div>
                <label className="label">Preferred Study Destination</label>
                <select
                  name="preferred_study_destination"
                  value={formData.preferred_study_destination}
                  onChange={handleInputChange}
                  className="input"
                >
                  <option value="">Select country</option>
                  {destinations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

           
            {/* Row 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Education Level</label>
                <input
                  type="text"
                  name="education_level"
                  value={formData.education_level}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Bachelor's Degree"
                />
              </div>

              <div>
                <label className="label">preferred_course</label>
                <input
                  type="text"
                  name="preferred_course"
                  value={formData.field_of_interest}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Computer Science"
                />
              </div>
            </div>
             {/* Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  className="input"
                />
              </div>

              {/* <div>
                <label className="label">Current Country</label>
                <input
                  type="text"
                  name="current_country"
                  value={formData.current_country}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Kenya"
                />
              </div> */}
            </div>


            {/* Password */}
            <div>
              <label className="label">Initial Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="input"
                placeholder="Minimum 6 characters"
                required
                minLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">
                Student can change this password after first login
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
            
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary w-full"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Next step:</strong> After creating the account, you'll have the option to upload documents for this student.
            </p>
          </div>
        </form>
      )}

      {/* Step 2: Success with Options */}
      {step === 'documents' && createdStudent && (
        <div className="space-y-6">
          {/* Success Message */}
          <div className="card">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle size={24} className="text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-800 font-semibold">
                  Student account created successfully!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  <strong>{createdStudent.full_name}</strong> can now log in with: <strong>{createdStudent.email}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Next Steps Options */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">What would you like to do next?</h2>
            
            <div className="space-y-3">
              {/* Primary Action - Upload Documents */}
              <button
                onClick={() => router.push(`/admin/upload-documents?student=${createdStudent.id}&application=${createdStudent.application_id}`)}
                className="w-full p-5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-4"
              >
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-sm">
                  <Upload size={28} className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-bold text-lg">Upload Documents</h3>
                  <p className="text-sm text-white/90 mt-0.5">
                    Upload {createdStudent.full_name.split(' ')[0]}'s documents now (passport, transcripts, certificates)
                  </p>
                </div>
                <ChevronRight size={24} className="text-white/80" />
              </button>

              {/* Secondary Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <button
                  onClick={handleAddAnother}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <User size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Add Another Student</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Create another account
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => router.push(`/admin/applications/${createdStudent.application_id}`)}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <CheckCircle size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">View Profile</h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      See application details
                    </p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => router.push('/admin/students')}
                className="w-full p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors text-center text-sm text-gray-600 hover:text-gray-900"
              >
                Go to Students List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
