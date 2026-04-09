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
}

export interface CreateQuizPayload {
  title: string
  description: string
  grado: string
  course_id: string
  unidad: string
  questions: unknown[]
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error desconocido' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
  return response.json()
}

export async function getAllQuizzes(): Promise<ApiQuiz[]> {
  const response = await fetch(`${API_BASE}/quizzes`)
  return handleResponse<ApiQuiz[]>(response)
}

export async function getQuizzesByGrado(grado: string): Promise<ApiQuiz[]> {
  const response = await fetch(`${API_BASE}/quizzes?grado=${encodeURIComponent(grado)}`)
  return handleResponse<ApiQuiz[]>(response)
}

export async function getQuizById(id: number): Promise<ApiQuiz> {
  const response = await fetch(`${API_BASE}/quizzes/${id}`)
  return handleResponse<ApiQuiz>(response)
}

export async function createQuiz(quiz: CreateQuizPayload): Promise<ApiQuiz> {
  const response = await fetch(`${API_BASE}/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quiz)
  })
  return handleResponse<ApiQuiz>(response)
}

export async function deleteQuiz(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/quizzes/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error desconocido' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
}
