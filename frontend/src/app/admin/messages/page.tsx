'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import api from '@/lib/api'
import { MessageSquare, Send, User, Search, RefreshCw, ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

interface Conversation {
  applicationId: string
  studentId: string
  studentName: string
  studentEmail: string
  studentIdCode: string
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

interface Message {
  id: string
  content: string
  sender_id: string
  recipient_id: string
  is_read: boolean
  created_at: string
  sender?: { id: string; full_name: string; role: string }
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [search, setSearch] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversations() {
    setLoadingConvs(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setCurrentUserId(session.user.id)

      // Get current user's name
      const { data: me } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()
      if (me) setCurrentUserName(me.full_name)

      // Get all applications assigned to this counselor (or all if admin)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      let appsQuery = supabase
        .from('applications')
        .select('id, student_id')

      // Counselors only see their assigned students; admins see all
      if (profile?.role === 'counselor') {
        appsQuery = appsQuery.eq('assigned_counselor_id', session.user.id)
      }

      const { data: apps } = await appsQuery
      if (!apps || apps.length === 0) {
        setConversations([])
        setLoadingConvs(false)
        return
      }

      const appIds = apps.map((a: any) => a.id)
      const studentIds = [...new Set(apps.map((a: any) => a.student_id))]

      // Get student profiles
      const { data: students } = await supabase
        .from('profiles')
        .select('id, full_name, email, student_id')
        .in('id', studentIds as string[])

      const studentMap: Record<string, any> = {}
      ;(students || []).forEach((s: any) => { studentMap[s.id] = s })

      // Get latest message per application
      const { data: allMessages } = await supabase
        .from('messages')
        .select('application_id, content, created_at, is_read, recipient_id')
        .in('application_id', appIds)
        .order('created_at', { ascending: false })

      // Build conversation list
      const convMap: Record<string, Conversation> = {}
      const app = apps.find((a: any) => a.id)

      apps.forEach((a: any) => {
        const student = studentMap[a.student_id]
        if (!student) return

        const appMessages = (allMessages || []).filter(m => m.application_id === a.id)
        const latest = appMessages[0]
        const unread = appMessages.filter(m => m.recipient_id === session.user.id && !m.is_read).length

        convMap[a.id] = {
          applicationId: a.id,
          studentId: a.student_id,
          studentName: student.full_name,
          studentEmail: student.email,
          studentIdCode: student.student_id || '—',
          lastMessage: latest?.content || 'No messages yet',
          lastMessageAt: latest?.created_at || a.created_at,
          unreadCount: unread,
        }
      })

      const sorted = Object.values(convMap).sort((a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      )

      setConversations(sorted)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setLoadingConvs(false)
    }
  }

  async function openConversation(conv: Conversation) {
    setSelectedConv(conv)
    setMessages([])
    setLoadingMsgs(true)
    try {
      const res = await api.get(`/messages/${conv.applicationId}`)
      setMessages(res.data || [])
      // Refresh unread count
      setConversations(prev =>
        prev.map(c => c.applicationId === conv.applicationId ? { ...c, unreadCount: 0 } : c)
      )
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoadingMsgs(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!content.trim() || !selectedConv || sending) return

    setSending(true)
    try {
      const res = await api.post('/messages', {
        application_id: selectedConv.applicationId,
        recipient_id: selectedConv.studentId,
        content: content.trim(),
      })
      setMessages(prev => [...prev, res.data])
      setContent('')
      // Update last message in conversation list
      setConversations(prev =>
        prev.map(c => c.applicationId === selectedConv.applicationId
          ? { ...c, lastMessage: content.trim(), lastMessageAt: new Date().toISOString() }
          : c
        )
      )
      inputRef.current?.focus()
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }

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
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const filteredConvs = conversations.filter(c =>
    !search ||
    c.studentName.toLowerCase().includes(search.toLowerCase()) ||
    c.studentEmail.toLowerCase().includes(search.toLowerCase()) ||
    c.studentIdCode.toLowerCase().includes(search.toLowerCase())
  )

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">

      {/* ── Conversation list (left panel) ── */}
      <div className={clsx(
        'w-full sm:w-80 lg:w-96 bg-white border-r border-gray-100 flex flex-col shrink-0',
        selectedConv ? 'hidden sm:flex' : 'flex'
      )}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold">Messages</h1>
              {totalUnread > 0 && (
                <p className="text-xs text-brand-600 font-medium">{totalUnread} unread</p>
              )}
            </div>
            <button onClick={loadConversations} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8 text-sm py-2"
              placeholder="Search students..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                {conversations.length === 0
                  ? 'No student conversations yet.'
                  : 'No conversations match your search.'}
              </p>
            </div>
          ) : (
            filteredConvs.map(conv => (
              <button
                key={conv.applicationId}
                onClick={() => openConversation(conv)}
                className={clsx(
                  'w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                  selectedConv?.applicationId === conv.applicationId && 'bg-brand-50 border-l-2 border-l-brand-500'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={15} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-900 truncate">{conv.studentName}</p>
                      <span className="text-xs text-gray-400 shrink-0">{formatTime(conv.lastMessageAt)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{conv.studentIdCode}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{conv.lastMessage}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-[10px] font-bold">{conv.unreadCount}</span>
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat panel (right) ── */}
      <div className={clsx(
        'flex-1 flex flex-col bg-gray-50',
        !selectedConv ? 'hidden sm:flex' : 'flex'
      )}>
        {!selectedConv ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Select a conversation</p>
              <p className="text-gray-400 text-sm mt-1">Choose a student from the list to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 shadow-sm shrink-0">
              <button
                onClick={() => setSelectedConv(null)}
                className="sm:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                <User size={15} className="text-brand-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{selectedConv.studentName}</p>
                <p className="text-xs text-gray-400">{selectedConv.studentEmail} · {selectedConv.studentIdCode}</p>
              </div>
              <button
                onClick={() => openConversation(selectedConv)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <MessageSquare size={28} className="text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">No messages yet.</p>
                  <p className="text-gray-300 text-xs mt-1">Send a message to start the conversation.</p>
                </div>
              ) : (
                groupByDate(messages).map(group => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 font-medium px-2">
                        {formatDateLabel(group.date)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <div className="space-y-3">
                      {group.messages.map((msg, idx) => {
                        const isOwn = msg.sender_id === currentUserId
                        const showName = !isOwn && (idx === 0 || group.messages[idx - 1]?.sender_id !== msg.sender_id)

                        return (
                          <div key={msg.id} className={clsx('flex items-end gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                            {/* Avatar */}
                            {!isOwn && (
                              <div className={clsx(
                                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-0.5',
                                showName ? 'bg-brand-100' : 'invisible'
                              )}>
                                {showName && <User size={12} className="text-brand-600" />}
                              </div>
                            )}

                            <div className={clsx('max-w-[70%] flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
                              {!isOwn && showName && (
                                <span className="text-xs text-gray-400 ml-1">
                                  {msg.sender?.full_name || 'Student'}
                                </span>
                              )}
                              <div className={clsx(
                                'px-4 py-2.5 rounded-2xl text-sm leading-relaxed group',
                                isOwn
                                  ? 'bg-brand-600 text-white rounded-br-sm'
                                  : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                              )}>
                                {msg.content}
                              </div>
                              <span className="text-xs text-gray-400 px-1">
                                {formatTime(msg.created_at)}
                                {isOwn && <span className="ml-1">{msg.is_read ? '✓✓' : '✓'}</span>}
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

            {/* Input */}
            <div className="bg-white border-t border-gray-100 px-4 py-3 shrink-0">
              <form onSubmit={handleSend} className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px] max-h-32 bg-gray-50"
                  placeholder={`Reply to ${selectedConv.studentName}... (Enter to send)`}
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
                    : <Send size={17} />
                  }
                </button>
              </form>
              <p className="text-xs text-gray-400 mt-1.5 ml-1">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
