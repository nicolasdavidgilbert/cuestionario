import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

export default function Catalog() {
  const { grado } = useParams()
  const [gradoData, setGradoData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error(r.status)
        return r.json()
      })
      .then((catalog) => {
        const found = catalog.grados.find((g) => g.id === grado)
        if (!found) throw new Error('not found')
        setGradoData(found)
      })
      .catch(() => setError(true))
  }, [grado])

  if (error) {
    return (
      <div className="page-wrap">
        <Link to="/" className="quiz-back">← Volver</Link>
        <div className="error-msg">No se encontró el curso «{grado}».</div>
      </div>
    )
  }

  if (!gradoData) {
    return (
      <div className="page-wrap">
        <div className="loading">
          <div className="spinner" />
          Cargando cuestionarios…
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <Link to="/" className="quiz-back">← Volver a cursos</Link>

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

      {gradoData.courses.map((course, i) => (
        <section
          key={course.id}
          className="course-section"
          style={{ animationDelay: `${i * 0.08}s` }}
        >
          <h2>{course.label}</h2>
          <div className="unit-grid">
            {course.units.map((unit) => (
              <Link key={unit.id} to={unit.path} className="unit-card">
                <span className="unit-badge">{unit.id.toUpperCase()}</span>
                {unit.title && <span className="unit-title">{unit.title}</span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
