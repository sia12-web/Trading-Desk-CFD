'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Send, Loader2, Archive, Edit3, Check, X, Sparkles, TrendingUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface FundamentalSession {
    id: string
    pair: string
    title: string | null
    status: 'active' | 'archived'
    conclusion: string | null
    created_episode_id: string | null
    created_at: string
    updated_at: string
}

interface FundamentalMessage {
    id: string
    session_id: string
    role: 'user' | 'assistant'
    content: string
    macro_context: any
    created_at: string
}

export default function FundamentalSessionPage() {
    const router = useRouter()
    const params = useParams()
    const sessionId = params.id as string

    const [session, setSession] = useState<FundamentalSession | null>(null)
    const [messages, setMessages] = useState<FundamentalMessage[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [input, setInput] = useState('')
    const [editingTitle, setEditingTitle] = useState(false)
    const [editingConclusion, setEditingConclusion] = useState(false)
    const [titleInput, setTitleInput] = useState('')
    const [conclusionInput, setConclusionInput] = useState('')
    const [creatingEpisode, setCreatingEpisode] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const loadSession = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/fundamentals/sessions/${sessionId}`)
            if (!res.ok) throw new Error(await res.text())

            const { session: loadedSession, messages: loadedMessages } = await res.json()
            setSession(loadedSession)
            setMessages(loadedMessages || [])
            setTitleInput(loadedSession.title || '')
            setConclusionInput(loadedSession.conclusion || '')
        } catch (err) {
            console.error('Failed to load session:', err)
            alert('Session not found')
            router.push('/fundamentals')
        } finally {
            setLoading(false)
        }
    }, [sessionId, router])

    useEffect(() => { loadSession() }, [loadSession])
    useEffect(() => { scrollToBottom() }, [messages])

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || sending) return

        const userMessage = input.trim()
        setInput('')
        setSending(true)

        try {
            const res = await fetch(`/api/fundamentals/sessions/${sessionId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: userMessage }),
            })

            if (!res.ok) throw new Error(await res.text())

            const { userMessage: newUserMsg, assistantMessage: newAssistantMsg } = await res.json()
            setMessages(prev => [...prev, newUserMsg, newAssistantMsg])
        } catch (err) {
            console.error('Failed to send message:', err)
            alert('Failed to send message')
            setInput(userMessage) // Restore input
        } finally {
            setSending(false)
        }
    }

    const handleSaveTitle = async () => {
        if (!titleInput.trim()) return

        try {
            const res = await fetch(`/api/fundamentals/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: titleInput.trim() }),
            })

            if (!res.ok) throw new Error(await res.text())

            const { session: updatedSession } = await res.json()
            setSession(updatedSession)
            setEditingTitle(false)
        } catch (err) {
            console.error('Failed to update title:', err)
            alert('Failed to update title')
        }
    }

    const handleSaveConclusion = async () => {
        if (!conclusionInput.trim()) return

        try {
            const res = await fetch(`/api/fundamentals/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conclusion: conclusionInput.trim() }),
            })

            if (!res.ok) throw new Error(await res.text())

            const { session: updatedSession } = await res.json()
            setSession(updatedSession)
            setEditingConclusion(false)
        } catch (err) {
            console.error('Failed to update conclusion:', err)
            alert('Failed to update conclusion')
        }
    }

    const handleArchive = async () => {
        if (!confirm('Archive this analysis session?')) return

        try {
            const res = await fetch(`/api/fundamentals/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'archived' }),
            })

            if (!res.ok) throw new Error(await res.text())

            router.push('/fundamentals')
        } catch (err) {
            console.error('Failed to archive session:', err)
            alert('Failed to archive session')
        }
    }

    const handleCreateEpisode = async () => {
        if (!session?.conclusion) {
            alert('Please add a conclusion before creating an episode')
            return
        }

        if (!confirm(`Create a story episode for ${session.pair} based on this fundamental analysis?`)) return

        setCreatingEpisode(true)
        try {
            const res = await fetch(`/api/fundamentals/sessions/${sessionId}/create-episode`, {
                method: 'POST',
            })

            if (!res.ok) throw new Error(await res.text())

            const { taskId } = await res.json()
            alert(`Story episode generation started for ${session.pair}!\n\nCheck the Story page to see progress.`)

            // Reload session to get episode link
            setTimeout(loadSession, 2000)
        } catch (err) {
            console.error('Failed to create episode:', err)
            alert('Failed to create episode')
        } finally {
            setCreatingEpisode(false)
        }
    }

    if (loading || !session) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 size={32} className="animate-spin text-neutral-500" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen bg-neutral-950">
            {/* Header */}
            <div className="border-b border-neutral-800 bg-neutral-900/50 p-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-4 mb-3">
                        <button
                            onClick={() => router.push('/fundamentals')}
                            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} className="text-neutral-400" />
                        </button>
                        <div className="flex items-center gap-3 flex-1">
                            <TrendingUp size={24} className="text-blue-400" />
                            <div className="text-xl font-bold text-white">{session.pair}</div>
                            {session.created_episode_id && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-900/30 border border-green-700 rounded text-[10px] font-bold text-green-400 uppercase">
                                    <Sparkles size={10} />
                                    Episode Created
                                </div>
                            )}
                            {session.status === 'archived' && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[10px] font-bold text-neutral-400 uppercase">
                                    <Archive size={10} />
                                    Archived
                                </div>
                            )}
                        </div>
                        {session.status === 'active' && (
                            <button
                                onClick={handleArchive}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                            >
                                <Archive size={14} />
                                Archive
                            </button>
                        )}
                    </div>

                    {/* Title */}
                    <div className="mb-2">
                        {editingTitle ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={titleInput}
                                    onChange={e => setTitleInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                                    placeholder="Analysis title (optional)"
                                    className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                    autoFocus
                                />
                                <button onClick={handleSaveTitle} className="p-1 hover:bg-neutral-800 rounded text-green-400">
                                    <Check size={16} />
                                </button>
                                <button onClick={() => { setEditingTitle(false); setTitleInput(session.title || '') }} className="p-1 hover:bg-neutral-800 rounded text-red-400">
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setEditingTitle(true)}
                                className="text-sm text-neutral-400 hover:text-white flex items-center gap-2 group"
                            >
                                {session.title || 'Add title...'}
                                <Edit3 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        )}
                    </div>

                    {/* Conclusion */}
                    <div className="mb-2">
                        {editingConclusion ? (
                            <div className="flex flex-col gap-2">
                                <textarea
                                    value={conclusionInput}
                                    onChange={e => setConclusionInput(e.target.value)}
                                    placeholder="Analysis conclusion (required to create episode)"
                                    className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                                    rows={3}
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleSaveConclusion} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white flex items-center gap-1">
                                        <Check size={12} /> Save Conclusion
                                    </button>
                                    <button onClick={() => { setEditingConclusion(false); setConclusionInput(session.conclusion || '') }} className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-white">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setEditingConclusion(true)}
                                className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-2 group"
                            >
                                {session.conclusion ? (
                                    <span className="line-clamp-2">{session.conclusion}</span>
                                ) : (
                                    'Add conclusion to create episode...'
                                )}
                                <Edit3 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                        )}
                    </div>

                    {/* Create Episode Button */}
                    {session.conclusion && !session.created_episode_id && session.status === 'active' && (
                        <button
                            onClick={handleCreateEpisode}
                            disabled={creatingEpisode}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {creatingEpisode ? (
                                <><Loader2 size={14} className="animate-spin" /> Creating Episode...</>
                            ) : (
                                <><Sparkles size={14} /> Create Story Episode</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-4xl mx-auto space-y-4">
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-xl p-4 ${
                                    msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-neutral-900 border border-neutral-800 text-neutral-200'
                                }`}
                            >
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm prose-invert max-w-none">
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                                                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                                                li: ({ children }) => <li className="mb-1">{children}</li>,
                                                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                                                h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-white">{children}</h1>,
                                                h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-white">{children}</h2>,
                                                h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-white">{children}</h3>,
                                                code: ({ children }) => <code className="bg-neutral-800 px-1 py-0.5 rounded text-xs">{children}</code>,
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="text-sm">{msg.content}</div>
                                )}
                                <div className="text-[9px] text-neutral-500 mt-2">
                                    {new Date(msg.created_at).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ))}
                    {sending && (
                        <div className="flex justify-start">
                            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                                <Loader2 size={16} className="animate-spin text-neutral-500" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            {session.status === 'active' && (
                <div className="border-t border-neutral-800 bg-neutral-900/50 p-4">
                    <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Discuss fundamentals, ask about macro forces..."
                            disabled={sending}
                            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || sending}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {sending ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}
