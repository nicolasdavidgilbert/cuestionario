const OWNER_TOKEN_KEY = 'cuestionarios_owner_token'

export function getOwnerToken(): string {
  if (typeof window === 'undefined') return ''

  const existing = window.localStorage.getItem(OWNER_TOKEN_KEY)
  if (existing) return existing

  const token = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(OWNER_TOKEN_KEY, token)
  return token
}
