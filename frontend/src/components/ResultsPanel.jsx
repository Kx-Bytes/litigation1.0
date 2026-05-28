import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Check, Download, AlertTriangle, Scale,
  Lightbulb, AlertCircle, Trash2, Clock,
  FileText, ShieldAlert, TrendingUp,
} from 'lucide-react'
import ConfidenceBadge    from './ConfidenceBadge'
import RiskFactorCard     from './RiskFactorCard'
import ComparableCaseCard from './ComparableCaseCard'
import RefusalCard        from './RefusalCard'

/* ── Tab config ──────────────────────────────────────────────────────────── */
const ALL_TABS = [
  { id: 'overview',  label: 'Overview',  icon: FileText    },
  { id: 'risk',      label: 'Risk',      icon: ShieldAlert },
  { id: 'cases',     label: 'Cases',     icon: Scale       },
  { id: 'strategy',  label: 'Strategy',  icon: TrendingUp  },
]

/* ─────────────────────────────────────────────────────────────────────────── */
export default function ResultsPanel({ result, query }) {
  const [copied,    setCopied]    = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  if (!result) return null

  const refused          = !!result.refusal
  const riskFactors      = result.risk_assessment?.factors || []
  const comparableCases  = result.comparable_cases || []
  const strategic        = result.strategic_considerations || []
  const uncertaintyNotes = result.uncertainty_notes || []
  const droppedClaims    = result.dropped_claims || []

  /* Only show tabs that have data */
  const availableTabs = ALL_TABS.filter(t => {
    if (t.id === 'risk')     return !refused && riskFactors.length > 0
    if (t.id === 'cases')    return comparableCases.length > 0
    if (t.id === 'strategy') return strategic.length > 0 || uncertaintyNotes.length > 0 || droppedClaims.length > 0
    return true // always show overview
  })

  function handleCopy() {
    navigator.clipboard.writeText(buildExportText(result, query)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  function handleDownload() {
    const blob = new Blob([buildExportText(result, query)], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `openpaws-assessment-${result.query_id || Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-0.5">
            Assessment Complete
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {result.model && (
              <span className="text-xs text-gray-600 font-mono">{result.model}</span>
            )}
            {result.latency_ms !== undefined && (
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <Clock size={10} />{result.latency_ms}ms
              </span>
            )}
            {result.query_id && (
              <span className="text-xs font-mono text-gray-700 opacity-50">
                #{result.query_id.slice(0, 8)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: copied ? '#34d399' : 'rgba(156,163,175,1)',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(156,163,175,1)',
            }}
          >
            <Download size={12} />Export
          </button>
        </div>
      </div>

      {/* ── Confidence hero ─────────────────────────────────────────────────── */}
      <ConfidenceBadge band={result.confidence_band || (refused ? 'refused' : 'low')} />

      {/* ── Refusal card (replaces tabs) ────────────────────────────────────── */}
      {refused && <RefusalCard refusal={result.refusal} />}

      {/* ── Tab navigation + content ─────────────────────────────────────────── */}
      {!refused && (
        <div>
          {/* Tab bar */}
          <div
            className="flex gap-1 p-1 rounded-xl mb-5"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {availableTabs.map(tab => {
              const Icon   = tab.icon
              const active = activeTab === tab.id
              const count  = tab.id === 'risk' ? riskFactors.length : tab.id === 'cases' ? comparableCases.length : null
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all duration-200"
                  style={{
                    background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
                    border:     active ? '1px solid rgba(99,102,241,0.32)' : '1px solid transparent',
                    color:      active ? '#a5b4fc' : 'rgba(156,163,175,0.55)',
                    boxShadow:  active ? '0 0 14px rgba(99,102,241,0.14)' : 'none',
                  }}
                >
                  <Icon size={12} />
                  {tab.label}
                  {count != null && count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono"
                          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(156,163,175,0.7)' }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >

              {/* ── OVERVIEW ─────────────────────────────── */}
              {activeTab === 'overview' && (
                <div className="space-y-4">

                  {/* Stats triptych */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Risk Factors',     value: riskFactors.length,    color: '#f59e0b', glow: 'rgba(245,158,11,0.12)'  },
                      { label: 'Comparable Cases', value: comparableCases.length, color: '#818cf8', glow: 'rgba(129,140,248,0.12)' },
                      { label: 'Strategies',       value: strategic.length,       color: '#10b981', glow: 'rgba(16,185,129,0.12)'  },
                    ].map(stat => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-4 text-center"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 24px ${stat.glow}`,
                        }}
                      >
                        <div className="text-3xl font-bold font-mono mb-1" style={{ color: stat.color }}>
                          {stat.value}
                        </div>
                        <div className="text-xs text-gray-500 leading-snug">{stat.label}</div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Top risk factors (inline preview) */}
                  {riskFactors.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-widest text-amber-400/70 mb-2 flex items-center gap-1.5">
                        <ShieldAlert size={11} />Top Risk Factors
                      </div>
                      {riskFactors.slice(0, 3).map((f, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-3 rounded-xl px-4 py-3"
                          style={{
                            background: 'rgba(245,158,11,0.04)',
                            border: '1px solid rgba(245,158,11,0.12)',
                          }}
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                            (f.severity || '').toLowerCase() === 'high'   ? 'bg-red-400'     :
                            (f.severity || '').toLowerCase() === 'medium' ? 'bg-amber-400'   :
                            'bg-emerald-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white leading-snug">
                              {f.factor_text || f.factor || 'Risk factor'}
                            </div>
                            {f.severity && (
                              <div className="text-xs text-gray-600 mt-0.5 capitalize">{f.severity} severity</div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                      {riskFactors.length > 3 && (
                        <button
                          onClick={() => setActiveTab('risk')}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-1 mt-1"
                        >
                          + {riskFactors.length - 3} more risk factors →
                        </button>
                      )}
                    </div>
                  )}

                  {/* Key strategy highlight */}
                  {strategic.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="rounded-xl p-5"
                      style={{
                        background: 'rgba(16,185,129,0.05)',
                        border: '1px solid rgba(16,185,129,0.18)',
                        boxShadow: '0 0 24px rgba(16,185,129,0.06)',
                      }}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400/80 mb-2.5">
                        <Lightbulb size={11} />Key Strategy
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{strategic[0]}</p>
                      {strategic.length > 1 && (
                        <button
                          onClick={() => setActiveTab('strategy')}
                          className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          View all {strategic.length} considerations →
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── RISK FACTORS ─────────────────────────── */}
              {activeTab === 'risk' && (
                <div className="space-y-3">
                  {riskFactors.map((f, i) => (
                    <RiskFactorCard key={i} factor={f} index={i} />
                  ))}
                </div>
              )}

              {/* ── COMPARABLE CASES ─────────────────────── */}
              {activeTab === 'cases' && (
                <div className="space-y-3">
                  {comparableCases.map((c, i) => (
                    <ComparableCaseCard key={i} case={c} index={i} />
                  ))}
                </div>
              )}

              {/* ── STRATEGY ─────────────────────────────── */}
              {activeTab === 'strategy' && (
                <div className="space-y-4">

                  {/* Strategic considerations */}
                  {strategic.length > 0 && (
                    <div
                      className="rounded-2xl p-5 space-y-4"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="text-xs font-bold uppercase tracking-widest text-emerald-400/75 flex items-center gap-1.5">
                        <Lightbulb size={11} />Strategic Considerations
                      </div>
                      {strategic.map((s, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-3"
                        >
                          <span
                            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              background: 'rgba(16,185,129,0.15)',
                              border: '1px solid rgba(16,185,129,0.3)',
                              color: '#34d399',
                            }}
                          >
                            {i + 1}
                          </span>
                          <p className="text-sm text-gray-300 leading-relaxed">{s}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Uncertainty notes */}
                  {uncertaintyNotes.length > 0 && (
                    <div
                      className="rounded-2xl p-5 space-y-3"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="text-xs font-bold uppercase tracking-widest text-gray-400/75 flex items-center gap-1.5">
                        <AlertCircle size={11} />Uncertainty Notes
                      </div>
                      {uncertaintyNotes.map((n, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <AlertCircle size={12} className="flex-shrink-0 text-gray-500 mt-0.5" />
                          <p className="text-xs text-gray-400 leading-relaxed">{n}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dropped citations */}
                  {droppedClaims.length > 0 && (
                    <div
                      className="rounded-2xl p-5 space-y-2"
                      style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.16)' }}
                    >
                      <div className="text-xs font-bold uppercase tracking-widest text-red-400/70 flex items-center gap-1.5 mb-3">
                        <Trash2 size={11} />Dropped Citations ({droppedClaims.length})
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        These citations failed verification and were removed from the assessment.
                      </p>
                      {droppedClaims.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs text-gray-500 font-mono rounded-lg px-3 py-2"
                          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.13)' }}
                        >
                          <Trash2 size={10} className="text-red-500/50" />
                          {c}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-2 text-xs text-gray-600 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
        <span>
          Informational risk assessment only — not legal advice. Based on verified federal case law.{' '}
          Query ID: <span className="font-mono">{result.query_id || '—'}</span>
        </span>
      </div>
    </motion.div>
  )
}

/* ── Export text builder ─────────────────────────────────────────────────── */
function buildExportText(result, query) {
  const lines = [
    '═══════════════════════════════════════════════════',
    '  OPENPAWS LITIGATION RISK ASSESSMENT',
    '═══════════════════════════════════════════════════',
    '',
    `Query ID   : ${result.query_id || '—'}`,
    `Model      : ${result.model || '—'}`,
    `Confidence : ${result.confidence_band || '—'}`,
    `Latency    : ${result.latency_ms ?? '—'}ms`,
    '',
  ]

  if (query) {
    lines.push('QUERY', '─────')
    lines.push(`Jurisdiction : ${query.jurisdiction}`)
    lines.push(`Claim        : ${query.claim}`)
    if (query.facts) lines.push(`Facts        : ${query.facts}`)
    lines.push('')
  }

  if (result.refusal) {
    lines.push('ASSESSMENT: REFUSED', '────────────────────')
    lines.push(result.refusal.reason || '')
    lines.push('')
  }

  const factors = result.risk_assessment?.factors || []
  if (factors.length) {
    lines.push(`RISK FACTORS (${factors.length})`, '────────────────────')
    factors.forEach((f, i) => {
      lines.push(`${i + 1}. [${f.severity || 'Unknown'}] ${f.factor_text || f.factor || ''}`)
      if (f.analysis) lines.push(`   ${f.analysis}`)
    })
    lines.push('')
  }

  const cases = result.comparable_cases || []
  if (cases.length) {
    lines.push(`COMPARABLE CASES (${cases.length})`, '────────────────────')
    cases.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.citation || c.chunk_id}`)
      if (c.outcome)    lines.push(`   Outcome: ${c.outcome}`)
      if (c.source_url) lines.push(`   URL: ${c.source_url}`)
    })
    lines.push('')
  }

  const strategic = result.strategic_considerations || []
  if (strategic.length) {
    lines.push('STRATEGIC CONSIDERATIONS', '────────────────────')
    strategic.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
    lines.push('')
  }

  lines.push('─────────────────────────────────────────────────')
  lines.push('Informational only — not legal advice.')
  lines.push(`Generated: ${new Date().toISOString()}`)

  return lines.join('\n')
}
