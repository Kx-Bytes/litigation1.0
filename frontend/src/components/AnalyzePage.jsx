import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Sparkles, Scale, Maximize2, Minimize2 } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import QueryForm from './QueryForm'
import ResultsPanel from './ResultsPanel'
import LoadingSkeleton from './LoadingSkeleton'
import { submitQuery } from '../lib/api'
import { useQueryHistory } from '../hooks/useQueryHistory'

export default function AnalyzePage() {
  const { state: routerState } = useLocation()
  const prefill = routerState?.prefill || null
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [lastQuery,   setLastQuery]   = useState(null)
  const [error,       setError]       = useState(null)
  const [inputHidden, setInputHidden] = useState(false)

  const { addEntry } = useQueryHistory()

  const hasResult = !!(result || loading || error)

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
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 4rem)', marginTop: '4rem' }}
    >

      {/* ── Top area: hero OR results ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* Hero — shown before any submission */}
          {!hasResult && (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center px-4 py-12"
              style={{ minHeight: 'calc(100vh - 20rem)' }}
            >
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20
                                flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={26} className="text-indigo-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Litigation Risk Analysis</h1>
                <p className="text-gray-500 text-sm max-w-md leading-relaxed">
                  Describe your legal claim and facts below. The pipeline retrieves the closest
                  federal precedent and returns a verified, cite-grounded assessment.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full max-w-sm mb-4">
                {[
                  { label: 'Embed',    step: '01', desc: 'text-embedding-3-small' },
                  { label: 'Retrieve', step: '02', desc: 'pgvector HNSW'          },
                  { label: 'Verify',   step: '03', desc: '3-layer check'          },
                ].map(({ label, step, desc }) => (
                  <div key={step} className="glass-card p-3 text-center">
                    <div className="text-indigo-500 text-xs font-bold font-mono mb-1">{step}</div>
                    <div className="text-xs font-semibold text-white">{label}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{desc}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600 mt-2">
                {[
                  { icon: Sparkles,      label: 'RAG-grounded'       },
                  { icon: Scale,         label: 'Federal corpus only' },
                  { icon: AlertTriangle, label: 'Not legal advice'   },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <Icon size={11} className="text-gray-600" />
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Results */}
          {hasResult && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="max-w-4xl mx-auto px-4 py-6">

                {error && !loading && (
                  <div className="glass-card border border-red-500/25 bg-red-500/8 p-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-red-400 mb-1">Pipeline Error</div>
                        <p className="text-sm text-gray-400">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {loading && (
                  <div>
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
                  </div>
                )}

                {result && !loading && (
                  <ResultsPanel result={result} query={lastQuery} />
                )}

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Bottom: single persistent QueryForm instance ──────────────────── */}
      <div className="flex-shrink-0">

        {/* Toggle bar — only shown after first submission */}
        {hasResult && (
          <div className="query-toggle-bar flex items-center justify-between px-4 py-1.5 border-t">
            <span className="text-xs text-gray-600">New or revised query</span>
            <button
              type="button"
              onClick={() => setInputHidden(h => !h)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg
                         bg-white/[0.04] border border-white/10
                         text-gray-400 hover:text-white hover:bg-white/[0.08]
                         transition-all duration-150"
            >
              {inputHidden
                ? <><Minimize2 size={11} /><span>Show input</span></>
                : <><Maximize2 size={11} /><span>Fullscreen</span></>
              }
            </button>
          </div>
        )}

        {/* The form — always mounted, never destroyed */}
        <AnimatePresence initial={false}>
          {(!hasResult || !inputHidden) && (
            <motion.div
              key="form"
              initial={hasResult ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="query-form-panel overflow-hidden border-t"
            >
              <div className={hasResult ? 'max-w-4xl mx-auto' : 'max-w-3xl mx-auto'}>
                <QueryForm
                  onSubmit={handleSubmit}
                  loading={loading}
                  initialValues={prefill}
                  compact={hasResult}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
