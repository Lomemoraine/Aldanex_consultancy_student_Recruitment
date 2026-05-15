'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'
import { Send, MessageSquare, RefreshCw, User } from 'lucide-react'
import clsx from 'clsx'

interface Message {
  id: string
  content: string
  sender_id: string
  recipient_id: string
  is_read: boolean
  created_at: string
  sender?: {
    id: string
    full_name: string
    role: string
  }
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [applicationId, setApplicationId] = useState('')
  const [counselorId, setCounselorId] = useState('')
  const [counselorName, setCounselorName] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [hasCounselor, setHasCounselor] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setCurrentUserId(session.user.id)

      // Get application and assigned counselor
      const appRes = await api.get('/applications')
      const app = appRes.data?.[0]
      if (!app) return

      setApplicationId(app.id)

      // Check if counselor is assigned
      if (app.assigned_counselor_id) {
        setCounselorId(app.assigned_counselor_id)
        setHasCounselor(true)

        // Fetch counselor name
        const { data: counselor } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', app.assigned_counselor_id)
          .single()

        if (counselor) setCounselorName(counselor.full_name)

        // Load messages
        const msgRes = await api.get(`/messages/${app.id}`)
        setMessages(msgRes.data || [])
      } else {
        setHasCounselor(false)
      }
    } catch (err: any) {
      console.error('Failed to load messages:', err)
      setError('Failed to load messages.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!content.trim() || !applicationId || !counselorId || sending) return

    setSending(true)
    setError('')

    try {
      const res = await api.post('/messages', {
        application_id: applicationId,
        recipient_id: counselorId,
        content: content.trim(),
      })

      setMessages(prev => [...prev, res.data])
      setContent('')
      inputRef.current?.focus()
    } catch (err: any) {
      setError('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { day: 'numeric', month: 'short' }) +
        ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  // Group messages by date
  function groupByDate(msgs: Message[]) {
    const groups: { date: string; messages: Message[] }[] = []
    let currentDate = ''

    msgs.forEach(msg => {
      const date = new Date(msg.created_at).toDateString()
      if (date !== currentDate) {
        currentDate = date
        groups.push({ date, messages: [msg] })
      } else {
        groups[groups.length - 1].messages.push(msg)
      }
    })
    return groups
  }

  function formatDateLabel(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) return 'Today'
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        <p className="text-gray-400 text-sm">Loading messages...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {hasCounselor
              ? `Conversation with ${counselorName || 'your counselor'}`
              : 'Chat with your assigned counselor'}
          </p>
        </div>
        <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* No counselor assigned */}
      {!hasCounselor ? (
        <div className="card flex-1 flex flex-col items-center justify-center text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <MessageSquare size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">No counselor assigned yet</h3>
          <p className="text-gray-400 text-sm mt-2 max-w-sm">
            Once a counselor is assigned to your application, you'll be able to message them directly here.
          </p>
          <p className="text-gray-400 text-xs mt-4">
            This usually happens after your profile is reviewed — typically within 1–2 business days.
          </p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 card p-0 overflow-hidden">

          {/* Counselor info bar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
            <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <User size={16} className="text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">{counselorName || 'Your Counselor'}</p>
              <p className="text-xs text-gray-400">Aldanex Counselor</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-gray-400">Online</span>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <MessageSquare size={32} className="text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">No messages yet.</p>
                <p className="text-gray-300 text-xs mt-1">Send a message to start the conversation.</p>
              </div>
            ) : (
              groupByDate(messages).map(group => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400 font-medium px-2">
                      {formatDateLabel(group.date)}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  {/* Messages in this group */}
                  <div className="space-y-3">
                    {group.messages.map((msg, idx) => {
                      const isOwn = msg.sender_id === currentUserId
                      const showAvatar = !isOwn && (
                        idx === 0 ||
                        group.messages[idx - 1]?.sender_id !== msg.sender_id
                      )

                      return (
                        <div
                          key={msg.id}
                          className={clsx(
                            'flex items-end gap-2',
                            isOwn ? 'flex-row-reverse' : 'flex-row'
                          )}
                        >
                          {/* Avatar */}
                          {!isOwn && (
                            <div className={clsx(
                              'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-0.5',
                              showAvatar ? 'bg-brand-100' : 'invisible'
                            )}>
                              {showAvatar && <User size={13} className="text-brand-600" />}
                            </div>
                          )}

                          {/* Bubble */}
                          <div className={clsx(
                            'max-w-[70%] group',
                            isOwn ? 'items-end' : 'items-start',
                            'flex flex-col gap-1'
                          )}>
                            {/* Sender name (only for counselor, first in sequence) */}
                            {!isOwn && showAvatar && (
                              <span className="text-xs text-gray-400 ml-1">
                                {msg.sender?.full_name || 'Counselor'}
                              </span>
                            )}

                            <div className={clsx(
                              'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                              isOwn
                                ? 'bg-brand-600 text-white rounded-br-sm'
                                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                            )}>
                              {msg.content}
                            </div>

                            {/* Timestamp */}
                            <span className={clsx(
                              'text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity px-1',
                              isOwn ? 'text-right' : 'text-left'
                            )}>
                              {formatTime(msg.created_at)}
                              {isOwn && (
                                <span className="ml-1">
                                  {msg.is_read ? '✓✓' : '✓'}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="px-5 py-2 bg-red-50 border-t border-red-100 text-red-600 text-xs">
              {error}
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-gray-100 px-4 py-3 shrink-0">
            <form onSubmit={handleSend} className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent min-h-[44px] max-h-32"
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!content.trim() || sending}
                className={clsx(
                  'flex items-center justify-center w-11 h-11 rounded-xl transition-colors shrink-0',
                  content.trim() && !sending
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                {sending
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Send size={18} />
                }
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-1.5 ml-1">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
