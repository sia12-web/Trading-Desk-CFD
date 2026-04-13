// ── Asset Type Detection & Configuration ──
// Detects whether an instrument is forex, CFD index, or crypto and returns asset-specific config.

export type AssetType = 'forex' | 'cfd_index' | 'crypto'

export interface IndexMeta {
    displayName: string
    country: string
    sector: string
    centralBank: string
    peerInstruments: string[]
    bondInstrument: string | null
    keySectors: string[]
}

export interface CryptoMeta {
    displayName: string
    symbol: string
    category: 'layer-1' | 'smart-contract' | 'payment' | 'meme'
    keyDrivers: string[]
}

export interface AssetConfig {
    type: AssetType
    pointLabel: 'pips' | 'points'
    pointMultiplier: number
    decimalPlaces: number
    indexMeta: IndexMeta | null
    cryptoMeta: CryptoMeta | null
}

// Known CFD index instruments (OANDA format → config)
const INDEX_MAP: Record<string, IndexMeta> = {
    NAS100_USD: {
        displayName: 'Nasdaq 100',
        country: 'US',
        sector: 'tech-heavy',
        centralBank: 'Federal Reserve (Fed)',
        peerInstruments: ['SPX500_USD', 'US30_USD'],
        bondInstrument: 'USB10Y_USD',
        keySectors: ['technology', 'AI & semiconductors', 'cloud computing', 'consumer tech'],
    },
    SPX500_USD: {
        displayName: 'S&P 500',
        country: 'US',
        sector: 'broad market',
        centralBank: 'Federal Reserve (Fed)',
        peerInstruments: ['NAS100_USD', 'US30_USD'],
        bondInstrument: 'USB10Y_USD',
        keySectors: ['technology', 'financials', 'healthcare', 'energy', 'consumer'],
    },
    DE30_EUR: {
        displayName: 'DAX 40',
        country: 'DE',
        sector: 'export-oriented industrials',
        centralBank: 'European Central Bank (ECB)',
        peerInstruments: ['EU50_EUR'],
        bondInstrument: 'DE10YB_EUR',
        keySectors: ['automotive', 'industrials', 'chemicals', 'financials', 'tech'],
    },
    US30_USD: {
        displayName: 'Dow Jones 30',
        country: 'US',
        sector: 'blue-chip / cyclical',
        centralBank: 'Federal Reserve (Fed)',
        peerInstruments: ['SPX500_USD', 'NAS100_USD'],
        bondInstrument: 'USB10Y_USD',
        keySectors: ['financials', 'industrials', 'healthcare', 'energy', 'consumer staples'],
    },
}

// Known crypto instruments (display pair → config)
const CRYPTO_MAP: Record<string, CryptoMeta> = {
    'BTC/USD': {
        displayName: 'Bitcoin',
        symbol: 'BTC',
        category: 'layer-1',
        keyDrivers: ['halving cycles', 'institutional adoption', 'ETF flows', 'store of value narrative', 'on-chain metrics'],
    },
    'ETH/USD': {
        displayName: 'Ethereum',
        symbol: 'ETH',
        category: 'smart-contract',
        keyDrivers: ['DeFi ecosystem', 'gas fees', 'staking yield', 'L2 adoption', 'protocol upgrades'],
    },
    'SOL/USD': {
        displayName: 'Solana',
        symbol: 'SOL',
        category: 'layer-1',
        keyDrivers: ['high-performance L1', 'DeFi/NFT ecosystem', 'VC backing', 'network reliability'],
    },
    'XRP/USD': {
        displayName: 'Ripple',
        symbol: 'XRP',
        category: 'payment',
        keyDrivers: ['payment network', 'regulatory clarity', 'institutional partnerships', 'cross-border remittance'],
    },
    'DOGE/USD': {
        displayName: 'Dogecoin',
        symbol: 'DOGE',
        category: 'meme',
        keyDrivers: ['social media sentiment', 'community momentum', 'meme culture', 'retail trading waves'],
    },
    'LINK/USD': {
        displayName: 'Chainlink',
        symbol: 'LINK',
        category: 'smart-contract',
        keyDrivers: ['oracle networks', 'CCIP adoption', 'institutional data feeds', 'staking'],
    },
    'LTC/USD': {
        displayName: 'Litecoin',
        symbol: 'LTC',
        category: 'payment',
        keyDrivers: ['silver to gold', 'scrypt hashrate', 'historical stability', 'fast payments'],
    },
    'SHIB/USD': {
        displayName: 'Shiba Inu',
        symbol: 'SHIB',
        category: 'meme',
        keyDrivers: ['burn mechanisms', 'shibarium L2', 'community ecosystem', 'retail hype'],
    },
    'AVAX/USD': {
        displayName: 'Avalanche',
        symbol: 'AVAX',
        category: 'layer-1',
        keyDrivers: ['subnets technology', 'gaming ecosystem', 'fast finality', 'corporate partnerships'],
    },
    'DOT/USD': {
        displayName: 'Polkadot',
        symbol: 'DOT',
        category: 'layer-1',
        keyDrivers: ['parachain auctions', 'interoperability focus', 'sdk adoption', 'decentralized governance'],
    },
    'ADA/USD': {
        displayName: 'Cardano',
        symbol: 'ADA',
        category: 'layer-1',
        keyDrivers: ['peer-reviewed research', 'staking stability', 'african adoption', 'smart contract growth'],
    },
}

// Default forex config
const FOREX_DEFAULT: AssetConfig = {
    type: 'forex',
    pointLabel: 'pips',
    pointMultiplier: 10000,
    decimalPlaces: 5,
    indexMeta: null,
    cryptoMeta: null,
}

/**
 * Get asset configuration for any instrument.
 * Accepts both formats: "NAS100_USD" or "NAS100/USD"
 */
export function getAssetConfig(pair: string): AssetConfig {
    // Check for crypto first (display format: BTC/USD or internal format: CRYPTO_BTC_USD)
    const cryptoMeta = CRYPTO_MAP[pair]
    if (cryptoMeta || pair.startsWith('CRYPTO_')) {
        // Convert internal format to display to find meta
        const displayPair = pair.startsWith('CRYPTO_')
            ? pair.replace('CRYPTO_', '').replace('_', '/')
            : pair
        const meta = CRYPTO_MAP[displayPair]
        if (meta) {
            const decimals = meta.symbol === 'SHIB' ? 8
                : meta.symbol === 'DOGE' ? 5
                : meta.symbol === 'XRP' ? 4
                : meta.symbol === 'ADA' || meta.symbol === 'DOT' ? 3
                : 2 // BTC, ETH, SOL, LINK, LTC, AVAX
            return {
                type: 'crypto',
                pointLabel: 'points',
                pointMultiplier: 1,
                decimalPlaces: decimals,
                indexMeta: null,
                cryptoMeta: meta,
            }
        }
    }

    const instrument = pair.replace('/', '_')
    const indexMeta = INDEX_MAP[instrument]

    if (indexMeta) {
        return {
            type: 'cfd_index',
            pointLabel: 'points',
            pointMultiplier: 1,
            decimalPlaces: 1,
            indexMeta,
            cryptoMeta: null,
        }
    }

    // JPY pairs use 3 decimal places and 100x multiplier for pips
    if (pair.includes('JPY')) {
        return {
            ...FOREX_DEFAULT,
            decimalPlaces: 3,
            pointMultiplier: 100
        }
    }

    // Gold (XAU) uses 3 decimal places and 10x multiplier (0.1 = 1 pip/point)
    if (pair.includes('XAU')) {
        return {
            ...FOREX_DEFAULT,
            decimalPlaces: 3,
            pointMultiplier: 10,
            pointLabel: 'points'
        }
    }

    return FOREX_DEFAULT

}

/**
 * Check if a pair is a known CFD index.
 */
export function isCFDIndex(pair: string): boolean {
    return getAssetConfig(pair).type === 'cfd_index'
}

/**
 * Check if a pair is a cryptocurrency.
 */
export function isCrypto(pair: string): boolean {
    return getAssetConfig(pair).type === 'crypto'
}

/**
 * Convert display pair to internal instrument format.
 * Crypto: BTC/USD → CRYPTO_BTC_USD
 * Forex/Index: EUR/USD → EUR_USD
 */
export function displayToInternalPair(pair: string): string {
    if (CRYPTO_MAP[pair]) {
        return `CRYPTO_${pair.replace('/', '_')}`
    }
    return pair.replace('/', '_')
}
