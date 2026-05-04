import { useState, useEffect, useMemo } from 'react'
import { getQuizzesByGrado, reportQuiz } from '../lib/api'

export default function Quiz({ grado, curso, unidad }) {
  const [quizId, setQuizId] = useState(null)
  const [allQuestions, setAllQuestions] = useState(null)
  const [pageTitle, setPageTitle] = useState('')
  const [error, setError] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState('Contenido incorrecto')
  const [reportReason, setReportReason] = useState('')
  const [reportMessage, setReportMessage] = useState('')
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    loadQuiz()
  }, [grado, curso, unidad])

  const loadQuiz = async () => {
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
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const questions = useMemo(() => {
    if (!allQuestions) return []
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, 15)
  }, [allQuestions])

  useEffect(() => {
    if (pageTitle) document.title = pageTitle
  }, [pageTitle])

  const answeredCount = Object.keys(answers).length
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0

  function handleSelect(qIndex, optionIndex) {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }))
  }

  function handleSubmit() {
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleRetry() {
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
        <a href={`/${grado}`} className="quiz-back"><span>←</span> Volver al catálogo</a>
        <div className="error-msg">
          No se encontraron preguntas para <strong>{curso?.toUpperCase()}/{unidad?.toUpperCase()}</strong>
        </div>
      </div>
    )
  }

  if (loading || !allQuestions) {
    return (
      <div className="page-wrap">
        <div className="loading">
          <div className="spinner" />
          Cargando preguntas…
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
          <a href={`/${grado}`} className="quiz-back"><span>←</span> Volver al catálogo</a>

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

          <button className="retry-btn" onClick={handleRetry}>
            <span>🔄</span> Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <div className="quiz-container">
        <a href={`/${grado}`} className="quiz-back"><span>←</span> Volver al catálogo</a>

        <div className="quiz-header">
          <h1>{pageTitle || `${curso?.toUpperCase()} — ${unidad?.toUpperCase()}`}</h1>
          <div className="quiz-progress">
            <span>{answeredCount}/{questions.length} respondidas</span>
            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="quiz-actions">
          <button type="button" className="btn-secondary" onClick={() => setReportOpen((open) => !open)}>
            <span>{reportOpen ? '✕' : '🚩'}</span>
            {reportOpen ? 'Cerrar reporte' : 'Reportar'}
          </button>
        </div>

        {reportOpen && (
          <section className="report-box" aria-label="Reportar cuestionario">
            <h2><span>🚩</span> Reportar este cuestionario</h2>
            <form onSubmit={handleReport}>
              <label>
                Motivo
                <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                  <option>Contenido incorrecto</option>
                  <option>Preguntas repetidas</option>
                  <option>Opciones confusas</option>
                  <option>Contenido ofensivo</option>
                  <option>Otro problema</option>
                </select>
              </label>
              <label>
                Explica qué pasa
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe el problema para poder revisarlo"
                  rows={4}
                  maxLength={500}
                />
              </label>
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
          </div>
        ))}

        <button className="submit-btn" onClick={handleSubmit}>
          <span>🚀</span> Enviar Respuestas
        </button>
      </div>
    </div>
  )
}
