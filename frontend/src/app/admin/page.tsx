'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { STAGES, STAGE_COLORS } from '@/lib/constants'
import { Users, FileText, DollarSign, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import clsx from 'clsx'

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(res => {
        setStats(res.data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load dashboard stats.')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/50" />
        <p className="text-gray-400 text-sm">Loading dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-3">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary">Retry</button>
        </div>
      </div>
    )
  }

  const chartData = STAGES.map(s => ({
    name: s.label.split(' ')[0],
    fullName: s.label,
    count: stats?.stage_breakdown?.[s.key] || 0,
  }))

  const summaryCards = [
    { label: 'Total Students',      value: stats?.total_students ?? 0,     icon: Users,      color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Applications',  value: stats?.total_applications ?? 0, icon: FileText,   color: 'bg-purple-100 text-purple-600' },
    { label: 'Total Revenue',       value: `$${(stats?.total_revenue || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-green-100 text-green-600' },
    { label: 'Docs Pending Review', value: stats?.document_status?.under_review ?? 0, icon: TrendingUp, color: 'bg-orange-100 text-orange-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Aldanex Global Consult — Staff Portal</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <div key={card.label} className="card flex items-center gap-4">
            <div className={clsx('p-3 rounded-lg shrink-0', card.color)}>
              <card.icon size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Applications by stage chart */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Applications by Stage</h2>
        {chartData.every(d => d.count === 0) ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            No applications yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(value: any, _: any, props: any) => [value, props.payload.fullName]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={`hsl(${220 + index * 10}, 70%, ${55 + index * 2}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stage breakdown table */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Stage Breakdown</h2>
        <div className="space-y-2">
          {STAGES.map(stage => {
            const count = stats?.stage_breakdown?.[stage.key] || 0
            const total = stats?.total_applications || 1
            const pct = Math.round((count / total) * 100)
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <span className={clsx('badge text-xs w-44 justify-center shrink-0', STAGE_COLORS[stage.key])}>
                  {stage.label}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-medium w-6 text-right text-gray-600">{count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
