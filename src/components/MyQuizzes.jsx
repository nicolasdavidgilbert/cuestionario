import { useState, useEffect } from 'react'
import { getAllQuizzes } from '../lib/api'

export default function MyQuizzes() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadQuizzes()
  }, [])

  const loadQuizzes = async () => {
    setLoading(true)
    try {
      const data = await getAllQuizzes()
      setQuizzes(data)
    } catch (e) {
      setError('Error al cargar cuestionarios')
    } finally {
      setLoading(false)
    }
  }

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
        <p>Cuestionarios creados por usuarios</p>
      </header>

      {error && <div className="error-msg">{error}</div>}

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <p>No hay cuestionarios creados todavía.</p>
          <a href="/crear" className="btn-primary">Crear el primero</a>
        </div>
      ) : (
        <div className="quizzes-list">
          {quizzes.map((quiz) => (
            <a
              key={quiz.id}
              href={`/user-quiz/${quiz.id}`}
              className="quiz-card user-quiz-card"
            >
              <div className="quiz-card-header">
                <span className="quiz-badge">Usuario</span>
                <span className="quiz-date">
                  {new Date(quiz.created_at).toLocaleDateString('es-ES')}
                </span>
              </div>
              <h3>{quiz.title || `Cuestionario #${quiz.id}`}</h3>
              <p className="quiz-meta">{quiz.grado} · {quiz.unidad || quiz.course_id}</p>
              {quiz.description && (
                <p className="quiz-desc">{quiz.description}</p>
              )}
              <p className="quiz-questions">{(quiz.questions || []).length} preguntas</p>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
