const API_BASE = '/api'

const CACHE_PREFIX = 'cuestionarios-cache:'
const PUBLIC_CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry<T> {
  expiresAt: number
  value: T
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
const inflightRequests = new Map<string, Promise<unknown>>()

function canUseBrowserCache() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getCachedValue<T>(key: string): T | null {
  const now = Date.now()
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined

  if (memoryEntry && memoryEntry.expiresAt > now) {
    return memoryEntry.value
  }

  if (!canUseBrowserCache()) return null

  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null

    const entry = JSON.parse(raw) as CacheEntry<T>
    if (!entry || entry.expiresAt <= now) {
      window.localStorage.removeItem(CACHE_PREFIX + key)
      memoryCache.delete(key)
      return null
    }

    memoryCache.set(key, entry)
    return entry.value
  } catch {
    window.localStorage.removeItem(CACHE_PREFIX + key)
    memoryCache.delete(key)
    return null
  }
}

function setCachedValue<T>(key: string, value: T, ttlMs = PUBLIC_CACHE_TTL_MS) {
  const entry: CacheEntry<T> = {
    expiresAt: Date.now() + ttlMs,
    value
  }

  memoryCache.set(key, entry)

  if (!canUseBrowserCache()) return

  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // If storage is full or blocked, memory cache still helps this session.
  }
}

async function cachedFetchJson<T>(key: string, url: string, ttlMs = PUBLIC_CACHE_TTL_MS): Promise<T> {
  const cached = getCachedValue<T>(key)
  if (cached) return cached

  const inflight = inflightRequests.get(key) as Promise<T> | undefined
  if (inflight) return inflight

  const request = fetch(url)
    .then((response) => handleResponse<T>(response))
    .then((value) => {
      setCachedValue(key, value, ttlMs)
      return value
    })
    .finally(() => {
      inflightRequests.delete(key)
    })

  inflightRequests.set(key, request)
  return request
}

export function clearQuizCache() {
  memoryCache.clear()
  inflightRequests.clear()

  if (!canUseBrowserCache()) return

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(CACHE_PREFIX)) {
      window.localStorage.removeItem(key)
    }
  }
}

export interface CatalogUnit {
  id: string
  title: string
}

export interface CatalogCourse {
  id: string
  label: string
  units: CatalogUnit[]
}

export interface CatalogGrade {
  id: string
  label: string
  description: string
  courses: CatalogCourse[]
}

export interface QuizCatalog {
  grados: CatalogGrade[]
}

export interface ApiQuiz {
  id: number
  title: string
  description: string | null
  grado: string
  course_id: string
  unidad: string
  questions: unknown[]
  created_at: string
  deleted_at?: string | null
  can_delete?: boolean
}

export interface PaginatedQuizzes {
  quizzes: ApiQuiz[]
  total: number
}

export interface CreateQuizPayload {
  title: string
  description: string
  grado: string
  course_id: string
  unidad: string
  questions: unknown[]
}

export interface GeneratedQuizPayload extends CreateQuizPayload {
  source: string
  notice?: string
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => '')

    try {
      const json = JSON.parse(body)
      if (json?.message) throw new Error(json.message)
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        const detail = body.trim().replace(/\s+/g, ' ').slice(0, 180)
        throw new Error(detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`)
      }
      throw parseError
    }

    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

export function buildQuery(params: Record<string, string | number | undefined> = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (key === 'ownerToken') return
    if (value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function getOwnerTokenHeader(ownerToken?: string): Record<string, string> {
  return ownerToken ? { 'x-owner-token': ownerToken } : {}
}

export async function getAllQuizzes(params: { limit?: number; offset?: number; q?: string; owner?: string; ownerToken?: string } = {}): Promise<ApiQuiz[]> {
  const query = buildQuery(params)

  if (!params.ownerToken && params.owner !== 'me' && !params.q) {
    return cachedFetchJson<ApiQuiz[]>(`quizzes:${query || 'all'}`, `${API_BASE}/quizzes${query}`)
  }

  const response = await fetch(`${API_BASE}/quizzes${query}`, {
    headers: getOwnerTokenHeader(params.ownerToken)
  })
  return handleResponse<ApiQuiz[]>(response)
}

export async function getPaginatedQuizzes(params: { limit?: number; offset?: number; q?: string; owner?: string; ownerToken?: string } = {}): Promise<PaginatedQuizzes> {
  const response = await fetch(`${API_BASE}/quizzes${buildQuery(params)}`, {
    headers: getOwnerTokenHeader(params.ownerToken)
  })
  const quizzes = await handleResponse<ApiQuiz[]>(response)
  const totalHeader = response.headers.get('X-Total-Count')
  return {
    quizzes,
    total: totalHeader !== null ? Number(totalHeader) : quizzes.length
  }
}

export async function getQuizzesByGrado(grado: string, params: { limit?: number; offset?: number; q?: string } = { limit: 100 }): Promise<ApiQuiz[]> {
  const query = buildQuery({ limit: 100, ...params, grado })

  if (!params.q) {
    return cachedFetchJson<ApiQuiz[]>(`quizzes-by-grado:${query}`, `${API_BASE}/quizzes${query}`)
  }

  const response = await fetch(`${API_BASE}/quizzes${query}`)
  return handleResponse<ApiQuiz[]>(response)
}

export function getCachedQuizCatalog(grado?: string): QuizCatalog | null {
  return getCachedValue<QuizCatalog>(`catalog:${grado || 'all'}`)
}

export function getCachedQuizzesByGrado(grado: string, params: { limit?: number; offset?: number; q?: string } = { limit: 100 }): ApiQuiz[] | null {
  const query = buildQuery({ limit: 100, ...params, grado })
  return getCachedValue<ApiQuiz[]>(`quizzes-by-grado:${query}`)
}

export async function getQuizCatalog(grado?: string): Promise<QuizCatalog> {
  const query = buildQuery({ type: 'catalog', grado })
  return cachedFetchJson<QuizCatalog>(`catalog:${grado || 'all'}`, `${API_BASE}/quizzes${query}`)
}

export async function getQuizById(id: number, ownerToken?: string): Promise<ApiQuiz> {
  if (!ownerToken) {
    return cachedFetchJson<ApiQuiz>(`quiz:${id}`, `${API_BASE}/quizzes/${id}`)
  }

  const response = await fetch(`${API_BASE}/quizzes/${id}`, {
    headers: getOwnerTokenHeader(ownerToken)
  })
  return handleResponse<ApiQuiz>(response)
}

export async function createQuiz(quiz: CreateQuizPayload, ownerToken?: string): Promise<ApiQuiz> {
  const response = await fetch(`${API_BASE}/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getOwnerTokenHeader(ownerToken) },
    body: JSON.stringify(quiz)
  })
  const created = await handleResponse<ApiQuiz>(response)
  clearQuizCache()
  return created
}

export async function generateQuizFromPdf(formData: FormData): Promise<GeneratedQuizPayload> {
  const response = await fetch(`${API_BASE}/generate-quiz-from-pdf`, {
    method: 'POST',
    body: formData
  })
  return handleResponse<GeneratedQuizPayload>(response)
}

export async function deleteQuiz(id: number, ownerToken?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/quizzes/${id}`, {
    method: 'DELETE',
    headers: getOwnerTokenHeader(ownerToken)
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error desconocido' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
  clearQuizCache()
}

export async function reportQuiz(id: number, reason: string): Promise<void> {
  const response = await fetch(`${API_BASE}/quizzes/${id}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error desconocido' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
}
