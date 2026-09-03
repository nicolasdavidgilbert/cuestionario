const OWNER_TOKEN_KEY = 'cuestionarios_owner_token'

export function getOwnerToken(): string {
  if (typeof window === 'undefined') return ''

  let existing: string | null = null
  try {
    existing = window.localStorage.getItem(OWNER_TOKEN_KEY)
  } catch {
    return ''
  }
  if (existing) return existing

  const token = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    window.localStorage.setItem(OWNER_TOKEN_KEY, token)
  } catch {
    // No se pudo persistir el token; se devuelve el token en memoria para la sesión actual.
  }
  return token
}
