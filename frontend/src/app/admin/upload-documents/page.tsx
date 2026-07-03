'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { Upload, CheckCircle, AlertCircle, FileText, X, Loader, Search, User } from 'lucide-react'

interface DocumentCategory {
  category: string
  label: string
  file: File | null
  uploading: boolean
  uploaded: boolean
}

interface Student {
  id: string
  full_name: string
  email: string
  student_id: string
  application_id: string
}

const DOCUMENT_CATEGORIES = [
  { category: 'identification', label: 'Passport / ID' },
  { category: 'academic', label: 'Academic Transcripts' },
  { category: 'academic', label: 'Degree/Diploma Certificate' },
  { category: 'english_proficiency', label: 'English Test Results (IELTS/TOEFL)' },
  { category: 'additional', label: 'CV/Resume' },
  { category: 'additional', label: 'Recommendation Letter' },
  { category: 'financial', label: 'Financial Documents' },
  { category: 'additional', label: 'Personal Statement' },
  { category: 'additional', label: 'Other Documents' },
]

export default function UploadDocumentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialStudentId = searchParams.get('student')
  const initialApplicationId = searchParams.get('application')
  
  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [studentInfo, setStudentInfo] = useState<any>(null)
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '')
  const [selectedApplicationId, setSelectedApplicationId] = useState(initialApplicationId || '')
  const [showStudentSelector, setShowStudentSelector] = useState(!initialStudentId)
  const [currentPage, setCurrentPage] = useState(1)
  const [studentsPerPage] = useState(10)
  const [documents, setDocuments] = useState<DocumentCategory[]>(
    DOCUMENT_CATEGORIES.map(cat => ({
      ...cat,
      file: null,
      uploading: false,
      uploaded: false,
    }))
  )

  useEffect(() => {
    loadAllStudents()
  }, [])

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentInfo()
      setShowStudentSelector(false)
    } else {
      setLoading(false)
    }
  }, [selectedStudentId])

  async function loadAllStudents() {
    try {
      setLoadingStudents(true)
      console.log('Fetching all students...')
      
      // Fetch all applications which include student profiles
      const response = await api.get('/applications')
      
      console.log('API Response:', response.data)
      console.log('Total applications:', response.data?.length)
      
      // Extract students from applications
      const studentsMap = new Map<string, Student>()
      
      if (Array.isArray(response.data)) {
        response.data.forEach((app: any, index: number) => {
          console.log(`Processing app ${index}:`, {
            student_id: app.student_id,
            has_student: !!app.student,
            student_name: app.student?.full_name,
            student_email: app.student?.email
          })
          
          if (app.student_id && app.student) {
            // Get student info from the 'student' field (not 'profiles')
            const studentData: Student = {
              id: app.student_id,
              full_name: app.student.full_name || 'Unknown Student',
              email: app.student.email || '',
              student_id: app.student.student_id || app.student_id.substring(0, 8),
              application_id: app.id,
            }
            
            console.log('Adding student:', studentData)
            
            // Only add if not already in map (avoid duplicates)
            if (!studentsMap.has(app.student_id)) {
              studentsMap.set(app.student_id, studentData)
            }
          } else {
            console.warn('App missing student data:', {
              app_id: app.id,
              student_id: app.student_id,
              has_student: !!app.student
            })
          }
        })
      }
      
      const studentsList = Array.from(studentsMap.values())
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
      
      console.log('Final students list:', studentsList.length, studentsList)
      
      if (studentsList.length === 0) {
        console.error('No students loaded! Check if applications have student profiles populated.')
        setError('No students found in applications.')
      }
      
      setAllStudents(studentsList)
      setLoadingStudents(false)
    } catch (err: any) {
      console.error('Failed to load students:', err)
      console.error('Error details:', err.response?.data)
      setError(`Failed to load students: ${err.message}`)
      setLoadingStudents(false)
    }
  }

  async function loadStudentInfo() {
    try {
      setLoading(true)
      const response = await api.get(`/admin/students/${selectedStudentId}`)
      setStudentInfo(response.data)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load student info:', err)
      setError('Failed to load student information')
      setLoading(false)
    }
  }

  function handleSelectStudent(student: Student) {
    setSelectedStudentId(student.id)
    setSelectedApplicationId(student.application_id)
    setShowStudentSelector(false)
    setError('')
    // Reset documents
    setDocuments(DOCUMENT_CATEGORIES.map(cat => ({
      ...cat,
      file: null,
      uploading: false,
      uploaded: false,
    })))
  }

  function handleChangeStudent() {
    setShowStudentSelector(true)
    setStudentInfo(null)
    setSelectedStudentId('')
    setSelectedApplicationId('')
    setDocuments(DOCUMENT_CATEGORIES.map(cat => ({
      ...cat,
      file: null,
      uploading: false,
      uploaded: false,
    })))
  }

  const filteredStudents = allStudents.filter(student => {
    const searchLower = studentSearch.toLowerCase().trim()
    if (!searchLower) return true // Show all if no search term
    
    // Search in multiple fields
    const nameMatch = student.full_name?.toLowerCase().includes(searchLower)
    const emailMatch = student.email?.toLowerCase().includes(searchLower)
    const idMatch = student.student_id?.toLowerCase().includes(searchLower)
    const partialMatch = student.full_name?.toLowerCase().split(' ').some(part => 
      part.startsWith(searchLower)
    )
    
    return nameMatch || emailMatch || idMatch || partialMatch
  })

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage)
  const indexOfLastStudent = currentPage * studentsPerPage
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage
  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent)

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [studentSearch])

  function handleFileSelect(category: string, file: File | null) {
    setDocuments(prev => prev.map(doc => 
      doc.category === category ? { ...doc, file } : doc
    ))
    setError('')
    setSuccess('')
  }

  async function handleUploadDocument(category: string) {
    const doc = documents.find(d => d.category === category)
    if (!doc || !doc.file) return

    // Mark as uploading
    setDocuments(prev => prev.map(d => 
      d.category === category ? { ...d, uploading: true } : d
    ))
    setError('')

    try {
      // 1. Get signed upload URL
      const urlRes = await api.post('/documents/upload-url', {
        file_name: doc.file.name,
        file_type: doc.file.type,
        category: doc.category,
        application_id: selectedApplicationId,
      })

      // 2. Upload file to Supabase Storage
      const uploadRes = await fetch(urlRes.data.upload_url, {
        method: 'PUT',
        body: doc.file,
        headers: { 'Content-Type': doc.file.type },
      })

      if (!uploadRes.ok) {
        throw new Error('Upload to storage failed')
      }

      // 3. Create document record in database
      const docResponse = await api.post('/documents', {
        application_id: selectedApplicationId,
        student_id: selectedStudentId, // Pass the student ID
        document_name: doc.label,
        category: doc.category,
        file_path: urlRes.data.file_path,
        file_type: doc.file.type,
        file_size_kb: Math.round(doc.file.size / 1024),
        status: 'uploaded',
      })

      console.log('Document record created:', docResponse.data)

      // Mark as uploaded
      setDocuments(prev => prev.map(d => 
        d.category === category 
          ? { ...d, uploading: false, uploaded: true } 
          : d
      ))

      setSuccess(`✓ ${doc.label} uploaded successfully and saved to database!`)
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000)
    } catch (err: any) {
      console.error('Upload failed:', err)
      setError(`Failed to upload ${doc.label}. Please try again.`)
      
      // Reset uploading state
      setDocuments(prev => prev.map(d => 
        d.category === category ? { ...d, uploading: false } : d
      ))
    }
  }

  async function handleUploadAll() {
    const docsWithFiles = documents.filter(d => d.file && !d.uploaded)
    
    if (docsWithFiles.length === 0) {
      setError('No documents selected to upload')
      return
    }

    setError('')
    setSuccess('')

    // Upload each document sequentially
    for (const doc of docsWithFiles) {
      await handleUploadDocument(doc.category)
    }

    setSuccess(`✓ Successfully uploaded ${docsWithFiles.length} document(s) and saved to database!`)
  }

  function handleRemoveFile(category: string) {
    setDocuments(prev => prev.map(doc => 
      doc.category === category ? { ...doc, file: null, uploaded: false } : doc
    ))
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <Loader className="animate-spin mx-auto mb-4" size={32} />
        <p className="text-gray-500">Loading student information...</p>
      </div>
    )
  }

  // Show student selector if no student is selected
  if (showStudentSelector || !selectedStudentId) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Upload Documents</h1>
          <p className="text-gray-500 mt-1">
            Select a student to upload documents for
          </p>
        </div>

        {/* Debug Info */}
        {!loadingStudents && allStudents.length === 0 && (
          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">No Students Loaded</p>
                <p className="text-sm text-yellow-700 mt-1">
                  No students could be loaded from the system. Please check:
                </p>
                <ul className="text-sm text-yellow-700 mt-2 ml-4 list-disc space-y-1">
                  <li>Students have been created in the system</li>
                  <li>Students have active applications</li>
                  <li>Backend is running and accessible</li>
                  <li>Check browser console for detailed error logs</li>
                </ul>
                <button
                  onClick={loadAllStudents}
                  className="btn-secondary text-sm mt-3"
                >
                  Retry Loading Students
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, email, or student ID..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="input pl-10"
                disabled={loadingStudents || allStudents.length === 0}
              />
            </div>
            {studentSearch && (
              <button
                onClick={() => setStudentSearch('')}
                className="btn-secondary"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {loadingStudents ? (
              'Loading students...'
            ) : allStudents.length === 0 ? (
              'No students available to search'
            ) : (
              <>
                {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} found
                {studentSearch && ` matching "${studentSearch}"`}
                {' '}(out of {allStudents.length} total)
              </>
            )}
          </p>
        </div>

        {/* Students List */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {studentSearch ? 'Search Results' : 'All Students'}
            </h3>
            {!loadingStudents && allStudents.length > 0 && (
              <span className="text-sm text-gray-500">
                Total: {allStudents.length} student{allStudents.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {loadingStudents ? (
            <div className="text-center py-8">
              <Loader className="animate-spin mx-auto mb-3" size={32} />
              <p className="text-gray-500">Loading students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <User size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-2">
                {studentSearch 
                  ? `No students found matching "${studentSearch}"` 
                  : 'No students available'}
              </p>
              {studentSearch && (
                <p className="text-sm text-gray-400">
                  Try searching by full name, email, or student ID
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {currentStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-brand-400 hover:bg-brand-50 transition-colors text-left flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                      <User size={24} className="text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900">{student.full_name}</h4>
                      <p className="text-sm text-gray-600 truncate">{student.email}</p>
                      {student.student_id && (
                        <p className="text-xs text-gray-500 mt-0.5">ID: {student.student_id}</p>
                      )}
                    </div>
                    <CheckCircle size={20} className="text-gray-300" />
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-gray-600">
                    Showing {indexOfFirstStudent + 1} to {Math.min(indexOfLastStudent, filteredStudents.length)} of {filteredStudents.length} students
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {[...Array(totalPages)].map((_, idx) => {
                        const page = idx + 1
                        // Show first, last, current, and adjacent pages
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 border rounded-lg text-sm ${
                                currentPage === page
                                  ? 'bg-brand-600 text-white border-brand-600'
                                  : 'border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          )
                        } else if (
                          page === currentPage - 2 ||
                          page === currentPage + 2
                        ) {
                          return <span key={page} className="px-2 text-gray-400">...</span>
                        }
                        return null
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card bg-gray-50">
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/admin/add-student')}
              className="btn-primary"
            >
              Add New Student
            </button>
            <button
              onClick={() => router.push('/admin/documents')}
              className="btn-secondary"
            >
              Go to Documents
            </button>
          </div>
        </div>
      </div>
    )
  }

  const uploadedCount = documents.filter(d => d.uploaded).length
  const totalWithFiles = documents.filter(d => d.file).length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Upload Documents</h1>
        <p className="text-gray-500 mt-1">
          Upload documents on behalf of the student
        </p>
      </div>

      {/* Student Info Card */}
      {studentInfo && (
        <div className="card bg-gradient-to-r from-brand-50 to-blue-50 border-brand-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                <User size={28} className="text-brand-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Uploading documents for:</p>
                <h2 className="text-xl font-bold text-gray-900">{studentInfo.profile?.full_name}</h2>
                <p className="text-sm text-gray-600 mt-0.5">{studentInfo.profile?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Documents uploaded</p>
                <p className="text-3xl font-bold text-brand-600">{uploadedCount}</p>
              </div>
              <button
                onClick={handleChangeStudent}
                className="btn-secondary text-sm"
              >
                Change Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-start gap-3 animate-pulse">
          <CheckCircle size={24} className="text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-800 font-semibold">{success}</p>
            <p className="text-xs text-green-700 mt-1">
              You can continue uploading more documents or navigate away.
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Actions */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Document Categories</h3>
            <p className="text-sm text-gray-500 mt-1">
              Select files for each category and upload
            </p>
          </div>
          {totalWithFiles > 0 && (
            <button
              onClick={handleUploadAll}
              disabled={documents.some(d => d.uploading)}
              className="btn-primary disabled:opacity-50"
            >
              {documents.some(d => d.uploading) ? 'Uploading...' : `Upload All (${totalWithFiles})`}
            </button>
          )}
        </div>

        {/* Document List */}
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.category}
              className={`p-4 border-2 rounded-lg transition-all ${
                doc.uploaded
                  ? 'border-green-200 bg-green-50'
                  : doc.file
                  ? 'border-brand-200 bg-brand-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                  doc.uploaded
                    ? 'bg-green-100'
                    : doc.file
                    ? 'bg-brand-100'
                    : 'bg-gray-100'
                }`}>
                  {doc.uploaded ? (
                    <CheckCircle size={24} className="text-green-600" />
                  ) : doc.uploading ? (
                    <Loader size={24} className="text-brand-600 animate-spin" />
                  ) : (
                    <FileText size={24} className={doc.file ? 'text-brand-600' : 'text-gray-400'} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900">{doc.label}</h4>
                  {doc.file && (
                    <p className="text-sm text-gray-600 truncate mt-0.5">
                      {doc.file.name} ({(doc.file.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                  {!doc.file && (
                    <p className="text-sm text-gray-500 mt-0.5">No file selected</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {doc.uploaded ? (
                    <span className="text-sm font-medium text-green-600">Uploaded</span>
                  ) : doc.uploading ? (
                    <span className="text-sm font-medium text-brand-600">Uploading...</span>
                  ) : (
                    <>
                      {doc.file && (
                        <>
                          <button
                            onClick={() => handleUploadDocument(doc.category)}
                            className="btn-primary text-sm px-4"
                            disabled={doc.uploading}
                          >
                            Upload
                          </button>
                          <button
                            onClick={() => handleRemoveFile(doc.category)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove file"
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => handleFileSelect(doc.category, e.target.files?.[0] || null)}
                        className="hidden"
                        id={`file-${doc.category}`}
                      />
                      <label
                        htmlFor={`file-${doc.category}`}
                        className="btn-secondary text-sm px-4 cursor-pointer"
                      >
                        {doc.file ? 'Change' : 'Choose File'}
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="card bg-gray-50">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <p className="text-sm text-gray-600">
            {uploadedCount > 0 
              ? `${uploadedCount} document(s) uploaded successfully` 
              : 'No documents uploaded yet'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/admin/add-student')}
              className="btn-secondary"
            >
              Add Another Student
            </button>
            <button
              onClick={() => router.push('/admin/documents')}
              className="btn-secondary"
            >
              View All Documents
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
