import { useState, useEffect } from 'react'
import { getQuizzesByGrado } from '../lib/api'

export default function Catalog({ grado }) {
  const [gradoData, setGradoData] = useState(null)
  const [userQuizzes, setUserQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error(r.status)
        return r.json()
      })
      .then(async (catalog) => {
        const found = catalog.grados.find((g) => g.id === grado)
        if (!found) throw new Error('not found')
        setGradoData(found)
        
        try {
          const userQ = await getQuizzesByGrado(grado)
          setUserQuizzes(userQ)
        } catch (e) {
          console.warn('No se pudieron cargar cuestionarios de usuarios')
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [grado])

  if (loading || !gradoData) {
    return (
      <div className="page-wrap">
        {error ? (
          <>
            <a href="/" className="quiz-back">← Volver</a>
            <div className="error-msg">No se encontró el curso «{grado}».</div>
          </>
        ) : (
          <div className="loading">
            <div className="spinner" />
            Cargando cuestionarios…
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <a href="/" className="quiz-back">← Volver a cursos</a>

      <header className="home-header">
        <h1>{gradoData.label}</h1>
        <p>{gradoData.description || 'Elige un tema para empezar a practicar'}</p>
      </header>

      {gradoData.courses.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <p>Aún no hay cuestionarios para este curso.</p>
          <p className="empty-sub">¡Próximamente se añadirán!</p>
        </div>
      )}

      {gradoData.courses.map((course, i) => {
        const courseUserQuizzes = userQuizzes.filter((q) => q.course_id === course.id)
        
        return (
          <section
            key={course.id}
            className="course-section"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <h2>{course.label}</h2>
            <div className="unit-grid">
              {course.units.map((unit) => (
                <a key={unit.id} href={`/${grado}/${course.id}/${unit.id}`} className="unit-card">
                  <span className="unit-badge">{unit.id.toUpperCase()}</span>
                  {unit.title && <span className="unit-title">{unit.title}</span>}
                </a>
              ))}
              {courseUserQuizzes.map((quiz) => (
                <a key={quiz.id} href={`/user-quiz/${quiz.id}`} className="unit-card user-quiz">
                  <span className="unit-badge">USER</span>
                  <span className="unit-title">{quiz.title || `Cuestionario #${quiz.id}`}</span>
                </a>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
