import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import * as Sentry from '@sentry/astro'
import { getCachedQuizzesByGrado, getQuizzesByGrado, reportQuiz } from '../lib/api'
import FloatingActions, { SubmitNotice, scrollToQuestion } from './FloatingActions'

const TEST_SIZE = 15

function shuffleArray<T>(list: T[]): T[] {
  const shuffled = [...list]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

interface QuizQuestion {
  question: string
  options: string[]
  answer: number
  explanation?: string
}

function asQuestions(value: unknown): QuizQuestion[] {
  if (Array.isArray(value)) return value as QuizQuestion[]
  return []
}

interface Props {
  grado?: string
  curso?: string
  unidad?: string
  quizId?: number | null
  pageTitle?: string | null
  questions?: unknown[] | null
  description?: string | null
  gradeName?: string | null
  courseName?: string | null
  courseDescription?: string | null
}

export default function Quiz({ grado = '', curso = '', unidad = '', quizId: initialQuizId = null, pageTitle: initialPageTitle = null, questions: serverQuestions = null, description = null, gradeName = null, courseName = null, courseDescription = null }: Props) {
  const cachedQuiz = !serverQuestions ? getCachedQuizzesByGrado(grado)?.find(q => q.course_id === curso && (q.unidad || q.course_id) === unidad) || null : null
  const [quizId, setQuizId] = useState(initialQuizId || cachedQuiz?.id || null)
  const [allQuestions, setAllQuestions] = useState<QuizQuestion[] | null>(serverQuestions ? asQuestions(serverQuestions) : cachedQuiz ? asQuestions(cachedQuiz.questions) : null)
  const [pageTitle, setPageTitle] = useState(initialPageTitle || cachedQuiz?.title || '')
  const [error, setError] = useState(false)
  const [mode, setMode] = useState<'browse' | 'test'>('browse')
  const [testQuestions, setTestQuestions] = useState<QuizQuestion[] | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(!serverQuestions && !cachedQuiz)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState('Contenido incorrecto')
  const [reportReason, setReportReason] = useState('')
  const [reportMessage, setReportMessage] = useState('')
  const [reporting, setReporting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  // Modo repaso: por defecto se ven la respuesta correcta y la explicación de cada pregunta.
  const [showAnswers, setShowAnswers] = useState(true)
  const startButtonRef = useRef<HTMLButtonElement>(null)
  const startBottomButtonRef = useRef<HTMLButtonElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  const retryButtonRef = useRef<HTMLButtonElement>(null)

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
      setAllQuestions(asQuestions(quiz.questions))
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'quiz-load' } })
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [grado, curso, unidad])

  useEffect(() => {
    if (cachedQuiz || serverQuestions) return
    loadQuiz()
  }, [cachedQuiz, loadQuiz, grado, curso, unidad, serverQuestions])

  const questions = useMemo<QuizQuestion[]>(() => {
    if (!allQuestions) return []
    return allQuestions
  }, [allQuestions])

  const totalQuestions = questions.length

  function startTest() {
    const shuffled = shuffleArray(totalQuestions ? [...questions] : [])
    setTestQuestions(shuffled.slice(0, Math.min(TEST_SIZE, shuffled.length)))
    setAnswers({})
    setSubmitted(false)
    setMode('test')
    setConfirmSubmit(false)
    setReportOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function backToBrowse() {
    setMode('browse')
    setAnswers({})
    setSubmitted(false)
    setReportOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeQuestions = mode === 'test' && testQuestions ? testQuestions : []
  const answeredCount = Object.keys(answers).length
  const progress = activeQuestions.length > 0 ? (answeredCount / activeQuestions.length) * 100 : 0
  const quizTitle = pageTitle || `${curso?.toUpperCase()} — ${unidad?.toUpperCase()}`
  const gradoLabel = grado?.toUpperCase()
  const cursoLabel = courseName || curso?.toUpperCase()
  const unidadLabel = unidad?.toUpperCase()

  function handleSelect(qIndex: number, optionIndex: number) {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }))
    setConfirmSubmit(false)
  }

  const nextUnanswered = activeQuestions.findIndex((_, i) => answers[i] === undefined)

  function goToNextUnanswered() {
    setConfirmSubmit(false)
    if (nextUnanswered >= 0) scrollToQuestion(nextUnanswered)
  }

  function requestSubmit() {
    if (nextUnanswered >= 0) {
      setConfirmSubmit(true)
      return
    }
    handleSubmit()
  }

  function handleSubmit() {
    setConfirmSubmit(false)
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleRetry() {
    setTestQuestions(null)
    startTest()
  }

  const handleReport = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    if (!quizId) return

    setReporting(true)
    try {
      await reportQuiz(Number(quizId), `${reportType}: ${reportReason.trim()}`)
      setReportReason('')
      setReportMessage('Reporte enviado. Gracias por avisar.')
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'quiz-report' } })
      setReportMessage(error instanceof Error ? error.message : 'Error al reportar')
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

  if (loading || !allQuestions || allQuestions.length === 0) {
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
        </div>
      </div>
    )
  }

  if (mode === 'test') {
    if (submitted) {
      const score = activeQuestions.reduce(
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
              <div className="score-display" aria-label={`Puntuación ${score} de ${activeQuestions.length}`}>
                {score}/{activeQuestions.length}
              </div>
              <p className="score-label">
                {score} correctas y {activeQuestions.length - score} incorrectas.
              </p>
            </section>

            {activeQuestions.map((q, i) => {
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

            <div className="quiz-actions quiz-actions--centered">
              <button ref={retryButtonRef} className="retry-btn" onClick={handleRetry}>
                <span aria-hidden="true">↻</span> Hacer otro test
              </button>
              <button className="btn-secondary" onClick={backToBrowse}>
                Ver todas las preguntas
              </button>
            </div>
          </div>

          <FloatingActions anchorRefs={[retryButtonRef]} actions={[
            { label: 'Hacer otro test', icon: 'retry', onClick: handleRetry },
            { label: 'Ver preguntas', icon: 'list', variant: 'secondary', onClick: backToBrowse }
          ]} />
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
          <p className="section-kicker">Cuestionario — test aleatorio</p>
          <h1>{quizTitle}</h1>
          <p className="help-note">
            {activeQuestions.length} preguntas elegidas al azar de {totalQuestions} disponibles.
          </p>
          <div className="quiz-progress">
            <span>{answeredCount}/{activeQuestions.length} respondidas</span>
            <div
              className="quiz-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={activeQuestions.length}
              aria-valuenow={answeredCount}
              aria-valuetext={`${answeredCount} de ${activeQuestions.length} respondidas`}
              aria-label="Progreso de respuestas"
            >
              <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        <div className="quiz-container">
          <div className="quiz-actions">
            <button type="button" className="btn-secondary" onClick={backToBrowse}>← Ver todas las preguntas</button>
            <button type="button" className="btn-secondary" onClick={handleRetry}>↻ Otro test</button>
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

          {activeQuestions.map((q, qi) => (
            <article
              key={qi}
              id={`question-${qi}`}
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

          <button ref={submitButtonRef} className="submit-btn" onClick={requestSubmit} disabled={answeredCount === 0}>
            Enviar respuestas
          </button>
        </div>

        <FloatingActions
          anchorRefs={[submitButtonRef]}
          actions={[
            {
              label: 'Enviar respuestas',
              icon: 'check',
              onClick: requestSubmit,
              disabled: answeredCount === 0,
              badge: `${answeredCount}/${activeQuestions.length}`
            },
            nextUnanswered >= 0 && { label: 'Siguiente pregunta', icon: 'next', variant: 'secondary', onClick: goToNextUnanswered }
          ]}
          notice={confirmSubmit && nextUnanswered >= 0 && (
            <SubmitNotice
              missing={activeQuestions.length - answeredCount}
              onGoToNext={goToNextUnanswered}
              onSubmit={handleSubmit}
              onClose={() => setConfirmSubmit(false)}
            />
          )}
        />
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
        <p className="section-kicker">{[courseName || cursoLabel, gradeName || gradoLabel].filter(Boolean).join(' · ')}</p>
        <h1>{quizTitle}</h1>
        {description && <p className="quiz-intro">{description}</p>}
        <p className="help-note">
          {totalQuestions} preguntas con su respuesta correcta y una explicación. Repásalas todas aquí o haz un test aleatorio de {Math.min(TEST_SIZE, totalQuestions)} para comprobar lo que sabes.
        </p>
        <button ref={startButtonRef} type="button" className="btn-primary btn-start-test" onClick={startTest}>
          Empezar test aleatorio
        </button>
      </header>

      <div className="quiz-container quiz-browse">
        <section className="study-guide" aria-labelledby="study-guide-heading">
          <h2 id="study-guide-heading">Cómo estudiar este tema</h2>
          <ol>
            <li><strong>Repasa</strong> las preguntas de abajo: cada una muestra la respuesta correcta y por qué lo es.</li>
            <li><strong>Oculta las respuestas</strong> e intenta contestar mentalmente antes de mirarlas.</li>
            <li><strong>Haz el test aleatorio</strong> de {Math.min(TEST_SIZE, totalQuestions)} preguntas y revisa las que falles.</li>
          </ol>
          {courseDescription && (
            <p className="help-note">
              Este tema forma parte de <strong>{courseName || cursoLabel}</strong>{gradeName ? ` (${gradeName})` : ''}: {courseDescription}
            </p>
          )}
        </section>

        <div className="quiz-actions">
          <button type="button" className="btn-secondary" aria-pressed={!showAnswers} onClick={() => setShowAnswers((value) => !value)}>
            {showAnswers ? 'Ocultar respuestas' : 'Mostrar respuestas'}
          </button>
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

        <h2 className="browse-heading">Preguntas y respuestas ({totalQuestions})</h2>

        {questions.map((q, qi) => (
          <article
            key={qi}
            className="question-card"
          >
            <h3>
              <span className="question-number">{qi + 1}.</span> {q.question}
            </h3>
            <ol className="browse-options">
              {q.options.map((option, oi) => {
                const isCorrect = showAnswers && oi === q.answer
                return (
                  <li key={oi} className={`browse-option${isCorrect ? ' is-correct' : ''}`}>
                    {option}
                    {isCorrect && <span className="browse-correct-tag">Correcta</span>}
                  </li>
                )
              })}
            </ol>
            {showAnswers && q.explanation && (
              <p className="browse-explanation"><strong>Explicación:</strong> {q.explanation}</p>
            )}
          </article>
        ))}

        <button ref={startBottomButtonRef} type="button" className="btn-primary btn-start-test btn-start-test--bottom" onClick={startTest}>
          Empezar test aleatorio
        </button>
      </div>

      <FloatingActions
        anchorRefs={[startButtonRef, startBottomButtonRef]}
        actions={[{ label: 'Empezar test', icon: 'play', onClick: startTest }]}
      />
    </div>
  )
}
