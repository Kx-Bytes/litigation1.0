import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Calendar, Sparkles, Info, SlidersHorizontal, X, Database } from 'lucide-react'
import { JURISDICTIONS } from '../lib/jurisdictions'

function formatDisplayDate(iso) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso + 'T00:00:00'))
  } catch { return iso }
}

const DEFAULT_K = 8

export default function QueryForm({ onSubmit, loading }) {
  const [jurisdiction, setJurisdiction] = useState('US-9th-Cir')
  const [claim, setClaim]               = useState('')
  const [facts, setFacts]               = useState('')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [k, setK]                       = useState(DEFAULT_K)
  const [jurOpen, setJurOpen]           = useState(false)

  const selectedJur = JURISDICTIONS.find(j => j.value === jurisdiction) || JURISDICTIONS[0]

  function handleSubmit(e) {
    e.preventDefault()
    if (!claim.trim()) return
    const payload = {
      jurisdiction,
      claim: claim.trim(),
      facts: facts.trim(),
      options: {
        k,
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo   ? { date_to:   dateTo }   : {}),
      },
    }
    onSubmit(payload)
  }

  const charsFact = facts.length
  const charsLeft = Math.max(0, 4000 - charsFact)
  const factWarn  = charsLeft < 400

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Jurisdiction */}
      <div>
        <label className="field-label">Jurisdiction</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setJurOpen(o => !o)}
            className="input-field w-full flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-mono flex-shrink-0">
                {selectedJur.short}
              </span>
              <span className="text-white text-sm truncate">{selectedJur.label}</span>
            </div>
            <ChevronDown size={15} className={`flex-shrink-0 text-gray-500 transition-transform duration-200 ${jurOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {jurOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 top-full mt-1.5 w-full rounded-xl border border-white/10 bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                style={{ background: 'rgba(6,13,31,0.97)' }}
              >
                <div className="max-h-64 overflow-y-auto py-1">
                  {JURISDICTIONS.map(j => (
                    <button
                      key={j.value}
                      type="button"
                      onClick={() => { setJurisdiction(j.value); setJurOpen(false) }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-white/6 transition-colors text-left
                        ${j.value === jurisdiction ? 'bg-indigo-500/12 text-indigo-300' : 'text-gray-300'}`}
                    >
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white/6 text-gray-400 font-mono flex-shrink-0 w-16 text-center">
                        {j.short}
                      </span>
                      <span className="truncate">{j.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Claim */}
      <div>
        <label className="field-label">
          Legal Claim
          <span className="ml-1 text-red-400">*</span>
        </label>
        <input
          type="text"
          value={claim}
          onChange={e => setClaim(e.target.value)}
          placeholder="e.g. Unlawful seizure of companion animals under Fourth Amendment"
          className="input-field w-full"
          required
          maxLength={500}
        />
        <p className="mt-1.5 text-xs text-gray-600">
          The specific legal theory or cause of action you want assessed.
        </p>
      </div>

      {/* Facts */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="field-label mb-0">Relevant Facts</label>
          <span className={`text-xs font-mono ${factWarn ? 'text-amber-400' : 'text-gray-600'}`}>
            {charsLeft} chars left
          </span>
        </div>
        <textarea
          value={facts}
          onChange={e => setFacts(e.target.value)}
          placeholder="Summarize the key facts: parties, actions taken, dates, relevant statutes, agency conduct, injuries..."
          className="input-field w-full min-h-[130px] resize-y"
          maxLength={4000}
        />
        <p className="mt-1.5 text-xs text-gray-600">
          More context improves semantic retrieval. Include statutes, agency names, and specific conduct.
        </p>
      </div>

      {/* Advanced toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(o => !o)}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <SlidersHorizontal size={12} />
          Advanced options
          <ChevronDown size={12} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-5 border-t border-white/[0.07] mt-3">

                {/* ── Date range ─────────────────────────────────────────── */}
                <div>
                  <label className="field-label flex items-center gap-1.5 mb-3">
                    <Calendar size={11} />
                    Filter by case date
                    <span className="ml-auto text-xs font-normal text-gray-600 normal-case tracking-normal">
                      Leave blank to search all years
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {/* From */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1.5 font-medium">From</div>
                      <div className="relative group">
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={e => setDateFrom(e.target.value)}
                          max={dateTo || undefined}
                          className="input-field w-full pr-8 text-sm"
                          style={{ colorScheme: 'dark' }}
                        />
                        {dateFrom && (
                          <button
                            type="button"
                            onClick={() => setDateFrom('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
                            tabIndex={-1}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      {dateFrom && (
                        <div className="mt-1 text-xs text-indigo-400 font-medium">
                          {formatDisplayDate(dateFrom)}
                        </div>
                      )}
                    </div>

                    {/* To */}
                    <div>
                      <div className="text-xs text-gray-500 mb-1.5 font-medium">To</div>
                      <div className="relative group">
                        <input
                          type="date"
                          value={dateTo}
                          onChange={e => setDateTo(e.target.value)}
                          min={dateFrom || undefined}
                          className="input-field w-full pr-8 text-sm"
                          style={{ colorScheme: 'dark' }}
                        />
                        {dateTo && (
                          <button
                            type="button"
                            onClick={() => setDateTo('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
                            tabIndex={-1}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      {dateTo && (
                        <div className="mt-1 text-xs text-indigo-400 font-medium">
                          {formatDisplayDate(dateTo)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary pill when both are set */}
                  {dateFrom && dateTo && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2.5 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                    >
                      <Calendar size={11} />
                      Searching cases from <strong>{formatDisplayDate(dateFrom)}</strong> to <strong>{formatDisplayDate(dateTo)}</strong>
                      <button
                        type="button"
                        onClick={() => { setDateFrom(''); setDateTo('') }}
                        className="ml-auto hover:text-indigo-300 transition-colors"
                        title="Clear date range"
                      >
                        <X size={11} />
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* ── Retrieval depth k ──────────────────────────────────── */}
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Database size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-white leading-tight">
                          Retrieval depth
                          <span className="ml-2 font-bold text-indigo-400 font-mono">{k}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          How many case chunks to pull from the vector database
                        </div>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${
                      k <= 5  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      k <= 12 ? 'bg-amber-500/10  border-amber-500/20  text-amber-400'   :
                                'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                    }`}>
                      {k <= 5 ? 'Fast' : k <= 12 ? 'Balanced' : 'Thorough'}
                    </span>
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    min={3}
                    max={20}
                    value={k}
                    onChange={e => setK(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    style={{ background: `linear-gradient(to right, rgb(99,102,241) ${((k-3)/(20-3))*100}%, rgba(255,255,255,0.1) ${((k-3)/(20-3))*100}%)` }}
                  />
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>3 — fewer, faster</span>
                    <span>20 — more context, slower</span>
                  </div>

                  {/* What k does */}
                  <div className="flex items-start gap-2 text-xs text-gray-500 bg-white/[0.03] rounded-lg px-3 py-2.5 border border-white/[0.05]">
                    <Info size={11} className="flex-shrink-0 text-gray-600 mt-0.5" />
                    <span>
                      The pipeline retrieves the top <strong className="text-gray-400">{k}</strong> most semantically similar case chunks
                      from the pgvector index. Higher values give the model more precedent to reason over,
                      but increase latency and token usage. <strong className="text-gray-400">8–12</strong> is recommended for most queries.
                    </span>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={loading || !claim.trim()}
        whileHover={{ scale: loading ? 1 : 1.01 }}
        whileTap={{ scale: loading ? 1 : 0.98 }}
        className="btn-primary w-full flex items-center justify-center gap-2.5 py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Analyzing…
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Run Assessment
          </>
        )}
      </motion.button>

    </form>
  )
}
