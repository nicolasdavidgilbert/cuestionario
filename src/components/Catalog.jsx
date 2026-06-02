import { useState, useEffect } from 'react'
import { getCachedQuizCatalog, getQuizCatalog } from '../lib/api'
import AdSenseAd from './AdSenseAd'

export default function Catalog({ grado, adsenseClient, enabledByEnv }) {
  const cachedGrade = getCachedQuizCatalog(grado)?.grados?.find((g) => g.id === grado) || null
  const [gradoData, setGradoData] = useState(cachedGrade)
  const [loading, setLoading] = useState(!cachedGrade)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadCatalog()
  }, [grado])

  const loadCatalog = async () => {
    setLoading(true)
    setError(false)
    
    try {
      const data = await getQuizCatalog(grado)
      
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
          <div className="catalog-skeleton" aria-label="Cargando cuestionarios">
            <a href="/" className="quiz-back">← Volver a cursos</a>
            <div className="skeleton-title" />
            <div className="skeleton-list">
              <div className="skeleton-card" />
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
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
          <div className="empty-icon" aria-hidden="true">0</div>
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

      <AdSenseAd slot="4731901740" className="ad-slot ad-slot--wide" clientId={adsenseClient} enabledByEnv={enabledByEnv} />
    </div>
  )
}
