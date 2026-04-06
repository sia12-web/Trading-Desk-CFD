'use client'

import React, { useState } from 'react'
import { XCircle, Loader2, Clock } from 'lucide-react'
import { OandaTrade } from '@/lib/types/oanda'

interface PendingOrdersTableProps {
    orders: any[]
}

export function PendingOrdersTable({ orders }: PendingOrdersTableProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null)

    const handleCancel = async (orderId: string) => {
        if (!confirm('Cancel this pending order?')) return
        setLoadingId(orderId)
        try {
            const res = await fetch('/api/trade/cancel', {
                method: 'POST',
                body: JSON.stringify({
                    oandaOrderId: orderId
                }),
                headers: { 'Content-Type': 'application/json' }
            })
            if (res.ok) {
                window.location.reload()
            } else {
                const data = await res.json()
                alert(data.error || 'Cancel failed')
            }
        } catch (err) {
            alert('Network error')
        } finally {
            setLoadingId(null)
        }
    }

    if (orders.length === 0) {
        return (
            <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-12 text-center text-neutral-500 font-medium border-dashed">
                No pending orders.
            </div>
        )
    }

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-neutral-800">
                            <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Type</th>
                            <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Instrument</th>
                            <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Units</th>
                            <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Price</th>
                            <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Expiration</th>
                            <th className="px-3 py-3 md:px-8 md:py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                        {orders.map((order) => (
                            <tr key={order.id} className="hover:bg-neutral-800/30 transition-colors">
                                <td className="px-3 py-3 md:px-8 md:py-6">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${order.type.includes('STOP_LOSS') ? 'bg-red-500' :
                                                order.type.includes('TAKE_PROFIT') ? 'bg-green-500' : 'bg-blue-500'}`} />
                                            <span className="font-bold text-premium-white text-sm">{order.type.replace(/_/g, ' ')}</span>
                                        </div>
                                        <span className="text-[10px] text-neutral-500 font-mono mt-1 px-3.5">ID: {order.id}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-3 md:px-8 md:py-6">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-premium-white text-sm">
                                            {order.instrument?.replace('_', '/') || 'N/A'}
                                        </span>
                                        {order.tradeID && (
                                            <span className="text-[10px] text-neutral-500 font-mono">Linked to #{order.tradeID}</span>
                                        )}
                                    </div>
                                </td>
                                <td className={`px-3 py-3 md:px-8 md:py-6 text-right font-mono font-bold text-sm ${parseFloat(order.units || '0') >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {order.units || '—'}
                                </td>
                                <td className="px-3 py-3 md:px-8 md:py-6 text-right font-mono font-bold text-sm text-neutral-300">
                                    {order.price}
                                </td>
                                <td className="px-3 py-3 md:px-8 md:py-6 text-right">
                                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-400 font-bold uppercase tracking-widest border border-neutral-700">
                                        {order.timeInForce}
                                    </span>
                                </td>
                                <td className="px-3 py-3 md:px-8 md:py-6">
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => handleCancel(order.id)}
                                            disabled={loadingId === order.id}
                                            className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all group/cancel"
                                            title="Cancel Order"
                                        >
                                            {loadingId === order.id ? (
                                                <Loader2 className="animate-spin" size={16} />
                                            ) : (
                                                <XCircle size={16} />
                                            )}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
