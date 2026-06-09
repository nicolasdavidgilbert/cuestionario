import { useState, useEffect, useMemo } from 'react'
import { getCachedQuizCatalog, getQuizCatalog } from '../lib/api'
import AdSenseAd from './AdSenseAd'

function normalize(value = '') {
  return value.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function buildStaticGrade(grado) {
  return {
    id: grado,
    label: grado?.toUpperCase() || 'Curso',
    description: 'Elige una asignatura y unidad para empezar a practicar.',
    courses: []
  }
}

function getCachedGrade(grado) {
  return getCachedQuizCatalog(grado)?.grados?.find((g) => g.id === grado) || null
}

function hasVisibleCatalogData(grade) {
  return Boolean(grade?.courses?.length)
}

function CatalogLoadingSections({ courses = [] }) {
  const skeletonCourses = courses.length > 0
    ? courses.map((course, index) => ({
      id: course.id || `course-${index}`,
      units: Array.from({ length: Math.max(course.units?.length || 0, 1) })
    }))
    : [
      { id: 'course-1', units: Array.from({ length: 3 }) },
      { id: 'course-2', units: Array.from({ length: 2 }) }
    ]

  return (
    <div className="catalog-loading-sections" aria-label="Cargando cuestionarios">
      {skeletonCourses.map((course) => (
        <section key={course.id} className="course-section course-section--skeleton" aria-hidden="true">
          <div className="skeleton-heading" />
          <div className="unit-grid">
            {course.units.map((_, index) => (
              <div key={index} className="skeleton-card skeleton-card--unit" />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default function Catalog({ grado, adsenseClient, enabledByEnv }) {
  const initialCachedGrade = getCachedGrade(grado)
  const [gradoData, setGradoData] = useState(initialCachedGrade || buildStaticGrade(grado))
  const [initialLoading, setInitialLoading] = useState(!hasVisibleCatalogData(initialCachedGrade))
  const [refreshing, setRefreshing] = useState(hasVisibleCatalogData(initialCachedGrade))
  const [error, setError] = useState(null)
  const [softError, setSoftError] = useState(false)
  const [cacheCheckedFor, setCacheCheckedFor] = useState(null)
  const [query, setQuery] = useState('')

  const activeCachedGrade = useMemo(() => getCachedGrade(grado), [grado])
  const displayedGradeData = gradoData?.id === grado
    ? gradoData
    : activeCachedGrade || buildStaticGrade(grado)
  const displayedInitialLoading = gradoData?.id === grado
    ? initialLoading
    : !hasVisibleCatalogData(activeCachedGrade)

  useEffect(() => {
    let ignore = false
    const cachedGrade = getCachedGrade(grado)
    const hasCachedData = hasVisibleCatalogData(cachedGrade)

    setQuery('')
    setGradoData(cachedGrade || buildStaticGrade(grado))
    setInitialLoading(!hasCachedData)
    setRefreshing(hasCachedData)
    setError(null)
    setSoftError(false)
    setCacheCheckedFor(grado)

    async function loadCatalog() {
      try {
        const data = await getQuizCatalog(grado)
        if (ignore) return

        const found = data.grados?.find((g) => g.id === grado)
        if (!found || !found?.courses?.length) {
          if (hasCachedData) {
            setSoftError(true)
          } else {
            setError(new Error(`No se encontró el curso ${grado}.`))
          }
          return
        }

        setGradoData(found)
        setError(null)
        setSoftError(false)
      } catch (e) {
        if (ignore) return
        console.error(e)

        if (hasCachedData) {
          setSoftError(true)
        } else {
          setError(e instanceof Error ? e : new Error('No se pudo cargar el catálogo.'))
        }
      } finally {
        if (!ignore) {
          setInitialLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadCatalog()

    return () => {
      ignore = true
    }
  }, [grado])

  const filteredCourses = useMemo(() => {
    const courses = displayedGradeData?.courses || []
    const normalizedQuery = normalize(query.trim())
    if (!normalizedQuery) return courses

    return courses
      .map((course) => {
        const units = course.units || []
        const courseMatches = normalize(`${course.label} ${course.id}`).includes(normalizedQuery)
        const visibleUnits = courseMatches
          ? units
          : units.filter((unit) => normalize(`${unit.id} ${unit.title || ''} ${course.label}`).includes(normalizedQuery))
        return { ...course, units: visibleUnits }
      })
      .filter((course) => course.units.length > 0)
  }, [displayedGradeData, query])

  const visibleUnitCount = filteredCourses.reduce((sum, course) => sum + (course.units?.length || 0), 0)
  const hasCourses = Boolean(displayedGradeData?.courses?.length)
  const isCheckingCache = cacheCheckedFor !== grado && !hasCourses
  const showInitialSkeleton = !isCheckingCache && displayedInitialLoading
  const reserveSummary = isCheckingCache || showInitialSkeleton

  return (
    <div className="page-wrap">
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <a href="/">Inicio</a>
        <span aria-hidden="true">/</span>
        <a href="/cursos">Cursos</a>
        <span aria-hidden="true">/</span>
        <span>{displayedGradeData?.label || grado?.toUpperCase()}</span>
      </nav>

      <header className="home-header">
        <p className="section-kicker">Catálogo de cuestionarios</p>
        <h1>{displayedGradeData.label}</h1>
        <p>{displayedGradeData.description || 'Elige una asignatura y unidad para empezar a practicar.'}</p>
      </header>

      <section className="course-search-section" aria-labelledby="course-search-heading">
        <h2 id="course-search-heading" className="sr-only">Buscar cuestionarios en {displayedGradeData.label}</h2>
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
        <div className="catalog-summary-row">
          <p className="catalog-summary catalog-summary--reserved" aria-live="polite">
            {reserveSummary ? (
              <span className="catalog-summary-placeholder" aria-hidden="true">00 cuestionarios disponibles</span>
            ) : query.trim() ? (
              `${visibleUnitCount} resultado${visibleUnitCount === 1 ? '' : 's'} en este curso`
            ) : (
              `${visibleUnitCount} cuestionario${visibleUnitCount === 1 ? '' : 's'} disponible${visibleUnitCount === 1 ? '' : 's'}`
            )}
          </p>
          {refreshing && <span className="catalog-refreshing-indicator">Actualizando...</span>}
        </div>
        {softError && (
          <p className="catalog-soft-error" role="status">No se pudo actualizar, mostrando datos guardados.</p>
        )}
      </section>

      {isCheckingCache || showInitialSkeleton ? (
        <CatalogLoadingSections />
      ) : error && !hasCourses ? (
        <div className="error-msg">No se encontró el curso «{grado}».</div>
      ) : !hasCourses ? (
        <div className="empty-state">
          <div className="empty-icon" />
          <p>Aún no hay cuestionarios para este curso.</p>
          <a href="/crear" className="btn-primary">Crear cuestionario</a>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="empty-state">
          <p>No hay cuestionarios que coincidan con tu búsqueda en este curso.</p>
          <button type="button" className="btn-secondary" onClick={() => setQuery('')}>Limpiar búsqueda</button>
        </div>
      ) : (
        filteredCourses.map((course) => (
          <section key={course.id} className="course-section">
            <h2>{course.label}</h2>
            <div className="unit-grid">
              {(course.units || []).map((unit) => (
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
        ))
      )}

      <AdSenseAd slot={import.meta.env.PUBLIC_ADSENSE_SLOT || "4731901740"} className="ad-slot ad-slot--wide" clientId={adsenseClient} enabledByEnv={enabledByEnv} />
    </div>
  )
}
