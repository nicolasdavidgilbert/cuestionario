import UndoToast from './UndoToast'
import usePendingDeletion from './usePendingDeletion'
import { useState, useEffect } from 'react'
import * as Sentry from '@sentry/astro'
import { getPaginatedQuizzes } from '../lib/api'
import { getOwnerToken } from '../lib/ownerToken'
import QuizCard from './QuizCard'
import FloatingActions from './FloatingActions'

const PAGE_SIZE = 24

export default function MyQuizzes() {
  const [quizzes, setQuizzes] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const deletion = usePendingDeletion()

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
      setQuizzes(data.quizzes.filter((quiz) => !deletion.hiddenIds.has(quiz.id)))
      setTotal(Math.max(0, data.total - deletion.hiddenIds.size))
      setError('')
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'my-quizzes-load' } })
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

  const handleDelete = (quizId) => {
    const index = quizzes.findIndex((quiz) => quiz.id === quizId)
    const removed = quizzes[index]
    if (!removed) return
    setQuizzes((items) => items.filter((quiz) => quiz.id !== quizId))
    setTotal((value) => value - 1)
    deletion.schedule(quizId, (error) => {
      setQuizzes((items) => {
        if (items.some((quiz) => quiz.id === quizId)) return items
        const restored = [...items]
        restored.splice(Math.min(index, restored.length), 0, removed)
        return restored
      })
      setTotal((value) => value + 1)
      if (error) {
        Sentry.captureException(error, { tags: { feature: 'my-quizzes-delete' } })
        setError('No se pudo eliminar: ' + error.message)
      }
    })
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  const listContent = loading ? (
    <div className="skeleton-list" aria-label="Cargando cuestionarios">
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
    </div>
  ) : quizzes.length === 0 ? (
    <div className="empty-state">
      <div className="empty-icon" />
      <p>No tienes cuestionarios creados en este navegador.</p>
      <a href="/crear" className="btn-primary"><span aria-hidden="true">+</span> Crear el primero</a>
    </div>
  ) : (
    <div className="unit-grid">
      {quizzes.map((quiz) => (
        <QuizCard
          key={quiz.id}
          href={`/user-quiz/${quiz.id}`}
          badge={[quiz.grado?.toUpperCase(), quiz.course_id].filter(Boolean).join(' · ')}
          title={quiz.title || (quiz.unidad || quiz.course_id || 'Cuestionario').toUpperCase()}
          subtitle={`${quiz.questions?.length || 0} preguntas`}
        >
          <a href={`/editar/${quiz.id}`} className="btn-secondary">
            <span aria-hidden="true">✎</span> Editar
          </a>
          <button
            type="button"
            className="btn-clear btn-danger"
            onClick={() => handleDelete(quiz.id)}
          >
            <span aria-hidden="true">×</span>
            Eliminar
          </button>
        </QuizCard>
      ))}
    </div>
  )

  return (
    <div className="page-wrap">
      <a href="/" className="quiz-back">← Volver</a>

      <header className="home-header">
        <h1>Mis Cuestionarios</h1>
        <p>Cuestionarios que puedes eliminar desde este navegador</p>
      </header>

      <form className="quiz-list-controls" onSubmit={handleSearchSubmit}>
        <label className="sr-only" htmlFor="quiz-search">Buscar cuestionarios</label>
        <input
          id="quiz-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, curso, unidad..."
        />
        <button type="submit" className="btn-validate"><span aria-hidden="true">⌕</span> Buscar</button>
      </form>

      {error && <div className="error-msg" role="alert">{error}</div>}
      {listContent}
      {deletion.toast && <UndoToast key={deletion.toast.key} message="Cuestionario eliminado" onUndo={deletion.toast.onUndo} onExpire={deletion.toast.onExpire} />}

      <FloatingActions actions={[{ label: 'Crear cuestionario', icon: 'plus', href: '/crear' }]} />

      {!loading && !error && total > 0 && totalPages > 1 && (
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
