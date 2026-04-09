import { useState, useEffect } from 'react'
import { getQuizById } from '../lib/api'

export default function UserQuiz({ id }) {
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadQuiz()
  }, [id])

  const loadQuiz = async () => {
    try {
      const data = await getQuizById(Number(id))
      setQuiz(data)
      setQuestions(data.questions || [])
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (index) => {
    if (answered) return
    setSelected(index)
    setAnswered(true)
    if (index === questions[currentQ].answer) {
      setScore(score + 1)
    }
  }

  const nextQuestion = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1)
      setSelected(null)
      setAnswered(false)
    } else {
      setFinished(true)
    }
  }

  const restart = () => {
    setCurrentQ(0)
    setSelected(null)
    setAnswered(false)
    setScore(0)
    setFinished(false)
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

  if (finished) {
    const percentage = Math.round((score / questions.length) * 100)
    return (
      <div className="page-wrap">
        <div className="results-card">
          <h2>¡Completado!</h2>
          <div className="score-big">{score}/{questions.length}</div>
          <div className="score-percentage">{percentage}% correctas</div>
          <p className="score-message">
            {percentage === 100 ? '¡Perfecto!' :
             percentage >= 70 ? '¡Muy bien!' :
             percentage >= 50 ? 'Sigue practicando' : 'Hay que repasar'}
          </p>
          <button onClick={restart} className="btn-restart">Reintentar</button>
        </div>
      </div>
    )
  }

  const q = questions[currentQ]

  return (
    <div className="page-wrap">
      <header className="quiz-header">
        <div className="quiz-title-wrap">
          <h1>{quiz.title || 'Cuestionario'}</h1>
          {quiz.description && <p className="quiz-description">{quiz.description}</p>}
        </div>
        <div className="quiz-progress">
          <span>{currentQ + 1}/{questions.length}</span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <div className="question-card">
        <div className="question-text">{q.question}</div>

        <div className="options-list">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={answered}
              className={`option-btn ${selected === i ? (i === q.answer ? 'correct' : 'wrong') : ''} ${answered && i === q.answer ? 'correct' : ''}`}
            >
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
              <span className="option-text">{opt}</span>
            </button>
          ))}
        </div>

        {answered && (
          <div className={`explanation ${selected === q.answer ? 'correct' : 'wrong'}`}>
            <p><strong>{selected === q.answer ? '¡Correcto!' : 'Incorrecto'}</strong></p>
            {q.explanation && <p>{q.explanation}</p>}
          </div>
        )}
      </div>

      {answered && (
        <button onClick={nextQuestion} className="btn-next">
          {currentQ < questions.length - 1 ? 'Siguiente →' : 'Ver resultado'}
        </button>
      )}
    </div>
  )
}
