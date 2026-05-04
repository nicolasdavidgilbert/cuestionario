import { jsonResponse } from './http'

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  const realIp = request.headers.get('x-real-ip') || ''
  return forwardedFor.split(',')[0]?.trim() || realIp.trim() || 'unknown'
}

export function rateLimit(request: Request, options: RateLimitOptions): Response | null {
  const now = Date.now()
  const bucketKey = `${options.key}:${getClientIp(request)}`
  const current = buckets.get(bucketKey)

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs })
    return null
  }

  current.count += 1

  if (current.count > options.limit) {
    return jsonResponse({ message: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' }, 429)
  }

  return null
}
