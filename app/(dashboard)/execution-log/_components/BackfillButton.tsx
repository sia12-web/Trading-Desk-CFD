'use client'

import { useState } from 'react'
import { Database, Loader2 } from 'lucide-react'

export function BackfillButton() {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const handleBackfill = async () => {
        if (!confirm('This will import all your existing trades (including TradingView trades) into the execution log. Continue?')) {
            return
        }

        setLoading(true)
        setMessage(null)

        try {
            const res = await fetch('/api/execution-log/backfill', {
                method: 'POST'
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Backfill failed')
            }

            setMessage(data.message || `✅ Imported ${data.imported} trades`)

            // Refresh the page after 2 seconds
            setTimeout(() => {
                window.location.reload()
            }, 2000)
        } catch (error: any) {
            setMessage(`❌ ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <button
                onClick={handleBackfill}
                disabled={loading}
                className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20"
            >
                {loading ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Backfilling...</span>
                    </>
                ) : (
                    <>
                        <Database size={16} />
                        <span>Backfill History</span>
                    </>
                )}
            </button>
            {message && (
                <p className="text-xs text-neutral-400 animate-in fade-in slide-in-from-top-2">
                    {message}
                </p>
            )}
        </div>
    )
}
