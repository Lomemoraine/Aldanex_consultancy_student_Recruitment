export const STAGES = [
  { key: 'registered',              label: 'Registered',                  step: 1  },
  { key: 'profile_completion',      label: 'Profile Completion',           step: 2  },
  { key: 'document_upload',         label: 'Document Upload',              step: 3  },
  { key: 'initial_assessment',      label: 'Initial Assessment',           step: 4  },
  { key: 'counseling',              label: 'Counseling & Career Guidance', step: 5  },
  { key: 'university_selection',    label: 'University Selection',         step: 6  },
  { key: 'application_submission',  label: 'Application Submission',       step: 7  },
  { key: 'offer_letter',            label: 'Offer Letter',                 step: 8  },
  { key: 'tuition_deposit',         label: 'Tuition Deposit & CAS/I-20',  step: 9  },
  { key: 'visa_application',        label: 'Visa Application',             step: 10 },
  { key: 'pre_departure',           label: 'Pre-Departure Preparation',    step: 11 },
  { key: 'enrolled',                label: 'Enrolled',                     step: 12 },
]

export const STAGE_COLORS: Record<string, string> = {
  registered:             'bg-gray-100 text-gray-700',
  profile_completion:     'bg-blue-100 text-blue-700',
  document_upload:        'bg-yellow-100 text-yellow-700',
  initial_assessment:     'bg-purple-100 text-purple-700',
  counseling:             'bg-indigo-100 text-indigo-700',
  university_selection:   'bg-cyan-100 text-cyan-700',
  application_submission: 'bg-orange-100 text-orange-700',
  offer_letter:           'bg-pink-100 text-pink-700',
  tuition_deposit:        'bg-emerald-100 text-emerald-700',
  visa_application:       'bg-red-100 text-red-700',
  pre_departure:          'bg-teal-100 text-teal-700',
  enrolled:               'bg-green-100 text-green-700',
}

export const DOCUMENT_CATEGORIES = [
  { key: 'academic',            label: 'Academic Documents' },
  { key: 'identification',      label: 'Identification' },
  { key: 'english_proficiency', label: 'English Proficiency' },
  { key: 'financial',           label: 'Financial Documents' },
  { key: 'additional',          label: 'Additional Documents' },
  { key: 'visa',                label: 'Visa Documents' },
  { key: 'travel',              label: 'Travel Documents' },
]

export const REQUIRED_DOCUMENTS = {
  academic: [
    'Degree Certificate',
    'Academic Transcripts',
    'Secondary School Certificate',
  ],
  identification: [
    'Passport (Bio-data page)',
    'National ID Card',
    'Passport Photograph',
  ],
  english_proficiency: [
    'IELTS Score Report',
    'TOEFL Score Report',
    'PTE Score Report',
    'Duolingo Score Report',
  ],
  financial: [
    'Bank Statement (6 months)',
    'Sponsorship Letter',
    'Scholarship Award Letter',
  ],
  additional: [
    'CV / Resume',
    'Personal Statement / SOP',
    'Reference Letters',
    'Work Experience Letter',
  ],
}
