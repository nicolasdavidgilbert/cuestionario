import { useState, useEffect } from 'react'

export default function Landing() {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error(r.status)
        return r.json()
      })
      .then(setCatalog)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <div className="page-wrap">
        <div className="error-msg">No se pudo cargar la información.</div>
      </div>
    )
  }

  if (!catalog) {
    return (
      <div className="page-wrap">
        <div className="loading">
          <div className="spinner" />
          Cargando…
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap landing">
      <header className="landing-header">
        <h1>Cuestionarios</h1>
        <p>Elige tu curso para ver los cuestionarios disponibles</p>
        <div className="user-actions">
          <a href="/crear" className="btn-primary">+ Crear Cuestionario</a>
          <a href="/mis-cuestionarios" className="btn-secondary">Mis Cuestionarios</a>
        </div>
      </header>

      <div className="grado-grid">
        {catalog.grados.map((grado, i) => {
          const hasCourses = grado.courses.length > 0
          const totalUnits = grado.courses.reduce((s, c) => s + c.units.length, 0)

          return (
            <a
              key={grado.id}
              href={`/${grado.id}`}
              className={`grado-card ${!hasCourses ? 'empty' : ''}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="grado-icon">{grado.label.charAt(0)}</div>
              <div className="grado-info">
                <span className="grado-label">{grado.label}</span>
                <span className="grado-desc">{grado.description}</span>
                <span className="grado-meta">
                  {hasCourses
                    ? `${grado.courses.length} asignatura${grado.courses.length > 1 ? 's' : ''} · ${totalUnits} tema${totalUnits > 1 ? 's' : ''}`
                    : 'Próximamente'}
                </span>
              </div>
              <span className="grado-arrow">→</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
