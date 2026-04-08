import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Catalog from './pages/Catalog'
import Quiz from './pages/Quiz'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/:grado" element={<Catalog />} />
      <Route path="/:grado/:curso/:unidad" element={<Quiz />} />
    </Routes>
  )
}
