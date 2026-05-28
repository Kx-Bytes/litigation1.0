import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Sparkles } from 'lucide-react'
import QueryForm from './QueryForm'
import ResultsPanel from './ResultsPanel'
import LoadingSkeleton from './LoadingSkeleton'
import { submitQuery } from '../lib/api'
import { useQueryHistory } from '../hooks/useQueryHistory'

export default function AnalyzePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [lastQuery, setLastQuery] = useState(null)
  const [error, setError] = useState(null)

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
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'An unexpected error occurred. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-7xl mx-auto">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="chip chip-indigo">
              <Sparkles size={11} />
              RAG-Grounded Assessment
            </span>
            <span className="chip chip-emerald">Cite-or-Refuse</span>
            <span className="chip">3-layer verified</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            Litigation Risk Analysis
          </h1>
          <p className="text-gray-400 text-base max-w-xl">
            Enter your claim and facts below. The pipeline embeds your query, retrieves the closest
            federal precedent, generates a cite-grounded assessment, and verifies every citation.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-[420px_1fr] gap-8 items-start">

          {/* Left: Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:sticky lg:top-24"
          >
            <div className="glass-card p-7">
              <QueryForm onSubmit={handleSubmit} loading={loading} />
            </div>

            {/* Disclaimer under form */}
            <p className="mt-3 text-xs text-gray-600 flex items-start gap-1.5 px-1">
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
              Not legal advice. Assessments are grounded in retrieved federal case law only.
            </p>
          </motion.div>

          {/* Right: Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <AnimatePresence mode="wait">
              {/* Error */}
              {error && !loading && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
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

              {/* Loading skeleton */}
              {loading && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
                  className="flex flex-col items-center justify-center py-28 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
                    <Sparkles size={28} className="text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Ready to assess</h3>
                  <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
                    Fill in the form on the left and click "Run Assessment" to get a verified,
                    cite-grounded litigation risk analysis.
                  </p>
                  <div className="mt-8 grid grid-cols-3 gap-4 max-w-sm w-full">
                    {[
                      { label: 'Embed', step: '01', desc: 'voyage-3-large' },
                      { label: 'Retrieve', step: '02', desc: 'pgvector HNSW' },
                      { label: 'Verify', step: '03', desc: '3-layer check' },
                    ].map(({ label, step, desc }) => (
                      <div key={step} className="glass-card p-3 text-center">
                        <div className="text-indigo-500 text-xs font-bold font-mono mb-1">{step}</div>
                        <div className="text-xs font-semibold text-white">{label}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{desc}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </div>
    </div>
  )
}
