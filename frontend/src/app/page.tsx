import Link from 'next/link'
import Logo from '@/components/Logo'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="lg" />
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="text-sm font-medium text-gray-600 hover:text-brand-700 transition-colors px-3 py-2">
              Sign In
            </Link>
            <Link href="/register" className="btn-accent text-sm px-5 py-2">
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 rounded-full bg-accent-500 blur-3xl" />
          <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full bg-brand-400 blur-2xl" />
        </div>

        <div className="max-w-6xl mx-auto relative">
          <div className="max-w-2xl">
            {/* <div className="inline-flex items-center gap-2 bg-accent-500/20 border border-accent-400/30 text-accent-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
              Student Recruitment & Admission Portal
            </div> */}
            <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6">
              Transforming Education
              <span className="text-accent-400"> Through</span>
              <br />Technology
            </h1>
            <p className="text-brand-200 text-lg leading-relaxed mb-8 max-w-xl">
              Aldanex Global Consult guides students through every step of their international education journey — from application to enrollment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register"
                className="btn-accent px-8 py-3.5 text-base font-semibold rounded-xl text-center">
                Start Your Application
              </Link>
              <Link href="/login"
                className="border-2 border-white/30 text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-white/10 transition-colors text-center">
                Sign In to Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-brand-800 py-10 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: '2,400+', label: 'Students Placed' },
            { value: '150+',   label: 'Partner Universities' },
            { value: '25+',    label: 'Countries' },
            { value: '94%',    label: 'Visa Success Rate' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-accent-400">{stat.value}</p>
              <p className="text-brand-300 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-brand-900">Your Journey, Simplified</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Our 12-stage tracking system keeps you informed at every step of your application.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Register & Profile',    desc: 'Create your account and complete your student profile with academic and personal details.' },
              { step: '02', title: 'Document Upload',       desc: 'Upload your academic certificates, passport, financial documents and more.' },
              { step: '03', title: 'University Selection',  desc: 'Work with your counselor to select the best universities and courses for your goals.' },
              { step: '04', title: 'Visa & Enrollment',     desc: 'We guide you through visa applications, pre-departure prep, and enrollment confirmation.' },
            ].map(item => (
              <div key={item.step} className="card group hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-4 group-hover:bg-accent-500 transition-colors">
                  <span className="text-brand-600 font-bold text-sm group-hover:text-white transition-colors">{item.step}</span>
                </div>
                <h3 className="font-semibold text-brand-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-brand-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-accent-500 opacity-90 skew-x-[-8deg] translate-x-16 hidden lg:block" />
        <div className="max-w-6xl mx-auto relative">
          <div className="max-w-xl">
            <h2 className="text-4xl font-bold text-white mb-4">
              You can be your own<br />
              <span className="text-accent-400">Guiding Star</span> with our help
            </h2>
            <p className="text-brand-200 mb-8">
              Join thousands of students who have successfully secured placements at top universities worldwide.
            </p>
            <Link href="/register" className="btn-accent px-8 py-3.5 text-base font-semibold rounded-xl inline-block">
              Get Started Today
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-950 text-brand-300 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="md" />
          <p className="text-sm text-brand-500">
            © {new Date().getFullYear()} Aldanex Global Consult. All rights reserved.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-white transition-colors">Apply</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
