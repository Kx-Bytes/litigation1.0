import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  History, Search, Trash2, RefreshCw, ChevronDown,
  Scale, AlertTriangle, Clock, ShieldCheck, ShieldAlert, ShieldX, Shield
} from 'lucide-react'
import { useQueryHistory } from '../hooks/useQueryHistory'
import { JURISDICTIONS } from '../lib/jurisdictions'

const BAND_CONFIG = {
  high:    { label: 'High',    icon: ShieldCheck, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  medium:  { label: 'Medium',  icon: ShieldAlert, color: 'text-amber-400  bg-amber-500/10  border-amber-500/25' },
  low:     { label: 'Low',     icon: ShieldX,     color: 'text-red-400    bg-red-500/10    border-red-500/25' },
  refused: { label: 'Refused', icon: Shield,       color: 'text-gray-400   bg-gray-500/10   border-gray-500/25' },
}

function bandBadge(band) {
  const cfg = BAND_CONFIG[band] || BAND_CONFIG.low
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

function jurLabel(val) {
  return JURISDICTIONS.find(j => j.value === val)?.short || val
}

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return iso }
}

function HistoryEntry({ entry, onRemove }) {
  const [open, setOpen] = useState(false)
  const { query, result } = entry
  const band = result?.confidence_band
  const refused = !!result?.refusal
  const factorCount = result?.risk_assessment?.factors?.length ?? 0
  const caseCount   = result?.comparable_cases?.length ?? 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="glass-card overflow-hidden"
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-4 p-5 text-left hover:bg-white/3 transition-colors"
      >
        {/* Jurisdiction chip */}
        <span className="flex-shrink-0 text-xs px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono mt-0.5">
          {jurLabel(query?.jurisdiction)}
        </span>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white leading-snug mb-1.5 truncate">
            {query?.claim || 'No claim recorded'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {band && bandBadge(band)}
            {!refused && factorCount > 0 && (
              <span className="text-xs text-gray-500">{factorCount} risk factor{factorCount !== 1 ? 's' : ''}</span>
            )}
            {!refused && caseCount > 0 && (
              <span className="text-xs text-gray-500">{caseCount} comparable case{caseCount !== 1 ? 's' : ''}</span>
            )}
            {refused && <span className="text-xs text-gray-500">Assessment refused</span>}
          </div>
        </div>

        {/* Timestamp + chevron */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Clock size={10} />
            {formatDate(entry.timestamp)}
          </div>
          <ChevronDown size={14} className={`text-gray-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="px-5 pb-5 pt-2 border-t border-white/6 space-y-4">

              {/* Facts */}
              {query?.facts && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Facts</div>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-5">{query.facts}</p>
                </div>
              )}

              {/* Risk factor excerpts */}
              {!refused && factorCount > 0 && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Risk Factors</div>
                  <div className="space-y-1.5">
                    {result.risk_assessment.factors.slice(0, 3).map((f, i) => (
                      <div key={i} className="text-xs text-gray-400 bg-white/4 rounded-lg px-3 py-2 border border-white/6">
                        <span className="text-amber-400 mr-1.5">•</span>
                        {f.label}{f.discussion ? ` — ${f.discussion.slice(0, 120)}${f.discussion.length > 120 ? '…' : ''}` : ''}
                      </div>
                    ))}
                    {factorCount > 3 && (
                      <div className="text-xs text-gray-600 px-1">+{factorCount - 3} more</div>
                    )}
                  </div>
                </div>
              )}

              {/* Strategic considerations */}
              {result?.strategic_considerations?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Strategic Considerations</div>
                  <div className="space-y-1.5">
                    {result.strategic_considerations.slice(0, 2).map((s, i) => (
                      <div key={i} className="text-xs text-gray-400 bg-white/4 rounded-lg px-3 py-2 border border-white/6">
                        <span className="text-emerald-400 mr-1.5">→</span>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  {result?.model && <span className="font-mono">{result.model}</span>}
                  {result?.latency_ms !== undefined && <span>{result.latency_ms}ms</span>}
                  {result?.query_id && <span className="font-mono opacity-60">#{result.query_id.slice(0, 8)}</span>}
                </div>
                <button
                  onClick={() => onRemove(entry.id)}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} />
                  Remove
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function HistoryPage() {
  const { history, clearHistory, removeEntry } = useQueryHistory()
  const [search, setSearch] = useState('')
  const [filterBand, setFilterBand] = useState('all')
  const [confirmClear, setConfirmClear] = useState(false)

  const filtered = history.filter(e => {
    const matchSearch =
      !search ||
      e.query?.claim?.toLowerCase().includes(search.toLowerCase()) ||
      e.query?.facts?.toLowerCase().includes(search.toLowerCase()) ||
      e.query?.jurisdiction?.toLowerCase().includes(search.toLowerCase())
    const matchBand =
      filterBand === 'all' ||
      e.result?.confidence_band === filterBand ||
      (filterBand === 'refused' && !!e.result?.refusal)
    return matchSearch && matchBand
  })

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <History size={20} className="text-indigo-400" />
              <h1 className="font-display text-2xl font-bold text-white">Query History</h1>
            </div>
            {history.length > 0 && (
              <div className="flex items-center gap-2">
                {confirmClear ? (
                  <>
                    <span className="text-xs text-gray-400">Clear all {history.length} entries?</span>
                    <button
                      onClick={() => { clearHistory(); setConfirmClear(false) }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white/6 border border-white/10 text-gray-400 hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/6 border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/25 transition-all"
                  >
                    <Trash2 size={11} />
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="text-gray-500 text-sm">
            {history.length} saved {history.length === 1 ? 'assessment' : 'assessments'} — stored locally in your browser
          </p>
        </motion.div>

        {history.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5">
              <Scale size={24} className="text-gray-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-400 mb-2">No assessments yet</h3>
            <p className="text-sm text-gray-600 mb-6">Run your first litigation risk analysis to see it here.</p>
            <Link to="/analyze" className="btn-primary text-sm">
              Start an analysis
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Search + filter bar */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex flex-col sm:flex-row gap-3 mb-6"
            >
              {/* Search */}
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search claims, facts, jurisdiction…"
                  className="input-field w-full pl-9 text-sm"
                />
              </div>

              {/* Band filter */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { val: 'all', label: 'All' },
                  { val: 'high', label: 'High' },
                  { val: 'medium', label: 'Medium' },
                  { val: 'low', label: 'Low' },
                  { val: 'refused', label: 'Refused' },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => setFilterBand(val)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium
                      ${filterBand === val
                        ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                        : 'bg-white/4 border-white/8 text-gray-500 hover:text-gray-300 hover:bg-white/8'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Results count */}
            {(search || filterBand !== 'all') && (
              <div className="text-xs text-gray-600 mb-3">
                {filtered.length} of {history.length} entries
              </div>
            )}

            {/* Entries */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.div
                    key="empty-filtered"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 text-gray-600 text-sm"
                  >
                    No entries match your search or filter.
                  </motion.div>
                ) : (
                  filtered.map(entry => (
                    <HistoryEntry key={entry.id} entry={entry} onRemove={removeEntry} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
