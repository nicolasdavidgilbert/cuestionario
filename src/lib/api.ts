const API_BASE = '/api'

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
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error desconocido' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
  return response.json()
}

function buildQuery(params: Record<string, string | number | undefined> = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (key === 'ownerToken') return
    if (value !== undefined && value !== '') searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function getOwnerTokenHeader(ownerToken?: string) {
  return ownerToken ? { 'x-owner-token': ownerToken } : {}
}

export async function getAllQuizzes(params: { limit?: number; offset?: number; q?: string; owner?: string; ownerToken?: string } = {}): Promise<ApiQuiz[]> {
  const response = await fetch(`${API_BASE}/quizzes${buildQuery(params)}`, {
    headers: getOwnerTokenHeader(params.ownerToken)
  })
  return handleResponse<ApiQuiz[]>(response)
}

export async function getPaginatedQuizzes(params: { limit?: number; offset?: number; q?: string; owner?: string; ownerToken?: string } = {}): Promise<PaginatedQuizzes> {
  const response = await fetch(`${API_BASE}/quizzes${buildQuery(params)}`, {
    headers: getOwnerTokenHeader(params.ownerToken)
  })
  const quizzes = await handleResponse<ApiQuiz[]>(response)
  return {
    quizzes,
    total: Number(response.headers.get('X-Total-Count') || quizzes.length)
  }
}

export async function getQuizzesByGrado(grado: string, params: { limit?: number; offset?: number; q?: string } = { limit: 100 }): Promise<ApiQuiz[]> {
  const response = await fetch(`${API_BASE}/quizzes${buildQuery({ limit: 100, ...params, grado })}`)
  return handleResponse<ApiQuiz[]>(response)
}

export async function getQuizById(id: number, ownerToken?: string): Promise<ApiQuiz> {
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
  return handleResponse<ApiQuiz>(response)
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
