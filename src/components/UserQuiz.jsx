import { useState, useEffect } from 'react'
import { deleteQuiz, getQuizById, reportQuiz } from '../lib/api'
import { getOwnerToken } from '../lib/ownerToken'

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

  useEffect(() => {
    loadQuiz()
  }, [id])

  const loadQuiz = async () => {
    try {
      const data = await getQuizById(Number(id), getOwnerToken())
      setQuiz(data)
      const allQuestions = data.questions || []
      const shuffled = [...allQuestions].sort(() => 0.5 - Math.random())
      setQuestions(shuffled.slice(0, 15))
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (qIndex, optionIndex) => {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }))
  }

  const handleSubmit = () => {
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      setReportMessage(error.message)
    } finally {
      setReporting(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este cuestionario? Se ocultará del catálogo.')) return

    setDeleting(true)
    try {
      await deleteQuiz(Number(id), getOwnerToken())
      window.location.href = '/mis-cuestionarios'
    } catch (error) {
      setReportOpen(true)
      setReportMessage('No se pudo eliminar: ' + error.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="loading">Cargando...</div>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="page-wrap">
        <a href="/" className="quiz-back">← Volver</a>
        <div className="error-msg">Cuestionario no encontrado.</div>
      </div>
    )
  }

  const answeredCount = Object.keys(answers).length
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0

  if (submitted) {
    const score = questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0),
      0
    )

    return (
      <div className="page-wrap">
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
        <a href="/" className="quiz-back">← Volver</a>

        <div className="quiz-header">
          <h1>{quiz.title || 'Cuestionario'}</h1>
          {quiz.description && <p className="quiz-description">{quiz.description}</p>}
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
          {quiz.can_delete && (
            <button type="button" className="btn-clear btn-danger" onClick={handleDelete} disabled={deleting}>
              <span>{deleting ? '⏳' : '🗑️'}</span>
              {deleting ? 'Eliminando...' : 'Eliminar mi cuestionario'}
            </button>
          )}
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
