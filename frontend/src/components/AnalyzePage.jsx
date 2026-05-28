import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Sparkles, Scale } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import QueryForm from './QueryForm'
import ResultsPanel from './ResultsPanel'
import LoadingSkeleton from './LoadingSkeleton'
import { submitQuery } from '../lib/api'
import { useQueryHistory } from '../hooks/useQueryHistory'

export default function AnalyzePage() {
  const { state: routerState } = useLocation()
  const prefill = routerState?.prefill || null

  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [lastQuery, setLastQuery] = useState(null)
  const [error, setError]     = useState(null)

  const { addEntry } = useQueryHistory()

  async function handleSubmit(payload) {
    setLoading(true)
    setError(null)
    setResult(null)
    setLastQuery(payload)
    try {
      const data = await submitQuery(payload)
      setResult(data)
      addEntry(payload, data)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        'An unexpected error occurred. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    /*
     * Chat-style layout:
     *   - fills the viewport below the fixed navbar (h-16 = 4rem)
     *   - results pane scrolls independently at the top
     *   - input panel is fixed at the bottom — always visible, never scrolls away
     */
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 4rem)', marginTop: '4rem' }}
    >

      {/* ── Scrollable results area (flex-1) ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">

            {/* Error */}
            {error && !loading && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-card border border-red-500/25 bg-red-500/8 p-6"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-red-400 mb-1">Pipeline Error</div>
                    <p className="text-sm text-gray-400">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Loading */}
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-4 glass-card border border-indigo-500/20 bg-indigo-500/5 p-4">
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <div>
                      <div className="text-xs font-semibold text-indigo-400">Running pipeline…</div>
                      <div className="text-xs text-gray-500">Embedding → Retrieval → Generation → Verification</div>
                    </div>
                  </div>
                </div>
                <LoadingSkeleton />
              </motion.div>
            )}

            {/* Results */}
            {result && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ResultsPanel result={result} query={lastQuery} />
              </motion.div>
            )}

            {/* Empty state */}
            {!result && !loading && !error && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-16"
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20
                                flex items-center justify-center mb-5">
                  <Sparkles size={28} className="text-indigo-400" />
                </div>

                <h2 className="text-xl font-semibold text-white mb-2">Litigation Risk Analysis</h2>
                <p className="text-gray-500 text-sm max-w-sm leading-relaxed mb-8">
                  Describe your legal claim and facts below. The pipeline retrieves the closest
                  federal precedent and returns a verified, cite-grounded assessment.
                </p>

                {/* Pipeline steps */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm mb-6">
                  {[
                    { label: 'Embed',    step: '01', desc: 'voyage-3-large' },
                    { label: 'Retrieve', step: '02', desc: 'pgvector HNSW'  },
                    { label: 'Verify',   step: '03', desc: '3-layer check'  },
                  ].map(({ label, step, desc }) => (
                    <div key={step} className="glass-card p-3 text-center">
                      <div className="text-indigo-500 text-xs font-bold font-mono mb-1">{step}</div>
                      <div className="text-xs font-semibold text-white">{label}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{desc}</div>
                    </div>
                  ))}
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600">
                  {[
                    { icon: Sparkles, label: 'RAG-grounded' },
                    { icon: Scale,    label: 'Federal corpus only' },
                    { icon: AlertTriangle, label: 'Not legal advice' },
                  ].map(({ icon: Icon, label }) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <Icon size={11} className="text-gray-600" />
                      {label}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Fixed input panel (always visible at bottom) ─────────────────── */}
      <div className="flex-shrink-0 border-t border-white/[0.07]"
           style={{ background: 'rgba(6,13,31,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-5xl mx-auto">
          <QueryForm
            onSubmit={handleSubmit}
            loading={loading}
            initialValues={prefill}
          />
        </div>
      </div>

    </div>
  )
}
