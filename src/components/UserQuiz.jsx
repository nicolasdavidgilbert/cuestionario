import usePendingDeletion from './usePendingDeletion'
import useExitTransition from './useExitTransition'
import UndoToast from './UndoToast'
import { scrollBehavior } from '../lib/motion'
import { useState, useEffect, useRef } from 'react'
import * as Sentry from '@sentry/astro'
import { getQuizById, reportQuiz } from '../lib/api'
import { getOwnerToken } from '../lib/ownerToken'
import FloatingActions, { SubmitNotice, scrollToQuestion } from './FloatingActions'

export default function UserQuiz({ id }) {
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState('Contenido incorrecto')
  const [reportReason, setReportReason] = useState('')
  const [reportMessage, setReportMessage] = useState('')
  const [reporting, setReporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deletion = usePendingDeletion()
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const reportTransition = useExitTransition(reportOpen)
  const noticeTransition = useExitTransition(confirmSubmit)
  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') { setReportOpen(false); setConfirmSubmit(false) }
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [])
  const submitButtonRef = useRef(null)
  const retryButtonRef = useRef(null)

  useEffect(() => {
    loadQuiz()
  }, [id])

  function shuffleQuestions(questionsList) {
    const shuffled = [...questionsList]

    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    return shuffled
  }

  const loadQuiz = async () => {
    try {
      const data = await getQuizById(Number(id), getOwnerToken())
      setQuiz(data)
      const allQuestions = data.questions || []
      const shuffled = shuffleQuestions(allQuestions)
      setQuestions(shuffled.slice(0, 15))
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'user-quiz-load' } })
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (qIndex, optionIndex) => {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }))
    setConfirmSubmit(false)
  }

  const nextUnanswered = questions.findIndex((_, i) => answers[i] === undefined)

  const goToNextUnanswered = () => {
    setConfirmSubmit(false)
    if (nextUnanswered >= 0) scrollToQuestion(nextUnanswered)
  }

  const requestSubmit = () => {
    if (nextUnanswered >= 0) {
      setConfirmSubmit(true)
      return
    }
    handleSubmit()
  }

  const handleSubmit = () => {
    setConfirmSubmit(false)
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: scrollBehavior() })
  }

  const handleRetry = () => {
    window.location.reload()
  }

  const handleReport = async (e) => {
    e.preventDefault()

    setReporting(true)
    try {
      await reportQuiz(Number(id), `${reportType}: ${reportReason.trim()}`)
      setReportReason('')
      setReportMessage('Reporte enviado. Gracias por avisar.')
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'user-quiz-report' } })
      setReportMessage(error.message)
    } finally {
      setReporting(false)
    }
  }

  const handleDelete = () => {
    setDeleting(true)
    deletion.schedule(Number(id), (error) => {
      setDeleting(false)
      if (error) {
        Sentry.captureException(error, { tags: { feature: 'user-quiz-delete' } })
        setReportOpen(true)
        setReportMessage('No se pudo eliminar: ' + error.message)
      }
    }, () => { window.location.href = '/mis-cuestionarios' })
  }

  const answeredCount = Object.keys(answers).length
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0

  const submitNotice = noticeTransition.mounted && (
    <SubmitNotice
      state={noticeTransition.state}
      missing={questions.length - answeredCount}
      onGoToNext={goToNextUnanswered}
      onSubmit={handleSubmit}
      onClose={() => setConfirmSubmit(false)}
    />
  )

  const deletionToast = deletion.toast && <UndoToast key={deletion.toast.key} message="Cuestionario eliminado" onUndo={deletion.toast.onUndo} onExpire={deletion.toast.onExpire} />

  if (deleting) return (
    <div className="page-wrap">
      {deletionToast}
      <p>Cuestionario eliminado.</p>
      <a href="/mis-cuestionarios" className="quiz-back">← Mis cuestionarios</a>
    </div>
  )

  if (loading) {
    return (
      <div className="page-wrap">
        {deletionToast}
        <div className="loading">Cargando...</div>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="page-wrap">
        {deletionToast}
        <a href="/" className="quiz-back">← Volver</a>
        <div className="error-msg">Cuestionario no encontrado.</div>
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
        {deletionToast}
        <div className="quiz-container results">
          <a href="/" className="quiz-back"><span>←</span> Volver al inicio</a>

          <div className="results-summary">
            <h2>Resultado</h2>
            <div className="score-display">
              {score}/{questions.length}
            </div>
            <p className="score-label">
              {score === questions.length
                ? '¡Perfecto!'
                : score >= questions.length * 0.7
                ? '¡Muy bien!'
                : 'Sigue practicando'}
            </p>
          </div>

          {questions.map((q, i) => {
            const userAnswer = answers[i] ?? null
            const isCorrect = userAnswer === q.answer

            return (
              <div
                key={i}
                className={`review-card ${isCorrect ? 'correct' : 'incorrect'}`}
                style={{ animationDelay: `${i * 0.05}s` }}
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
              </div>
            )
          })}

          <button ref={retryButtonRef} className="retry-btn" onClick={handleRetry}>
            <span aria-hidden="true">↻</span> Reintentar
          </button>
        </div>

        <FloatingActions notice={submitNotice} anchorRefs={[retryButtonRef]} actions={[
          { label: 'Reintentar', icon: 'retry', onClick: handleRetry },
          quiz.can_delete && { label: 'Editar', icon: 'pencil', variant: 'secondary', href: `/editar/${id}` }
        ]} />
      </div>
    )
  }

  return (
    <div className="page-wrap">
      {deletionToast}
      <div className="quiz-container">
        <a href="/" className="quiz-back">← Volver</a>

        <div className="quiz-header">
          <h1>{quiz.title || 'Cuestionario'}</h1>
          {quiz.description && <p className="quiz-description">{quiz.description}</p>}
          <div className="quiz-progress">
            <span>{answeredCount}/{questions.length} respondidas</span>
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ '--progress': progress / 100 }} />
            </div>
          </div>
        </div>

        <div className="quiz-actions">
          <button type="button" className="btn-secondary" onClick={() => setReportOpen((open) => !open)}>
            <span aria-hidden="true">{reportOpen ? '×' : '!'}</span>
            {reportOpen ? 'Cerrar reporte' : 'Reportar'}
          </button>
          {quiz.can_delete && (
            <a href={`/editar/${id}`} className="btn-secondary">
              <span aria-hidden="true">✎</span> Editar
            </a>
          )}
          {quiz.can_delete && (
            <button type="button" className="btn-clear btn-danger" onClick={handleDelete} disabled={deleting}>
              <span aria-hidden="true">{deleting ? '…' : '×'}</span>
              {deleting ? 'Eliminando...' : 'Eliminar mi cuestionario'}
            </button>
          )}
        </div>

        {reportTransition.mounted && (
          <section data-state={reportTransition.state} className="report-box" aria-label="Reportar cuestionario">
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
          <div
            key={qi}
            id={`question-${qi}`}
            className="question-card"
            style={{ animationDelay: `${qi * 0.04}s` }}
          >
            <h3>
              <span className="question-number">{qi + 1}.</span> {q.question}
            </h3>
            <div>
              {q.options.map((option, oi) => (
                <label
                  key={oi}
                  className={`option-label ${answers[qi] === oi ? 'selected' : ''}`}
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
          </div>
        ))}

        <button ref={submitButtonRef} className="submit-btn" onClick={requestSubmit} disabled={answeredCount === 0}>
          <span aria-hidden="true">✓</span> Enviar respuestas
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
            badge: `${answeredCount}/${questions.length}`
          },
          nextUnanswered >= 0 && { label: 'Siguiente pregunta', icon: 'next', variant: 'secondary', onClick: goToNextUnanswered },
          quiz.can_delete && { label: 'Editar', icon: 'pencil', variant: 'secondary', href: `/editar/${id}` }
        ]}
        notice={submitNotice}
      />
    </div>
  )
}
