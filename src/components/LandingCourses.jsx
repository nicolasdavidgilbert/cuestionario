import { useMemo, useState, useEffect } from 'react'
import { getQuizCatalog } from '../lib/api'

function normalize(value = '') {
  return value.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function buildSearchText(grado) {
  const courseText = grado.courses
    .flatMap((course) => [course.label, course.id, ...course.units.map((unit) => `${unit.id} ${unit.title || ''}`)])
    .join(' ')
  return normalize(`${grado.label} ${grado.description || ''} ${grado.id} ${courseText}`)
}

function buildSearchResults(catalog, query) {
  const normalizedQuery = normalize(query.trim())
  if (!catalog || !normalizedQuery) return []

  const results = []

  catalog.grados.forEach((grado) => {
    const gradeMatches = normalize(`${grado.label} ${grado.description || ''} ${grado.id}`).includes(normalizedQuery)
    const totalUnits = grado.courses.reduce((sum, course) => sum + course.units.length, 0)

    if (gradeMatches) {
      results.push({
        id: `grado:${grado.id}`,
        href: `/${grado.id}`,
        title: grado.label,
        description: grado.description || 'Curso',
        meta: `${grado.courses.length} asignatura${grado.courses.length === 1 ? '' : 's'} · ${totalUnits} tema${totalUnits === 1 ? '' : 's'}`,
        type: 'Curso'
      })
    }

    grado.courses.forEach((course) => {
      const courseMatches = normalize(`${course.label} ${course.id} ${grado.label}`).includes(normalizedQuery)

      if (courseMatches) {
        results.push({
          id: `course:${grado.id}:${course.id}`,
          href: `/${grado.id}`,
          title: course.label,
          description: grado.label,
          meta: `${course.units.length} tema${course.units.length === 1 ? '' : 's'}`,
          type: 'Asignatura'
        })
      }

      course.units.forEach((unit) => {
        const unitMatches = normalize(`${unit.id} ${unit.title || ''} ${course.label} ${grado.label}`).includes(normalizedQuery)

        if (unitMatches) {
          results.push({
            id: `unit:${grado.id}:${course.id}:${unit.id}`,
            href: `/${grado.id}/${course.id}/${unit.id}`,
            title: unit.title || unit.id.toUpperCase(),
            description: `${course.label} · ${grado.label}`,
            meta: 'Cuestionario tipo test',
            type: 'Tema'
          })
        }
      })
    })
  })

  return results
}

export default function LandingCourses({ limit = null, compact = false, showSearch = true, showViewAll = false, searchMode = 'grades', emptyUntilSearch = false, syncUrl = false }) {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [activeType, setActiveType] = useState('all')

  useEffect(() => {
    if (syncUrl && typeof window !== 'undefined') {
      setQuery(new URLSearchParams(window.location.search).get('q') || '')
    }
    loadCatalog()
  }, [])

  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (query.trim()) {
      url.searchParams.set('q', query.trim())
    } else {
      url.searchParams.delete('q')
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [query, syncUrl])

  const loadCatalog = async () => {
    setError(false)
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

  const filteredGrados = useMemo(() => {
    const grados = catalog?.grados || []
    const normalizedQuery = normalize(query.trim())
    if (!normalizedQuery) return grados
    return grados.filter((grado) => buildSearchText(grado).includes(normalizedQuery))
  }, [catalog, query])

  const searchResults = useMemo(() => buildSearchResults(catalog, query), [catalog, query])
  const visibleSearchResults = useMemo(() => {
    if (activeType === 'all') return searchResults
    return searchResults.filter((result) => result.type === activeType)
  }, [activeType, searchResults])
  const hasQuery = Boolean(query.trim())
  const visibleLimit = expanded || hasQuery ? null : limit
  const visibleGrados = visibleLimit ? filteredGrados.slice(0, visibleLimit) : filteredGrados
  const hiddenCount = Math.max(filteredGrados.length - visibleGrados.length, 0)

  return (
    <section className={`grado-grid ${compact ? 'is-compact' : ''} ${hasQuery ? 'has-query' : 'is-idle'} ${loading || !catalog ? 'is-loading' : 'is-ready'}`} aria-labelledby="courses-heading">
      <h2 id="courses-heading" className="sr-only">Cursos disponibles</h2>

      {showSearch && (
        <>
          <form className="catalog-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <label className="sr-only" htmlFor="catalog-search-input">Buscar cuestionarios</label>
            <input
              id="catalog-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar curso, asignatura o tema"
              autoComplete="off"
            />
            {showViewAll && <a className="btn-secondary" href="/cursos">Ver todos los cursos</a>}
          </form>
          {searchMode === 'all' && (
            <div className="filter-tabs" role="tablist" aria-label="Filtrar resultados">
              {[
                ['all', 'Todos'],
                ['Curso', 'Cursos'],
                ['Asignatura', 'Asignaturas'],
                ['Tema', 'Temas']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`filter-tab ${activeType === value ? 'active' : ''}`}
                  onClick={() => setActiveType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {loading || !catalog ? (
        emptyUntilSearch && !hasQuery ? null : (
          <div className="skeleton-list course-list-transition" aria-label="Cargando cursos">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        )
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
      ) : searchMode === 'all' ? (
        !hasQuery && emptyUntilSearch ? (
          <p className="catalog-hint">Escribe para buscar cursos, asignaturas y temas.</p>
        ) : visibleSearchResults.length === 0 ? (
          <div className="empty-state">
            <p>No hay resultados para tu búsqueda.</p>
            <button type="button" className="btn-secondary" onClick={() => setQuery('')}>Limpiar búsqueda</button>
          </div>
        ) : (
          <div className="catalog-results">
            <div className="catalog-summary" aria-live="polite">
              {visibleSearchResults.length} resultado{visibleSearchResults.length === 1 ? '' : 's'}
            </div>
            <div className="course-list-transition search-results-list">
              {visibleSearchResults.map((result) => (
                <a key={result.id} href={result.href} className="grado-card search-result-card">
                  <article className="grado-card-main">
                    <div className="grado-info">
                      <span className="result-type">{result.type}</span>
                      <span className="grado-label">{result.title}</span>
                      <span className="grado-desc">{result.description}</span>
                      <span className="grado-meta">{result.meta}</span>
                    </div>
                    <span className="grado-card-cta">Abrir <span className="grado-arrow" aria-hidden="true">→</span></span>
                  </article>
                </a>
              ))}
            </div>
          </div>
        )
      ) : filteredGrados.length === 0 ? (
        <div className="empty-state">
          <p>No hay cursos que coincidan con tu búsqueda.</p>
          <button type="button" className="btn-secondary" onClick={() => setQuery('')}>Limpiar búsqueda</button>
        </div>
      ) : (
        <>
          <div className="catalog-summary" aria-live="polite">
            {hasQuery
              ? `${filteredGrados.length} resultado${filteredGrados.length === 1 ? '' : 's'}`
              : `${catalog.grados.length} curso${catalog.grados.length === 1 ? '' : 's'} disponibles`}
          </div>
          <div className="course-list-transition">
            {visibleGrados.map((grado) => {
              const totalUnits = grado.courses.reduce((s, c) => s + c.units.length, 0)
              const totalCourses = grado.courses.length
              const hasCourses = totalUnits > 0

              return (
                <a key={grado.id} href={`/${grado.id}`} className={`grado-card ${!hasCourses ? 'empty' : ''}`}>
                  <article className="grado-card-main">
                    <div className="grado-info">
                      <span className="grado-label">{grado.label}</span>
                      <span className="grado-desc">{grado.description || 'Curso'}</span>
                      <span className="grado-meta">
                        {hasCourses
                          ? `${totalCourses} asignatura${totalCourses === 1 ? '' : 's'} · ${totalUnits} tema${totalUnits === 1 ? '' : 's'}`
                          : 'Sin cuestionarios publicados'}
                      </span>
                    </div>
                    <span className="grado-card-cta">
                      {hasCourses ? 'Entrar' : 'Sin contenido'}
                      <span className="grado-arrow" aria-hidden="true">→</span>
                    </span>
                  </article>
                </a>
              )
            })}
          </div>
          {hiddenCount > 0 && (
            <div className="catalog-more-actions">
              <button type="button" className="btn-secondary" onClick={() => setExpanded(true)}>
                Ver {hiddenCount} curso{hiddenCount === 1 ? '' : 's'} más
              </button>
              {showViewAll && <a className="btn-clear" href="/cursos">Abrir catálogo completo</a>}
            </div>
          )}
        </>
      )}
    </section>
  )
}
