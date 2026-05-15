'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Bell, CheckCircle, AlertCircle, Info, AlertTriangle, RefreshCw, CheckCheck } from 'lucide-react'
import clsx from 'clsx'

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  info:            { color: 'text-blue-600',   bg: 'bg-blue-50',   icon: Info },
  success:         { color: 'text-green-600',  bg: 'bg-green-50',  icon: CheckCircle },
  warning:         { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle },
  action_required: { color: 'text-red-600',    bg: 'bg-red-50',    icon: AlertCircle },
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (err) { console.error(err) }
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) { console.error(err) }
  }

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-gray-500 mt-1">
            {unreadCount > 0
              ? <span className="text-brand-600 font-medium">{unreadCount} unread</span>
              : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary flex items-center gap-2 text-sm">
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx('text-sm px-4 py-1.5 rounded-lg font-medium transition-colors capitalize',
              filter === f ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {f} {f === 'unread' && unreadCount > 0 && `(${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Bell size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
            const Icon = cfg.icon
            return (
              <div key={n.id}
                className={clsx(
                  'card flex items-start gap-4 cursor-pointer hover:shadow-md transition-shadow',
                  !n.is_read && 'border-l-4 border-brand-400'
                )}
                onClick={() => !n.is_read && markRead(n.id)}
              >
                <div className={clsx('p-2.5 rounded-xl shrink-0', cfg.bg)}>
                  <Icon size={18} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={clsx('text-sm font-semibold', !n.is_read ? 'text-gray-900' : 'text-gray-600')}>
                      {n.title}
                    </p>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(n.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  {!n.is_read && (
                    <p className="text-xs text-brand-500 mt-1">Click to mark as read</p>
                  )}
                </div>
                {!n.is_read && (
                  <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
