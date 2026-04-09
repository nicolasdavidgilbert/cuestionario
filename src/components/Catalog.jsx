import { useState, useEffect } from 'react'
import { getQuizzesByGrado } from '../lib/api'

export default function Catalog({ grado }) {
  const [gradoData, setGradoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadCatalog()
  }, [grado])

  const loadCatalog = async () => {
    setLoading(true)
    setError(false)
    
    try {
      const res = await fetch(`/api/quizzes?grado=${encodeURIComponent(grado)}&type=catalog`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      
      const found = data.grados?.find((g) => g.id === grado)
      if (!found || found.courses.length === 0) {
        setError(true)
        setLoading(false)
        return
      }
      
      setGradoData(found)
    } catch (e) {
      console.error(e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

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
          <a href="/crear" className="btn-primary">Crear cuestionario</a>
        </div>
      )}

      {gradoData.courses.map((course, i) => (
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
          </div>
        </section>
      ))}
    </div>
  )
}