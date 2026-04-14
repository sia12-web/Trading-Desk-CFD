import { ALLOWED_INSTRUMENTS, oandaToDisplayPair } from '@/lib/constants/instruments'

export const VALID_PAIRS = ALLOWED_INSTRUMENTS.map(i => oandaToDisplayPair(i))

export type ValidPair = string

export function isValidPair(pair: string): pair is ValidPair {
    return VALID_PAIRS.includes(pair as ValidPair)
}
