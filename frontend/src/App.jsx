import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './components/HomePage'
import AnalyzePage from './components/AnalyzePage'
import HistoryPage from './components/HistoryPage'
import SourcesPage from './components/SourcesPage'
import ExamplesPage from './components/ExamplesPage'
import AboutPage from './components/AboutPage'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"         element={<HomePage />} />
        <Route path="/analyze"  element={<AnalyzePage />} />
        <Route path="/history"  element={<HistoryPage />} />
        <Route path="/sources"  element={<SourcesPage />} />
        <Route path="/examples" element={<ExamplesPage />} />
        <Route path="/about"    element={<AboutPage />} />
        {/* Catch-all → home */}
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
