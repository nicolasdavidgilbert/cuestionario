import { useState, useEffect } from 'react'
import { getQuizCatalog } from '../lib/api'

export default function LandingCourses() {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCatalog()
  }, [])

  const loadCatalog = async () => {
    try {
      const data = await getQuizCatalog()
      setCatalog(data)
    } catch (e) {
      console.error(e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={`grado-grid ${loading || !catalog ? 'is-loading' : 'is-ready'}`} aria-labelledby="courses-heading">
      <div className="section-kicker">Cuestionarios disponibles</div>
      <h2 id="courses-heading" className="sr-only">Cursos disponibles</h2>
      {loading || !catalog ? (
        <div className="skeleton-list course-list-transition" aria-label="Cargando cursos">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">!</div>
          <p>No se pudo cargar la lista de cursos.</p>
          <button type="button" className="btn-secondary" onClick={loadCatalog}>Reintentar</button>
        </div>
      ) : catalog.grados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">0</div>
          <p>No hay cuestionarios todavía.</p>
          <a href="/crear" className="btn-primary">Crear el primero</a>
        </div>
      ) : (
        <div className="course-list-transition">
          {catalog.grados.map((grado, i) => {
            const totalUnits = grado.courses.reduce((s, c) => s + c.units.length, 0)
            const totalCourses = grado.courses.length
            const hasCourses = totalUnits > 0

            return (
              <a
                key={grado.id}
                href={`/${grado.id}`}
                className={`grado-card ${!hasCourses ? 'empty' : ''}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="grado-card-main">
                  <div className="grado-icon" aria-hidden="true">{grado.label.charAt(0)}</div>
                  <div className="grado-info">
                    <span className="grado-label">{grado.label}</span>
                    <span className="grado-desc">{grado.description || 'Curso'}</span>
                  </div>
                </div>
                <div className="grado-card-side" aria-label={hasCourses ? totalCourses + ' asignaturas y ' + totalUnits + ' temas' : 'Sin cuestionarios'}>
                  <div className="grado-stats">
                    <span className="grado-stat">
                      <strong>{totalCourses}</strong>
                      <span>Asignatura{totalCourses === 1 ? '' : 's'}</span>
                    </span>
                    <span className="grado-stat">
                      <strong>{totalUnits}</strong>
                      <span>Tema{totalUnits === 1 ? '' : 's'}</span>
                    </span>
                  </div>
                  <span className="grado-card-cta">
                    {hasCourses ? 'Ver curso' : 'Sin cuestionarios'}
                    <span className="grado-arrow" aria-hidden="true">→</span>
                  </span>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}
