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
          <p>No hay cuestionarios todavía.</p>
          <a href="/crear" className="btn-primary">Crear el primero</a>
        </div>
      ) : (
        <div className="unit-grid">
          {quizzes.map((quiz) => (
            <a
              key={quiz.id}
              href={`/user-quiz/${quiz.id}`}
              className="unit-card"
            >
              <span className="unit-badge">{(quiz.unidad || quiz.course_id).toUpperCase()}</span>
              {quiz.title && <span className="unit-title">{quiz.title}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}