import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Check, Download, ChevronDown,
  AlertTriangle, Scale, Lightbulb, AlertCircle, Trash2, Clock
} from 'lucide-react'
import ConfidenceBadge from './ConfidenceBadge'
import RiskFactorCard from './RiskFactorCard'
import ComparableCaseCard from './ComparableCaseCard'
import RefusalCard from './RefusalCard'

function Section({ icon: Icon, color = 'indigo', title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const colorMap = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    amber:  'text-amber-400  bg-amber-500/10  border-amber-500/20',
    emerald:'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    red:    'text-red-400    bg-red-500/10    border-red-500/20',
    gray:   'text-gray-400   bg-gray-500/10   border-gray-500/20',
  }
  const cls = colorMap[color] || colorMap.indigo

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 mb-3 group"
      >
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${cls}`}>
          <Icon size={13} />
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
        {count !== undefined && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/8 text-gray-400 border border-white/10 font-mono">
            {count}
          </span>
        )}
        <div className="flex-1 h-px bg-white/6" />
        <ChevronDown size={13} className={`text-gray-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ResultsPanel({ result, query }) {
  const [copied, setCopied] = useState(false)

  if (!result) return null

  const refused = !!result.refusal
  const riskFactors = result.risk_assessment?.factors || []
  const comparableCases = result.comparable_cases || []
  const strategic = result.strategic_considerations || []
  const uncertaintyNotes = result.uncertainty_notes || []
  const droppedClaims = result.dropped_claims || []

  function handleCopy() {
    const text = buildExportText(result, query)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    const text = buildExportText(result, query)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `openpaws-assessment-${result.query_id || Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest font-medium">Assessment Result</div>
          <div className="flex items-center gap-2 mt-0.5">
            {result.model && (
              <span className="text-xs text-gray-600 font-mono">{result.model}</span>
            )}
            {result.latency_ms !== undefined && (
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <Clock size={10} />
                {result.latency_ms}ms
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
          >
            <Download size={12} />
            Export
          </button>
        </div>
      </div>

      {/* Confidence badge */}
      <ConfidenceBadge band={result.confidence_band || (refused ? 'refused' : 'low')} />

      {/* Refusal */}
      {refused && <RefusalCard refusal={result.refusal} />}

      {/* Risk factors */}
      {!refused && riskFactors.length > 0 && (
        <Section icon={AlertTriangle} color="amber" title="Risk Factors" count={riskFactors.length}>
          <div className="space-y-3">
            {riskFactors.map((f, i) => (
              <RiskFactorCard key={i} factor={f} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Comparable cases */}
      {comparableCases.length > 0 && (
        <Section icon={Scale} color="indigo" title="Comparable Cases" count={comparableCases.length}>
          <div className="space-y-3">
            {comparableCases.map((c, i) => (
              <ComparableCaseCard key={i} case={c} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Strategic considerations */}
      {strategic.length > 0 && (
        <Section icon={Lightbulb} color="emerald" title="Strategic Considerations">
          <div className="glass-card p-5 space-y-3">
            {strategic.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mt-0.5">
                  <span className="text-emerald-400 text-xs font-bold">{i + 1}</span>
                </span>
                <p className="text-sm text-gray-300 leading-relaxed">{s}</p>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* Uncertainty notes */}
      {uncertaintyNotes.length > 0 && (
        <Section icon={AlertCircle} color="gray" title="Uncertainty Notes" defaultOpen={false}>
          <div className="glass-card p-5 space-y-2">
            {uncertaintyNotes.map((n, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <AlertCircle size={13} className="flex-shrink-0 text-gray-500 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">{n}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Dropped claims */}
      {droppedClaims.length > 0 && (
        <Section icon={Trash2} color="red" title="Dropped Citations" count={droppedClaims.length} defaultOpen={false}>
          <div className="glass-card p-4 space-y-1.5">
            <p className="text-xs text-gray-500 mb-3">
              These citations were referenced by the model but failed verification and were removed from the assessment.
            </p>
            {droppedClaims.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-500 font-mono bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                <Trash2 size={10} className="text-red-500/50" />
                {c}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 text-xs text-gray-600 border-t border-white/6 pt-4">
        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
        <span>
          Informational risk assessment only — not legal advice. Based on verified federal case law citations.
          Query ID: <span className="font-mono">{result.query_id || '—'}</span>
        </span>
      </div>
    </motion.div>
  )
}

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
      if (c.outcome) lines.push(`   Outcome: ${c.outcome}`)
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
