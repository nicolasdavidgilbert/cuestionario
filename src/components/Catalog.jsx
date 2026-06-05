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
            <nav className="breadcrumbs" aria-label="Migas de pan">
              <a href="/">Inicio</a>
              <span aria-hidden="true">/</span>
              <span>{gradoData?.label || grado?.toUpperCase()}</span>
            </nav>
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
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <a href="/">Inicio</a>
        <span aria-hidden="true">/</span>
        <span>{gradoData?.label || grado?.toUpperCase()}</span>
      </nav>

      <header className="home-header">
        <p className="section-kicker">Catálogo de cuestionarios</p>
        <h1>{gradoData.label}</h1>
        <p>{gradoData.description || 'Elige una asignatura y unidad para empezar a practicar.'}</p>
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
        >
          <h2>{course.label}</h2>
          <div className="unit-grid">
            {course.units.map((unit) => (
              <a key={unit.id} href={`/${grado}/${course.id}/${unit.id}`} className="unit-card">
                <article>
                  <span className="unit-badge">{course.label}</span>
                  <strong>{unit.title || unit.id.toUpperCase()}</strong>
                  <span className="unit-title">Cuestionario tipo test</span>
                </article>
                <span className="unit-action">Empezar</span>
              </a>
            ))}
          </div>
        </section>
      ))}

      <AdSenseAd slot="4731901740" className="ad-slot ad-slot--wide" clientId={adsenseClient} enabledByEnv={enabledByEnv} />
    </div>
  )
}
