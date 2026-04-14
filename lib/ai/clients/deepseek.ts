import OpenAI from 'openai'
import { logAIUsage } from '../usage-logger'
import type { UsageContext } from './claude'

let _client: OpenAI | null = null
function getClient() {
    if (!_client) {
        _client = new OpenAI({
            apiKey: process.env.DEEPSEEK_API_KEY,
            baseURL: 'https://api.deepseek.com',
        })
    }
    return _client
}

interface DeepSeekOptions {
    timeout?: number
    maxTokens?: number
    model?: string
    usage?: UsageContext
}

/**
 * Call DeepSeek API via OpenAI-compatible endpoint.
 * Used as the "Quantitative Engine" for zone validation and risk models.
 */
export async function callDeepSeek(
    prompt: string,
    options: DeepSeekOptions = {}
): Promise<string> {
    const {
        timeout = 90_000,
        maxTokens = 4096,
        model = 'deepseek-chat',
        usage,
    } = options

    const promptPreview = prompt.slice(0, 80).replace(/\n/g, ' ')
    console.log(`[AI] DEEPSEEK (Quant Engine) | model=${model} | maxTokens=${maxTokens} | timeout=${timeout}ms | prompt="${promptPreview}..."`)

    const start = Date.now()
    const maxRetries = 5
    let attempt = 0

    while (attempt <= maxRetries) {
        attempt++
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        try {
            const response = await getClient().chat.completions.create(
                {
                    model,
                    temperature: 0,
                    max_tokens: maxTokens,
                    messages: [{ role: 'user', content: prompt }],
                },
                { signal: controller.signal }
            )

            const elapsed = Date.now() - start
            const content = response.choices[0]?.message?.content
            if (!content) {
                throw new Error('DeepSeek returned empty response')
            }
            const tokens = response.usage
            const inputTokens = tokens?.prompt_tokens ?? 0
            const outputTokens = tokens?.completion_tokens ?? 0
            console.log(`[AI] DEEPSEEK DONE | ${elapsed}ms | attempt=${attempt} | input=${inputTokens} output=${outputTokens} tokens | ${content.length} chars`)

            if (usage) {
                logAIUsage({
                    userId: usage.userId,
                    provider: 'deepseek',
                    model,
                    feature: usage.feature,
                    inputTokens,
                    outputTokens,
                    durationMs: elapsed,
                    success: true,
                })
            }

            clearTimeout(timer)
            return content
        } catch (error: any) {
            clearTimeout(timer)
            const elapsed = Date.now() - start
            
            // Extract error info from SDK or response
            const status = error?.status || error?.error?.status || 0
            const messageStr = error?.message || error?.error?.message || ''
            
            // 502 (Bad Gateway), 503 (Service Unavailable), 429 (Rate Limit)
            const isRetryable = status === 502 || status === 503 || status === 429 || 
                               messageStr.toLowerCase().includes('overloaded') ||
                               messageStr.toLowerCase().includes('bad gateway') ||
                               messageStr.toLowerCase().includes('service unavailable')

            if (isRetryable && attempt <= maxRetries) {
                const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s, 16s, 32s
                console.warn(`[AI] DEEPSEEK ${status} RECOVERABLE ERROR (attempt ${attempt}/${maxRetries+1}) | retrying in ${delay}ms... | ${messageStr.slice(0, 50)}`)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
            }

            console.error(`[AI] DEEPSEEK FAILED after ${attempt} attempts | ${elapsed}ms | ${messageStr}`)

            if (usage) {
                logAIUsage({
                    userId: usage.userId,
                    provider: 'deepseek',
                    model,
                    feature: usage.feature,
                    inputTokens: 0,
                    outputTokens: 0,
                    durationMs: elapsed,
                    success: false,
                    errorMessage: messageStr,
                })
            }

            throw error
        }
    }

    throw new Error('DeepSeek call failed after maximum retries')
}
