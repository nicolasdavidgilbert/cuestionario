import { useState, useEffect } from 'react'
import { deleteQuiz, getPaginatedQuizzes } from '../lib/api'
import { getOwnerToken } from '../lib/ownerToken'

const PAGE_SIZE = 24

export default function MyQuizzes() {
  const [quizzes, setQuizzes] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    loadQuizzes(page)
  }, [page])

  const loadQuizzes = async (targetPage = page) => {
    setLoading(true)
    try {
      const data = await getPaginatedQuizzes({
        limit: PAGE_SIZE,
        offset: targetPage * PAGE_SIZE,
        q: search.trim(),
        owner: 'me',
        ownerToken: getOwnerToken()
      })
      setQuizzes(data.quizzes)
      setTotal(data.total)
      setError('')
    } catch (e) {
      setError('Error al cargar cuestionarios')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(0)
    loadQuizzes(0)
  }

  const handleDelete = async (quizId) => {
    if (!window.confirm('¿Eliminar este cuestionario? Se ocultará del catálogo.')) return

    setDeletingId(quizId)
    try {
      await deleteQuiz(quizId, getOwnerToken())
      await loadQuizzes()
    } catch (e) {
      setError('No se pudo eliminar: ' + e.message)
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="loading">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <a href="/" className="quiz-back">← Volver</a>

      <header className="home-header">
        <h1>Mis Cuestionarios</h1>
        <p>Cuestionarios que puedes eliminar desde este navegador</p>
      </header>

      <form className="quiz-list-controls" onSubmit={handleSearchSubmit}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, curso, unidad..."
        />
        <button type="submit" className="btn-validate"><span>🔍</span> Buscar</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <p>No tienes cuestionarios creados en este navegador.</p>
          <a href="/crear" className="btn-primary"><span>✨</span> Crear el primero</a>
        </div>
      ) : (
        <div className="unit-grid">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="unit-card quiz-list-card">
              <a href={`/user-quiz/${quiz.id}`}>
                <span className="unit-badge">{(quiz.unidad || quiz.course_id).toUpperCase()}</span>
                {quiz.title && <span className="unit-title">{quiz.title}</span>}
              </a>
              <div className="quiz-card-actions">
                <a href={`/user-quiz/${quiz.id}`} className="btn-secondary">
                  <span>📂</span> Abrir
                </a>
                <button
                  type="button"
                  className="btn-clear btn-danger"
                  onClick={() => handleDelete(quiz.id)}
                  disabled={deletingId === quiz.id}
                >
                  <span>{deletingId === quiz.id ? '⏳' : '🗑️'}</span>
                  {deletingId === quiz.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button type="button" className="btn-validate" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ← Anterior
          </button>
          <span>Página {page + 1} de {totalPages}</span>
          <button type="button" className="btn-validate" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
