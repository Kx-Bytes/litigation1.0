import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Check, Download, AlertTriangle, Scale,
  Lightbulb, AlertCircle, Trash2, Clock,
  FileText, ShieldAlert, TrendingUp, BarChart2,
  Image, FileDown, ChevronDown,
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
  { id: 'trends',    label: 'Trends',    icon: BarChart2   },
]

/* ── Year parsing helper ─────────────────────────────────────────────────── */
function extractYears(cases) {
  const yearRe = /\b(1[89]\d{2}|20[0-2]\d)\b/g
  const counts = {}
  cases.forEach(c => {
    const src = [c.citation, c.case_name, c.chunk_id].filter(Boolean).join(' ')
    const hits = src.match(yearRe) || []
    hits.forEach(y => { counts[y] = (counts[y] || 0) + 1 })
  })
  return counts
}

/* ─────────────────────────────────────────────────────────────────────────── */
export default function ResultsPanel({ result, query }) {
  const [copied,      setCopied]      = useState(false)
  const [activeTab,   setActiveTab]   = useState('overview')
  const [exportOpen,  setExportOpen]  = useState(false)
  const [exporting,   setExporting]   = useState(null)   // 'text' | 'image' | 'pdf'
  const panelRef    = useRef(null)
  const exportBtnRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (exportBtnRef.current && !exportBtnRef.current.contains(e.target)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!result) return null

  const refused          = !!result.refusal
  const riskFactors      = result.risk_assessment?.factors || []
  const comparableCases  = result.comparable_cases || []
  const strategic        = result.strategic_considerations || []
  const uncertaintyNotes = result.uncertainty_notes || []
  const droppedClaims    = result.dropped_claims || []

  /* citation string → source_url lookup for risk factor links */
  const citationUrlMap = Object.fromEntries(
    comparableCases
      .filter(c => c.citation && c.source_url)
      .map(c => [c.citation, c.source_url])
  )

  /* Only show tabs that have data */
  const availableTabs = ALL_TABS.filter(t => {
    if (t.id === 'risk')     return !refused && riskFactors.length > 0
    if (t.id === 'cases')    return comparableCases.length > 0
    if (t.id === 'strategy') return strategic.length > 0 || uncertaintyNotes.length > 0 || droppedClaims.length > 0
    if (t.id === 'trends')   return comparableCases.length > 0
    return true // always show overview
  })

  /* Pre-compute trend data */
  const yearCounts  = extractYears(comparableCases)
  const sortedYears = Object.keys(yearCounts).sort()
  const maxCount    = Math.max(...Object.values(yearCounts), 1)
  const decadeMap   = sortedYears.reduce((acc, y) => {
    const decade = `${Math.floor(parseInt(y, 10) / 10) * 10}s`
    acc[decade]  = (acc[decade] || 0) + yearCounts[y]
    return acc
  }, {})

  function handleCopy() {
    navigator.clipboard.writeText(buildExportText(result, query)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  function handleExportText() {
    setExporting('text')
    setExportOpen(false)
    const blob = new Blob([buildExportText(result, query)], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `openpaws-assessment-${result.query_id || Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setTimeout(() => setExporting(null), 1500)
  }

  async function handleExportImage() {
    setExporting('image')
    setExportOpen(false)
    try {
      const html2canvas = (await import('html2canvas')).default
      // Temporarily expand all tabs by rendering a full-report clone
      const clone = panelRef.current.cloneNode(true)
      clone.style.position = 'fixed'
      clone.style.top = '-9999px'
      clone.style.width = panelRef.current.offsetWidth + 'px'
      clone.style.background = '#060d1f'
      document.body.appendChild(clone)
      // Remove the tab panel and inject all-sections markup via canvas
      const canvas = await html2canvas(clone, { backgroundColor: '#060d1f', scale: 2, useCORS: true, logging: false })
      document.body.removeChild(clone)
      const a = document.createElement('a')
      a.download = `openpaws-assessment-${result.query_id || Date.now()}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } catch (e) {
      console.error(e)
      alert('Image export failed.')
    }
    setTimeout(() => setExporting(null), 1500)
  }

  async function handleExportPDF() {
    setExporting('pdf')
    setExportOpen(false)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageW  = doc.internal.pageSize.getWidth()
      const pageH  = doc.internal.pageSize.getHeight()
      const margin = 48
      const col    = pageW - margin * 2
      let y = margin

      const addPage = () => { doc.addPage(); y = margin }
      const checkY  = (needed = 20) => { if (y + needed > pageH - margin) addPage() }

      // Header band
      doc.setFillColor(10, 21, 55)
      doc.rect(0, 0, pageW, 70, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(200, 210, 255)
      doc.text('OpenPaws — Litigation Risk Assessment', margin, 32)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 130, 160)
      doc.text(`Query ID: ${result.query_id || '—'}   ·   ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, 50)
      doc.text('Informational only — not legal advice.', margin, 62)
      y = 90

      // Confidence band
      const band = (result.confidence_band || 'unknown').toUpperCase()
      const bandColor = band === 'HIGH' ? [52,211,153] : band === 'MEDIUM' ? [251,191,36] : [248,113,113]
      doc.setFillColor(...bandColor)
      doc.roundedRect(margin, y, 80, 22, 4, 4, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(10, 21, 55)
      doc.text(band, margin + 40, y + 15, { align: 'center' })
      doc.setTextColor(60, 70, 100)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`Confidence Band  ·  Model: ${result.model || '—'}  ·  ${result.latency_ms ?? '—'}ms`, margin + 90, y + 15)
      y += 36

      const section = (title) => {
        checkY(30)
        doc.setDrawColor(99, 102, 241)
        doc.setLineWidth(0.5)
        doc.line(margin, y, margin + col, y)
        y += 6
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(60, 70, 120)
        doc.text(title, margin, y + 10)
        y += 20
      }

      const bodyText = (text, indent = 0, size = 9, color = [55, 65, 81]) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(size)
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, col - indent)
        lines.forEach(line => {
          checkY(14)
          doc.text(line, margin + indent, y)
          y += 13
        })
      }

      // Query
      if (query) {
        section('Query')
        bodyText(`Jurisdiction: ${query.jurisdiction}`, 0, 9, [80, 90, 120])
        bodyText(query.claim, 0, 9.5, [30, 40, 60])
        if (query.facts) { y += 4; bodyText(query.facts, 0, 9, [80, 90, 110]) }
        y += 8
      }

      // Summary
      if (result.risk_assessment?.summary) {
        section('Executive Summary')
        bodyText(result.risk_assessment.summary, 0, 9.5, [30, 40, 60])
        y += 8
      }

      // Risk factors
      const factors = result.risk_assessment?.factors || []
      if (factors.length) {
        section(`Risk Factors (${factors.length})`)
        factors.forEach((f, i) => {
          checkY(24)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.setTextColor(40, 50, 100)
          doc.text(`${i + 1}. [${f.weight || '?'}]  ${f.label || ''}`, margin, y)
          y += 14
          if (f.discussion) bodyText(f.discussion, 10, 9, [70, 80, 100])
          if (f.citations?.length) {
            bodyText(`Citations: ${f.citations.join(' | ')}`, 10, 8, [99, 102, 200])
          }
          y += 5
        })
      }

      // Comparable cases
      const cases = result.comparable_cases || []
      if (cases.length) {
        section(`Comparable Cases (${cases.length})`)
        cases.forEach((c, i) => {
          checkY(20)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9.5)
          doc.setTextColor(40, 50, 100)
          doc.text(`${i + 1}.  ${c.citation || c.chunk_id}`, margin, y)
          y += 13
          if (c.outcome)    bodyText(`Outcome: ${c.outcome}`, 12, 9, [80, 90, 110])
          if (c.relevance_note) bodyText(c.relevance_note, 12, 9, [80, 90, 110])
          if (c.source_url) bodyText(c.source_url, 12, 8, [99, 130, 200])
          y += 4
        })
      }

      // Strategic considerations
      const strategic = result.strategic_considerations || []
      if (strategic.length) {
        section('Strategic Considerations')
        strategic.forEach((s, i) => { bodyText(`${i + 1}.  ${s}`, 0, 9.5, [30, 40, 60]); y += 3 })
        y += 5
      }

      // Uncertainty notes
      const notes = result.uncertainty_notes || []
      if (notes.length) {
        section('Uncertainty Notes')
        notes.forEach(n => { bodyText(`• ${n}`, 0, 9, [100, 100, 120]); y += 2 })
        y += 5
      }

      // Footer on every page
      const pageCount = doc.internal.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        doc.setFontSize(8)
        doc.setTextColor(150, 160, 180)
        doc.text(`OpenPaws · Not legal advice · Page ${p} of ${pageCount}`, pageW / 2, pageH - 20, { align: 'center' })
      }

      doc.save(`openpaws-assessment-${result.query_id || Date.now()}.pdf`)
    } catch (e) {
      console.error(e)
      alert('PDF export failed: ' + e.message)
    }
    setTimeout(() => setExporting(null), 1500)
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <motion.div
      ref={panelRef}
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
          {/* Copy button */}
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

          {/* Export dropdown */}
          <div ref={exportBtnRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setExportOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
              style={{
                background: exportOpen ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                border: exportOpen ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.1)',
                color: exportOpen ? 'rgb(165,180,252)' : 'rgba(156,163,175,1)',
              }}
            >
              {exporting ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Download size={12} />
                </motion.div>
              ) : (
                <Download size={12} />
              )}
              Export
              <ChevronDown size={11} style={{ transform: exportOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            <AnimatePresence>
              {exportOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                    width: 170, zIndex: 50,
                    background: 'linear-gradient(160deg, rgba(15,23,42,0.97), rgba(10,17,40,0.99))',
                    border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 12,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                    padding: '5px',
                  }}
                >
                  {[
                    { id: 'text',  icon: FileText,  label: 'Text (.txt)',  desc: 'Plain text report',   fn: handleExportText  },
                    { id: 'image', icon: Image,      label: 'Image (.png)', desc: 'Screenshot of panel', fn: handleExportImage },
                    { id: 'pdf',   icon: FileDown,   label: 'PDF (.pdf)',   desc: 'Rendered document',   fn: handleExportPDF   },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={opt.fn}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 10px', borderRadius: 8, border: 'none',
                        background: exporting === opt.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = exporting === opt.id ? 'rgba(99,102,241,0.15)' : 'transparent'}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <opt.icon size={13} color="rgb(165,180,252)" />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(226,232,240)' }}>{opt.label}</div>
                        <div style={{ fontSize: 10.5, color: 'rgba(156,163,175,0.6)', marginTop: 1 }}>{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Confidence hero ─────────────────────────────────────────────────── */}
      <ConfidenceBadge band={result.confidence_band || (refused ? 'refused' : 'low')} citationRate={result.citation_rate} />

      {/* ── Refusal card (replaces tabs) ────────────────────────────────────── */}
      {refused && <RefusalCard refusal={result.refusal} />}

      {/* ── Tab navigation + content ─────────────────────────────────────────── */}
      {!refused && (
        <div>
          {/* Tab bar */}
          <div
            className="flex gap-1.5 mb-6"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 14,
              padding: '5px',
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
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200"
                  style={{
                    padding: '9px 6px',
                    fontSize: 13,
                    background: active
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.25))'
                      : 'transparent',
                    border: active
                      ? '1px solid rgba(99,102,241,0.45)'
                      : '1px solid transparent',
                    color: active ? 'rgb(199,210,254)' : 'rgba(156,163,175,0.65)',
                    boxShadow: active
                      ? '0 0 18px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.08)'
                      : 'none',
                    transform: active ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                  {count != null && count > 0 && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 99, fontSize: 10.5,
                      fontFamily: 'monospace', fontWeight: 700,
                      background: active ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)',
                      color: active ? 'rgb(199,210,254)' : 'rgba(156,163,175,0.6)',
                      border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                    }}>
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
                            (f.weight || '').toLowerCase() === 'high'   ? 'bg-red-400'     :
                            (f.weight || '').toLowerCase() === 'medium' ? 'bg-amber-400'   :
                            'bg-emerald-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white leading-snug">
                              {f.label || 'Risk factor'}
                            </div>
                            {f.weight && (
                              <div className="text-xs text-gray-600 mt-0.5 capitalize">{f.weight} severity</div>
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
                    <RiskFactorCard key={i} factor={f} index={i} citationUrlMap={citationUrlMap} />
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

              {/* ── TRENDS ───────────────────────────────── */}
              {activeTab === 'trends' && (
                <div className="space-y-5">

                  {/* Intro callout */}
                  <div
                    className="rounded-xl px-5 py-4 flex items-start gap-3"
                    style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}
                  >
                    <BarChart2 size={15} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Years extracted from comparable-case citations. Each bar represents the number of
                      retrieved cases decided in that year — giving a rough sense of how the precedent
                      landscape evolved over time.
                    </p>
                  </div>

                  {sortedYears.length === 0 ? (
                    <div className="text-center py-10 text-gray-600 text-sm">
                      No dateable citations found in the comparable cases.
                    </div>
                  ) : (
                    <>
                      {/* Year-level bar chart */}
                      <div
                        className="rounded-2xl p-5"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div className="text-xs font-bold uppercase tracking-widest text-indigo-400/70 flex items-center gap-1.5 mb-5">
                          <BarChart2 size={11} />Cases by Year
                        </div>
                        <div className="space-y-2">
                          {sortedYears.map((year, i) => {
                            const pct = Math.round((yearCounts[year] / maxCount) * 100)
                            return (
                              <motion.div
                                key={year}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center gap-3"
                              >
                                <span className="text-xs font-mono text-gray-500 w-10 text-right flex-shrink-0">
                                  {year}
                                </span>
                                <div className="flex-1 h-5 rounded-md overflow-hidden"
                                     style={{ background: 'rgba(255,255,255,0.04)' }}>
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.5, delay: i * 0.04, ease: 'easeOut' }}
                                    className="h-full rounded-md"
                                    style={{
                                      background: `linear-gradient(90deg, rgba(99,102,241,0.7), rgba(139,92,246,0.5))`,
                                      minWidth: pct > 0 ? '8px' : 0,
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-mono text-gray-500 w-4 flex-shrink-0">
                                  {yearCounts[year]}
                                </span>
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Decade summary */}
                      {Object.keys(decadeMap).length > 1 && (
                        <div
                          className="rounded-2xl p-5"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          <div className="text-xs font-bold uppercase tracking-widest text-violet-400/70 flex items-center gap-1.5 mb-4">
                            <TrendingUp size={11} />Decade Breakdown
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {Object.entries(decadeMap)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([decade, count]) => (
                                <div
                                  key={decade}
                                  className="rounded-xl px-4 py-3 text-center"
                                  style={{
                                    background: 'rgba(139,92,246,0.07)',
                                    border: '1px solid rgba(139,92,246,0.18)',
                                  }}
                                >
                                  <div className="text-lg font-bold font-mono text-violet-300">{count}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">{decade}</div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Span callout */}
                      {sortedYears.length >= 2 && (
                        <div className="flex gap-4 text-center">
                          {[
                            { label: 'Earliest', value: sortedYears[0] },
                            { label: 'Latest',   value: sortedYears[sortedYears.length - 1] },
                            { label: 'Span',     value: `${parseInt(sortedYears[sortedYears.length - 1], 10) - parseInt(sortedYears[0], 10)} yrs` },
                          ].map(({ label, value }) => (
                            <div
                              key={label}
                              className="flex-1 rounded-xl py-3"
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                            >
                              <div className="text-base font-bold font-mono text-white">{value}</div>
                              <div className="text-xs text-gray-600 mt-0.5">{label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
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
      lines.push(`${i + 1}. [${f.weight || 'Unknown'}] ${f.label || ''}`)
      if (f.discussion) lines.push(`   ${f.discussion}`)
      if (f.citations?.length) lines.push(`   Citations: ${f.citations.join(' | ')}`)
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
