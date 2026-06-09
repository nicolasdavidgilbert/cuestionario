import { useState, useEffect, useMemo } from 'react'
import { getCachedQuizCatalog, getQuizCatalog } from '../lib/api'
import AdSenseAd from './AdSenseAd'

function normalize(value = '') {
  return value.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function Catalog({ grado, adsenseClient, enabledByEnv }) {
  const cachedGrade = getCachedQuizCatalog(grado)?.grados?.find((g) => g.id === grado) || null
  const [gradoData, setGradoData] = useState(cachedGrade)
  const [loading, setLoading] = useState(!cachedGrade)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')

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

  const filteredCourses = useMemo(() => {
    if (!gradoData) return []
    const normalizedQuery = normalize(query.trim())
    if (!normalizedQuery) return gradoData.courses

    return gradoData.courses
      .map((course) => {
        const courseMatches = normalize(`${course.label} ${course.id}`).includes(normalizedQuery)
        const units = courseMatches
          ? course.units
          : course.units.filter((unit) => normalize(`${unit.id} ${unit.title || ''} ${course.label}`).includes(normalizedQuery))
        return { ...course, units }
      })
      .filter((course) => course.units.length > 0)
  }, [gradoData, query])

  const visibleUnitCount = filteredCourses.reduce((sum, course) => sum + course.units.length, 0)

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
              <a href="/cursos">Cursos</a>
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
        <a href="/cursos">Cursos</a>
        <span aria-hidden="true">/</span>
        <span>{gradoData?.label || grado?.toUpperCase()}</span>
      </nav>

      <header className="home-header">
        <p className="section-kicker">Catálogo de cuestionarios</p>
        <h1>{gradoData.label}</h1>
        <p>{gradoData.description || 'Elige una asignatura y unidad para empezar a practicar.'}</p>
      </header>

      {gradoData.courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" />
          <p>Aún no hay cuestionarios para este curso.</p>
          <a href="/crear" className="btn-primary">Crear cuestionario</a>
        </div>
      ) : (
        <section className="course-search-section" aria-labelledby="course-search-heading">
          <h2 id="course-search-heading" className="sr-only">Buscar cuestionarios en {gradoData.label}</h2>
          <form className="catalog-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <label className="sr-only" htmlFor="course-catalog-search">Buscar en este curso</label>
            <input
              id="course-catalog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar asignatura o tema en este curso"
              autoComplete="off"
            />
            {query && (
              <button type="button" className="btn-secondary" onClick={() => setQuery('')}>
                Limpiar
              </button>
            )}
          </form>
          <p className="catalog-summary" aria-live="polite">
            {query.trim()
              ? `${visibleUnitCount} resultado${visibleUnitCount === 1 ? '' : 's'} en este curso`
              : `${visibleUnitCount} cuestionario${visibleUnitCount === 1 ? '' : 's'} disponible${visibleUnitCount === 1 ? '' : 's'}`}
          </p>
        </section>
      )}

      {gradoData.courses.length > 0 && filteredCourses.length === 0 && (
        <div className="empty-state">
          <p>No hay cuestionarios que coincidan con tu búsqueda en este curso.</p>
          <button type="button" className="btn-secondary" onClick={() => setQuery('')}>Limpiar búsqueda</button>
        </div>
      )}

      {filteredCourses.map((course) => (
        <section key={course.id} className="course-section">
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

      <AdSenseAd slot={import.meta.env.PUBLIC_ADSENSE_SLOT || "4731901740"} className="ad-slot ad-slot--wide" clientId={adsenseClient} enabledByEnv={enabledByEnv} />
    </div>
  )
}
