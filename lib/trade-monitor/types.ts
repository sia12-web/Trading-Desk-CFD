/**
 * Trade Monitor — Split TP1/TP2 Lifecycle Types
 *
 * Tracks auto-executed trades through their full lifecycle:
 * open → tp1_partial_closed (50% closed, SL at breakeven) → tp2_closed (remaining closed)
 */

export type ManagedTradeSource = 'regime' | 'killzone'

export type ManagedTradeStatus =
    | 'open'                  // Initial: SL on OANDA, monitor watching for TP1
    | 'tp1_partial_closed'    // TP1 hit: 50% closed, SL moved to breakeven, TP2 set on OANDA
    | 'tp2_closed'            // TP2 hit: remaining 50% closed. Terminal.
    | 'stopped_out'           // SL hit (original or breakeven). Terminal.
    | 'manually_closed'       // User closed via UI or broker app. Terminal.

export interface ManagedTrade {
    id: string
    source: ManagedTradeSource
    source_execution_id: string
    oanda_trade_id: string
    pair: string
    instrument: string
    direction: 'long' | 'short'

    entry_price: number
    stop_loss: number
    original_stop_loss: number
    take_profit_1: number
    take_profit_2: number

    initial_units: number
    current_units: number

    status: ManagedTradeStatus

    // TP1 lifecycle
    tp1_hit_at: string | null
    tp1_close_price: number | null
    tp1_units_closed: number | null
    tp1_pnl: number | null

    // Breakeven
    breakeven_moved_at: string | null

    // TP2 lifecycle
    tp2_hit_at: string | null
    tp2_close_price: number | null
    tp2_pnl: number | null

    // Final
    final_pnl: number | null

    created_at: string
    updated_at: string
}

export interface MonitorAction {
    tradeId: string
    pair: string
    action: 'tp1_partial_close' | 'tp2_close' | 'breakeven_move' | 'mark_stopped_out' | 'mark_manually_closed'
    success: boolean
    error?: string
    details?: string
}

export interface MonitorSummary {
    checked: number
    tp1_closes: number
    tp2_closes: number
    breakeven_moves: number
    stopped_out: number
    manually_closed: number
    errors: number
    actions: MonitorAction[]
    duration_ms: number
}
