/**
 * Kraken Cryptocurrency Instruments
 * Compatible with OandaInstrument type for unified interface
 */

export interface KrakenInstrument {
    name: string              // Display name (e.g., "BTC/USD")
    displayName: string       // Human-readable name
    pairName: string          // Kraken API pair name (e.g., "XXBTZUSD")
    pipLocation: number       // Decimal places for pips
    marginRate: number        // Margin requirement (Kraken uses 1:2 - 1:5 leverage)
}

/**
 * 10 major crypto pairs on Kraken
 * 
 * Note: Kraken uses special notation:
 * - X prefix for cryptocurrencies (XXBT = BTC, XETH = ETH)
 * - Z prefix for fiat (ZUSD = USD, ZEUR = EUR)
 * - Sometimes no prefix for newer coins (SOL, DOGE, ADA)
 */
export const KRAKEN_INSTRUMENTS: KrakenInstrument[] = [
    {
        name: 'BTC/USD',
        displayName: 'Bitcoin / US Dollar',
        pairName: 'XXBTZUSD',
        pipLocation: -2,         // $0.01 = 1 pip
        marginRate: 0.5          // 1:2 leverage (50% margin)
    },
    {
        name: 'ETH/USD',
        displayName: 'Ethereum / US Dollar',
        pairName: 'XETHZUSD',
        pipLocation: -2,         // $0.01 = 1 pip
        marginRate: 0.5          // 1:2 leverage
    },
    {
        name: 'SOL/USD',
        displayName: 'Solana / US Dollar',
        pairName: 'SOLUSD',
        pipLocation: -3,         // $0.001 = 1 pip
        marginRate: 0.5          // 1:2 leverage
    },
    {
        name: 'XRP/USD',
        displayName: 'Ripple / US Dollar',
        pairName: 'XXRPZUSD',
        pipLocation: -4,         // $0.0001 = 1 pip
        marginRate: 0.5          // 1:2 leverage
    },
    {
        name: 'DOGE/USD',
        displayName: 'Dogecoin / US Dollar',
        pairName: 'DOGEUSD',
        pipLocation: -5,         // $0.00001 = 1 pip
        marginRate: 0.5          // 1:2 leverage
    },
    {
        name: 'ADA/USD',
        displayName: 'Cardano / US Dollar',
        pairName: 'ADAUSD',
        pipLocation: -4,         // $0.0001 = 1 pip
        marginRate: 0.5          // 1:2 leverage
    },
    {
        name: 'AVAX/USD',
        displayName: 'Avalanche / US Dollar',
        pairName: 'AVAXUSD',
        pipLocation: -3,         // $0.001 = 1 pip
        marginRate: 0.5          // 1:2 leverage
    },
    {
        name: 'DOT/USD',
        displayName: 'Polkadot / US Dollar',
        pairName: 'DOTUSD',
        pipLocation: -3,         // $0.001 = 1 pip
        marginRate: 0.5          // 1:2 leverage
    },
    {
        name: 'MATIC/USD',
        displayName: 'Polygon / US Dollar',
        pairName: 'MATICUSD',
        pipLocation: -4,         // $0.0001 = 1 pip
        marginRate: 0.5          // 1:2 leverage
    },
    {
        name: 'LINK/USD',
        displayName: 'Chainlink / US Dollar',
        pairName: 'LINKUSD',
        pipLocation: -3,         // $0.001 = 1 pip
        marginRate: 0.5          // 1:2 leverage
    }
]

/**
 * Get instrument by display name (e.g., "BTC/USD")
 */
export function getKrakenInstrument(name: string): KrakenInstrument | undefined {
    return KRAKEN_INSTRUMENTS.find(i => i.name === name)
}

/**
 * Get instrument by Kraken pair name (e.g., "XXBTZUSD")
 */
export function getKrakenInstrumentByPair(pairName: string): KrakenInstrument | undefined {
    return KRAKEN_INSTRUMENTS.find(i => i.pairName === pairName)
}
