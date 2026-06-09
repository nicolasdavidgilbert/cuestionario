import { useState, useEffect, useMemo, useCallback } from 'react'
import { clearQuizCache, getCachedQuizzesByGrado, getQuizzesByGrado, reportQuiz } from '../lib/api'

export default function Quiz({ grado, curso, unidad }) {
  const cachedQuiz = getCachedQuizzesByGrado(grado)?.find(q => q.course_id === curso && (q.unidad || q.course_id) === unidad) || null
  const [quizId, setQuizId] = useState(cachedQuiz?.id || null)
  const [allQuestions, setAllQuestions] = useState(cachedQuiz?.questions || null)
  const [pageTitle, setPageTitle] = useState(cachedQuiz?.title || '')
  const [error, setError] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(!cachedQuiz)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState('Contenido incorrecto')
  const [reportReason, setReportReason] = useState('')
  const [reportMessage, setReportMessage] = useState('')
  const [reporting, setReporting] = useState(false)

  const loadQuiz = useCallback(async () => {
    setLoading(true)
    setError(false)
    setAnswers({})
    setSubmitted(false)
    setReportOpen(false)
    setReportMessage('')
    
    try {
      const quizzes = await getQuizzesByGrado(grado)
      const quiz = quizzes.find(q => q.course_id === curso && (q.unidad || q.course_id) === unidad)
      
      if (!quiz) {
        setError(true)
        setLoading(false)
        return
      }
      
      setQuizId(quiz.id)
      setPageTitle(quiz.title || '')
      const questions = quiz.questions || []
      setAllQuestions(questions)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [grado, curso, unidad])

  useEffect(() => {
    if (cachedQuiz) return
    loadQuiz()
  }, [cachedQuiz, loadQuiz, grado, curso, unidad])

  const questions = useMemo(() => {
    if (!allQuestions) return []
    const shuffled = [...allQuestions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, Math.min(15, shuffled.length))
  }, [allQuestions])

  useEffect(() => {
    if (pageTitle) document.title = pageTitle
  }, [pageTitle])

  const answeredCount = Object.keys(answers).length
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0
  const quizTitle = pageTitle || `${curso?.toUpperCase()} — ${unidad?.toUpperCase()}`
  const gradoLabel = grado?.toUpperCase()
  const cursoLabel = curso?.toUpperCase()
  const unidadLabel = unidad?.toUpperCase()

  function handleSelect(qIndex, optionIndex) {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }))
  }

  function handleSubmit() {
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleRetry() {
    clearQuizCache()
    window.location.reload()
  }

  const handleReport = async (e) => {
    e.preventDefault()
    if (!quizId) return

    setReporting(true)
    try {
      await reportQuiz(Number(quizId), `${reportType}: ${reportReason.trim()}`)
      setReportReason('')
      setReportMessage('Reporte enviado. Gracias por avisar.')
    } catch (error) {
      setReportMessage(error.message)
    } finally {
      setReporting(false)
    }
  }

  if (error) {
    return (
      <div className="page-wrap">
        <nav className="breadcrumbs" aria-label="Migas de pan">
          <a href="/">Inicio</a>
          <span aria-hidden="true">/</span>
          <a href="/cursos">Cursos</a>
          <span aria-hidden="true">/</span>
          <a href={`/${grado}`}>{gradoLabel}</a>
          <span aria-hidden="true">/</span>
          <span>{cursoLabel}</span>
          <span aria-hidden="true">/</span>
          <span>{unidadLabel}</span>
        </nav>
        <div className="error-msg">
          No se encontraron preguntas para <strong>{curso?.toUpperCase()}/{unidad?.toUpperCase()}</strong>
        </div>
      </div>
    )
  }

  if (loading || !allQuestions) {
    return (
      <div className="page-wrap">
        <nav className="breadcrumbs" aria-label="Migas de pan">
          <a href="/">Inicio</a>
          <span aria-hidden="true">/</span>
          <a href="/cursos">Cursos</a>
          <span aria-hidden="true">/</span>
          <a href={`/${grado}`}>{gradoLabel}</a>
          <span aria-hidden="true">/</span>
          <span>{cursoLabel}</span>
          <span aria-hidden="true">/</span>
          <span>{unidadLabel}</span>
        </nav>
        <div className="quiz-skeleton" aria-label="Cargando preguntas">
          <div className="skeleton-title" />
          <div className="skeleton-progress" />
          <div className="skeleton-question" />
          <div className="skeleton-option" />
          <div className="skeleton-option" />
          <div className="skeleton-option" />
          <div className="skeleton-option" />
        </div>
      </div>
    )
  }

  if (submitted) {
    const score = questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0),
      0
    )

    return (
      <div className="page-wrap">
        <div className="quiz-container results">
          <nav className="breadcrumbs" aria-label="Migas de pan">
            <a href="/">Inicio</a>
            <span aria-hidden="true">/</span>
            <a href="/cursos">Cursos</a>
            <span aria-hidden="true">/</span>
            <a href={`/${grado}`}>{gradoLabel}</a>
            <span aria-hidden="true">/</span>
            <span>{cursoLabel}</span>
            <span aria-hidden="true">/</span>
            <span>{unidadLabel}</span>
          </nav>

          <section className="results-summary" aria-labelledby="results-heading">
            <p className="section-kicker">Resultados</p>
            <h1 id="results-heading">Resultado del cuestionario</h1>
            <div className="score-display" aria-label={`Puntuación ${score} de ${questions.length}`}>
              {score}/{questions.length}
            </div>
            <p className="score-label">
              {score} correctas y {questions.length - score} incorrectas.
            </p>
          </section>

          {questions.map((q, i) => {
            const userAnswer = answers[i] ?? null
            const isCorrect = userAnswer === q.answer

            return (
              <article
                key={i}
                className={`review-card ${isCorrect ? 'correct' : 'incorrect'}`}
              >
                <h4>
                  <span className="question-number">{i + 1}.</span> {q.question}
                </h4>
                <p className={`answer-row ${isCorrect ? 'user-correct' : 'user-incorrect'}`}>
                  <strong>Tu respuesta:</strong>{' '}
                  {userAnswer !== null ? q.options[userAnswer] : 'No respondida'}
                </p>
                <p className="answer-row">
                  <strong>Respuesta correcta:</strong> {q.options[q.answer]}
                </p>
                {q.explanation && (
                  <div className="explanation-box">
                    <strong>Explicación:</strong> {q.explanation}
                  </div>
                )}
              </article>
            )
          })}

          <button className="retry-btn" onClick={handleRetry}>
            <span aria-hidden="true">↻</span> Reintentar
          </button>
        </div>
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
        <a href={`/${grado}`}>{gradoLabel}</a>
        <span aria-hidden="true">/</span>
        <span>{cursoLabel}</span>
        <span aria-hidden="true">/</span>
        <span>{unidadLabel}</span>
      </nav>

      <header className="quiz-header">
        <p className="section-kicker">Cuestionario</p>
        <h1>{quizTitle}</h1>
        <div className="quiz-progress">
          <span>{answeredCount}/{questions.length} respondidas</span>
          <div
            className="quiz-progress-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax={questions.length}
            aria-valuenow={answeredCount}
            aria-valuetext={`${answeredCount} de ${questions.length} respondidas`}
            aria-label="Progreso de respuestas"
          >
            <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <div className="quiz-container">
        <div className="quiz-actions">
          <button type="button" className="btn-secondary" onClick={() => setReportOpen((open) => !open)}>
            <span aria-hidden="true">{reportOpen ? '×' : '!'}</span>
            {reportOpen ? 'Cerrar reporte' : 'Reportar'}
          </button>
        </div>

        {reportOpen && (
          <section className="report-box" aria-label="Reportar cuestionario">
            <h2><span aria-hidden="true">!</span> Reportar este cuestionario</h2>
            <form onSubmit={handleReport}>
              <label htmlFor="report-type">
                Motivo
              </label>
              <select id="report-type" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                  <option>Contenido incorrecto</option>
                  <option>Preguntas repetidas</option>
                  <option>Opciones confusas</option>
                  <option>Contenido ofensivo</option>
                  <option>Otro problema</option>
                </select>
              <label htmlFor="report-reason">
                Explica qué pasa
              </label>
              <textarea id="report-reason"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe el problema para poder revisarlo"
                  rows={4}
                  maxLength={500}
                />
              <button type="submit" className="btn-validate" disabled={!reportReason.trim() || reporting}>
                {reporting ? 'Enviando...' : 'Enviar reporte'}
              </button>
              {reportMessage && <p className="help-note">{reportMessage}</p>}
            </form>
          </section>
        )}

        {questions.map((q, qi) => (
          <article
            key={qi}
            className="question-card"
          >
            <h3>
              <span className="question-number">{qi + 1}.</span> {q.question}
            </h3>
            <div>
              {q.options.map((option, oi) => (
                <label
                  key={oi}
                  className={`option-label ${answers[qi] === oi ? 'selected' : ''}`}
                  onClick={() => handleSelect(qi, oi)}
                >
                  <input
                    type="radio"
                    name={`q${qi}`}
                    checked={answers[qi] === oi}
                    onChange={() => handleSelect(qi, oi)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </article>
        ))}

        <button className="submit-btn" onClick={handleSubmit} disabled={answeredCount === 0}>
          Enviar respuestas
        </button>
      </div>
    </div>
  )
}
