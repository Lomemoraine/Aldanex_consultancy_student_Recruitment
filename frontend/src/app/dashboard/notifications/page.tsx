'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Bell, CheckCircle, AlertCircle, Info, AlertTriangle, CheckCheck, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

const TYPE_CONFIG: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  info:            { color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: Info },
  success:         { color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  icon: CheckCircle },
  warning:         { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle },
  action_required: { color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    icon: AlertCircle },
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data || [])
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
    } catch (err) {
      console.error('Failed to mark read:', err)
    }
  }

  async function markAllRead() {
    setMarkingAll(true)
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Failed to mark all read:', err)
    } finally {
      setMarkingAll(false)
    }
  }

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-gray-500 mt-1 text-sm">
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
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <CheckCheck size={14} />
              {markingAll ? 'Marking...' : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'text-sm px-4 py-1.5 rounded-lg font-medium transition-colors capitalize',
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f} {f === 'unread' && unreadCount > 0 && `(${unreadCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🔔</div>
          <h3 className="text-lg font-semibold text-gray-700">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-gray-400 text-sm mt-2">
            {filter === 'unread'
              ? "You're all caught up! Switch to 'All' to see past notifications."
              : 'Notifications about your application will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
            const Icon = cfg.icon
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={clsx(
                  'card flex items-start gap-4 transition-all duration-150',
                  !n.is_read
                    ? `border-l-4 border-brand-500 cursor-pointer hover:shadow-card-hover`
                    : 'opacity-75'
                )}
              >
                <div className={clsx('p-2.5 rounded-xl shrink-0', cfg.bg)}>
                  <Icon size={18} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className={clsx(
                      'text-sm font-semibold',
                      !n.is_read ? 'text-gray-900' : 'text-gray-600'
                    )}>
                      {n.title}
                    </p>
                    <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                      {new Date(n.created_at).toLocaleDateString([], {
                        day: 'numeric', month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                  {!n.is_read && (
                    <p className="text-xs text-brand-500 mt-1.5 font-medium">
                      Click to mark as read
                    </p>
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
