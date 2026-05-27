import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './components/HomePage'
import AnalyzePage from './components/AnalyzePage'
import HistoryPage from './components/HistoryPage'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"        element={<HomePage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/history" element={<HistoryPage />} />
        {/* Catch-all → home */}
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
