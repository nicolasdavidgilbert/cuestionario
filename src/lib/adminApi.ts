// Cliente de /api/admin/*: sin caché, con token CSRF en las escrituras.
// Una sesión caducada lleva al formulario de acceso conservando la página actual.

export interface FieldError {
  field: string
  message: string
}

export class AdminApiError extends Error {
  status: number
  code: string
  errors: FieldError[]
  data: Record<string, any>

  constructor(status: number, body: Record<string, any>) {
    super(body?.message || `Error ${status}`)
    this.status = status
    this.code = body?.code || ''
    this.errors = Array.isArray(body?.errors) ? body.errors : []
    this.data = body || {}
  }
}

let csrfToken = ''

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken
  csrfToken = document.querySelector<HTMLMetaElement>('meta[name="admin-csrf"]')?.content || ''
  if (!csrfToken) {
    const session = await request<{ csrfToken: string }>('GET', '/session')
    csrfToken = session.csrfToken
  }
  return csrfToken
}

export function loginUrl() {
  return `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
}

export function buildQuery(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && !(key === 'page' && Number(value) === 1)) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  // El acceso no tiene sesión todavía: no hay token que pedir.
  if (method !== 'GET' && path !== '/login') headers['x-csrf-token'] = await getCsrfToken()

  const response = await fetch(`/api/admin${path}`, {
    method,
    headers,
    cache: 'no-store',
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body)
  })

  const json = await response.json().catch(() => ({}))
  if (response.status === 401 && path !== '/login') {
    window.location.assign(loginUrl())
    throw new AdminApiError(401, json)
  }
  if (!response.ok) throw new AdminApiError(response.status, json)
  return json as T
}

export const adminApi = {
  get: <T = any>(path: string, params?: Record<string, unknown>) => request<T>('GET', `${path}${buildQuery(params)}`),
  post: <T = any>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T = any>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T = any>(path: string, body: unknown = {}) => request<T>('DELETE', path, body)
}

// Errores por campo: { title: 'mensaje', 'questions[3].options': '...' }
export function fieldErrorMap(error: unknown): Record<string, string> {
  const map: Record<string, string> = {}
  if (error instanceof AdminApiError) {
    for (const item of error.errors) if (!map[item.field]) map[item.field] = item.message
  }
  return map
}
