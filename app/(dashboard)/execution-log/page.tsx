import { createClient, getAuthUser } from '@/lib/supabase/server'
import { format } from 'date-fns'
import {
    History,
    Zap,
    Edit3,
    XCircle,
    Slash,
    CheckCircle2,
    XCircle as Frown,
    AlertTriangle,
    ChevronRight,
    RefreshCw
} from 'lucide-react'
import { SyncButton } from '@/components/sync/SyncButton'
import { BackfillButton } from './_components/BackfillButton'

export default async function ExecutionLogPage() {
    const user = await getAuthUser()
    if (!user) return null
    const supabase = await createClient()

    const { data: logs, error } = await supabase
        .from('execution_log')
        .select(`
      *,
      trades (pair, direction)
    `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'place_order': return <Zap size={16} className="text-blue-400" />
            case 'modify_trade': return <Edit3 size={16} className="text-amber-400" />
            case 'close_trade': return <XCircle size={16} className="text-red-400" />
            case 'cancel_order': return <Slash size={16} className="text-neutral-400" />
            case 'sync_import': return <RefreshCw size={16} className="text-purple-400" />
            case 'sync_close': return <RefreshCw size={16} className="text-teal-400" />
            default: return <History size={16} />
        }
    }

    const getStatusDisplay = (status: string) => {
        switch (status) {
            case 'success': return (
                <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
                    <CheckCircle2 size={12} /> Success
                </span>
            )
            case 'failed': return (
                <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
                    <Frown size={12} /> Failed
                </span>
            )
            case 'blocked': return (
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
                    <AlertTriangle size={12} /> Blocked
                </span>
            )
            default: return <span>{status}</span>
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Execution Audit Log</h1>
                    <p className="text-neutral-500 mt-2">Historical record of every trading action and risk validation.</p>
                </div>
                <div className="flex items-center gap-3">
                    <BackfillButton />
                    <SyncButton />
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-neutral-800">
                                <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Time</th>
                                <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Action</th>
                                <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Trade</th>
                                <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</th>
                                <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {logs?.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-12 text-center text-neutral-500">No execution history found.</td>
                                </tr>
                            ) : (
                                logs?.map((log) => (
                                    <tr key={log.id} className="hover:bg-neutral-800/30 transition-colors group">
                                        <td className="px-3 py-3 md:px-8 md:py-6">
                                            <span className="text-neutral-500 text-sm">{format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}</span>
                                        </td>
                                        <td className="px-3 py-3 md:px-8 md:py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-neutral-800 flex items-center justify-center">
                                                    {getActionIcon(log.action)}
                                                </div>
                                                <span className="font-bold text-premium-white text-sm capitalize">{log.action.replace('_', ' ')}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 md:px-8 md:py-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white text-sm">
                                                    {log.trades?.pair || log.response_payload?.instrument?.replace('_', '/') || log.request_payload?.instrument?.replace('_', '/') || 'N/A'}
                                                </span>
                                                <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                                                    {log.trades?.direction || (log.response_payload?.initialUnits && (parseFloat(log.response_payload.initialUnits) > 0 ? 'long' : 'short')) || log.request_payload?.direction || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 md:px-8 md:py-6">
                                            {getStatusDisplay(log.status)}
                                        </td>
                                        <td className="px-3 py-3 md:px-8 md:py-6">
                                            {log.status === 'failed' || log.status === 'blocked' ? (
                                                <div className="flex items-center gap-2 text-neutral-500 text-xs">
                                                    <AlertTriangle size={14} className="text-amber-500" />
                                                    {log.error_message || 'Validation failed'}
                                                </div>
                                            ) : (
                                                <span className="text-neutral-500 text-xs font-mono">ID: {log.oanda_trade_id || '-'}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
