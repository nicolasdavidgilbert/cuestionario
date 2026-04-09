import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Catalog from './pages/Catalog'
import Quiz from './pages/Quiz'
import CreateQuiz from './pages/CreateQuiz'
import MyQuizzes from './pages/MyQuizzes'
import UserQuiz from './pages/UserQuiz'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/crear" element={<CreateQuiz />} />
      <Route path="/mis-cuestionarios" element={<MyQuizzes />} />
      <Route path="/:grado" element={<Catalog />} />
      <Route path="/:grado/:curso/:unidad" element={<Quiz />} />
      <Route path="/user-quiz/:id" element={<UserQuiz />} />
    </Routes>
  )
}
