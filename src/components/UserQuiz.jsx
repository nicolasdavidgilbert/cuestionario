import { useState, useEffect } from 'react'
import { getQuizById } from '../lib/api'

export default function UserQuiz({ id }) {
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadQuiz()
  }, [id])

  const loadQuiz = async () => {
    try {
      const data = await getQuizById(Number(id))
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
          <a href="/" className="quiz-back">← Volver al inicio</a>

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
            Reintentar
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
          Enviar Respuestas
        </button>
      </div>
    </div>
  )
}