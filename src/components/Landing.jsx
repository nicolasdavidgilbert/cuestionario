import { useState, useEffect } from 'react'
import { getCachedQuizCatalog, getQuizCatalog } from '../lib/api'
import AdSenseAd from './AdSenseAd'

const FAQ_ITEMS = [
  {
    question: '¿Para qué sirve Cuestionarios?',
    answer: 'Sirve para practicar exámenes tipo test por curso, asignatura y unidad. La prioridad es entrar, elegir un curso y empezar a estudiar.'
  },
  {
    question: '¿Puedo crear cuestionarios desde un PDF?',
    answer: 'Sí. Puedes subir un PDF con texto y la app genera preguntas tipo test con IA para que puedas revisarlas y guardarlas.'
  },
  {
    question: '¿Qué pasa si el PDF es muy largo?',
    answer: 'El sistema divide el contenido en partes pequeñas para respetar los límites de la IA y une las preguntas en un único cuestionario.'
  },
  {
    question: '¿Necesito registrarme?',
    answer: 'No para practicar cuestionarios públicos. Las herramientas de creación y gestión están pensadas para mantener el contenido ordenado.'
  }
]

export { FAQ_ITEMS }

export default function Landing({ adsenseClient, enabledByEnv }) {
  const [catalog, setCatalog] = useState(() => getCachedQuizCatalog())
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(() => !getCachedQuizCatalog())

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
    <div className="page-wrap landing">
      <header className="landing-header">
        <h1>Cuestionarios</h1>
        <p>Elige tu curso para ver los cuestionarios disponibles</p>
        <div className="user-actions">
          <a href="/crear" className="btn-primary">+ Crear Cuestionario</a>
          <a href="/prompt" className="btn-secondary">Prompt IA</a>
          <a href="/mis-cuestionarios" className="btn-secondary">Mis Cuestionarios</a>
        </div>
      </header>

      <AdSenseAd slot="4731901740" className="ad-slot ad-slot--wide" clientId={adsenseClient} enabledByEnv={enabledByEnv} />

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
              const hasCourses = totalUnits > 0

              return (
                <a
                  key={grado.id}
                  href={`/${grado.id}`}
                  className={`grado-card ${!hasCourses ? 'empty' : ''}`}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="grado-icon">{grado.label.charAt(0)}</div>
                  <div className="grado-info">
                    <span className="grado-label">{grado.label}</span>
                    <span className="grado-desc">{grado.description || 'Curso'}</span>
                    <span className="grado-meta">
                      {hasCourses
                        ? `${grado.courses.length} asignatura${grado.courses.length > 1 ? 's' : ''} · ${totalUnits} tema${totalUnits > 1 ? 's' : ''}`
                        : 'Sin cuestionarios'}
                    </span>
                  </div>
                  <span className="grado-arrow" aria-hidden="true">→</span>
                </a>
              )
            })}
          </div>
        )}
      </section>

      <section className="landing-info" aria-labelledby="project-heading">
        <div className="info-copy">
          <p className="section-kicker">Sobre el proyecto</p>
          <h2 id="project-heading">Una app sencilla para estudiar con cuestionarios reales</h2>
          <p>
            Cuestionarios está pensada para practicar rápido: eliges un curso, entras en una unidad y respondes preguntas tipo test.
            La parte importante es el catálogo de cuestionarios; todo lo demás está para ayudarte a crear y ordenar mejor el material.
          </p>
          <p>
            Si tienes apuntes o temarios en PDF, puedes generar un cuestionario con IA, revisar las preguntas y guardarlo para practicarlo después.
          </p>
        </div>
        <div className="info-card" aria-label="Resumen de funcionamiento">
          <span className="info-card-label">Flujo rápido</span>
          <ol>
            <li>Elige tu curso.</li>
            <li>Selecciona asignatura y unidad.</li>
            <li>Practica el test y revisa tus respuestas.</li>
          </ol>
        </div>
      </section>

      <section className="landing-steps" aria-labelledby="how-heading">
        <p className="section-kicker">Cómo funciona</p>
        <h2 id="how-heading">Del temario al test en pocos pasos</h2>
        <div className="steps-grid">
          <article>
            <span>01</span>
            <h3>Practica por curso</h3>
            <p>Los cuestionarios se organizan por grado, asignatura y unidad para que encuentres rápido lo que necesitas estudiar.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Crea desde PDF</h3>
            <p>Sube un documento con texto y la app genera preguntas tipo test con opciones, respuesta correcta y explicación.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Revisa y mejora</h3>
            <p>Antes de guardar, puedes comprobar las preguntas generadas y ajustar título, curso o unidad.</p>
          </article>
        </div>
      </section>

      <section className="landing-faq" aria-labelledby="faq-heading">
        <p className="section-kicker">Preguntas frecuentes</p>
        <h2 id="faq-heading">FAQ sobre los cuestionarios</h2>
        <div className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
