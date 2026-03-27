'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react'
import { useBackgroundTask } from '@/lib/hooks/use-background-task'

interface GenerateStoryButtonProps {
    pair: string
    episodeCount: number
    onComplete: () => void
    autoGenerate?: boolean
}

export function GenerateStoryButton({ pair, episodeCount, onComplete, autoGenerate }: GenerateStoryButtonProps) {
    const task = useBackgroundTask('story_generation')
    const [autoFired, setAutoFired] = useState(false)

    const isFirstEpisode = episodeCount === 0
    const buttonLabel = isFirstEpisode ? 'Begin the Story' : 'Write Next Episode'
    const ButtonIcon = isFirstEpisode ? BookOpen : Sparkles

    const handleGenerate = () => {
        task.startTask('/api/story/generate', { pair })
    }

    // Auto-generate on mount if requested (e.g., after first subscription)
    useEffect(() => {
        if (autoGenerate && !autoFired && task.status === 'idle') {
            setAutoFired(true)
            
            // Critical: Remove the autoGenerate flag from URL to prevent loop on re-mount
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href)
                url.searchParams.delete('autoGenerate')
                window.history.replaceState({}, '', url.toString())
            }

            task.startTask('/api/story/generate', { pair })
        }
    }, [autoGenerate, autoFired, task.status, pair, task])

    // When completed, notify parent
    if (task.status === 'completed') {
        setTimeout(() => {
            onComplete()
            task.reset()
        }, 1500)
    }

    if (task.status === 'running') {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <Loader2 size={18} className="animate-spin text-blue-400" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-300">{task.message || (isFirstEpisode ? 'Beginning the story...' : 'Generating...')}</p>
                        <div className="mt-1.5 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${task.progress}%` }}
                            />
                        </div>
                    </div>
                    <span className="text-xs text-blue-400 font-mono">{task.progress}%</span>
                </div>
            </div>
        )
    }

    if (task.status === 'completed') {
        return (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                <CheckCircle2 size={18} className="text-green-400" />
                <p className="text-sm font-medium text-green-300">
                    {isFirstEpisode ? 'Story created!' : 'Episode generated!'}
                </p>
            </div>
        )
    }

    if (task.status === 'failed') {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <AlertCircle size={18} className="text-red-400" />
                    <p className="text-sm text-red-300">{task.error}</p>
                </div>
                <button
                    onClick={() => { task.reset() }}
                    className="text-xs text-neutral-500 hover:text-neutral-300 underline"
                >
                    Try again
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
        >
            <ButtonIcon size={16} />
            {buttonLabel}
        </button>
    )
}
