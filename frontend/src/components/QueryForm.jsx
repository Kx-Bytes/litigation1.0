import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, Calendar, Info,
  SlidersHorizontal, X, Database, ArrowUp,
  Paperclip, FileText, CheckCircle,
} from 'lucide-react'
import { JURISDICTIONS } from '../lib/jurisdictions'
import { useTheme } from '../hooks/useTheme'

function autoResize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, el.dataset.maxH ? parseInt(el.dataset.maxH) : 9999) + 'px'
}

function formatDisplayDate(iso) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(iso + 'T00:00:00'))
  } catch { return iso }
}

const DEFAULT_K = 8

const POSTURES = [
  { value: '',                    label: 'Any posture'            },
  { value: 'Motion to Dismiss',   label: 'Motion to Dismiss'      },
  { value: 'Summary Judgment',    label: 'Summary Judgment'       },
  { value: 'Preliminary Injunction', label: 'Preliminary Injunction' },
  { value: 'Appellate Review',    label: 'Appellate Review'       },
  { value: 'Trial',               label: 'Trial'                  },
  { value: 'Class Certification', label: 'Class Certification'    },
  { value: 'TRO',                 label: 'Temporary Restraining Order' },
]

export default function QueryForm({ onSubmit, loading, initialValues }) {
  const [jurisdiction,      setJurisdiction]      = useState(initialValues?.jurisdiction || 'US-9th-Cir')
  const [claim,             setClaim]             = useState(initialValues?.claim || '')
  const [facts,             setFacts]             = useState(initialValues?.facts || '')
  const [posture,           setPosture]           = useState('')
  const [dateFrom,          setDateFrom]          = useState('')
  const [dateTo,            setDateTo]            = useState('')
  const [showAdvanced,      setShowAdvanced]      = useState(false)
  const [k,                 setK]                 = useState(DEFAULT_K)
  const [jurOpen,           setJurOpen]           = useState(false)
  const [postureOpen,       setPostureOpen]       = useState(false)
  const [uploadedFileName,  setUploadedFileName]  = useState(null)
  const [uploadError,       setUploadError]       = useState(null)
  const { theme } = useTheme()

  const claimRef   = useRef(null)
  const factsRef   = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    autoResize(claimRef.current)
    autoResize(factsRef.current)
  }, [])

  const selectedJur     = JURISDICTIONS.find(j => j.value === jurisdiction) || JURISDICTIONS[0]
  const selectedPosture = POSTURES.find(p => p.value === posture) || POSTURES[0]
  const charsLeft       = Math.max(0, 4000 - facts.length)
  const factWarn        = charsLeft < 400

  // ── Document upload ────────────────────────────────────────────────────────
  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)

    const ext = file.name.split('.').pop().toLowerCase()

    if (ext === 'txt') {
      const reader = new FileReader()
      reader.onload = ev => {
        const text = ev.target.result?.trim()
        if (!text) { setUploadError('File appears to be empty.'); return }
        appendToFacts(text, file.name)
      }
      reader.readAsText(file)
    } else if (ext === 'docx') {
      // Use mammoth.js (available in the project via npm/CDN)
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const mammoth = (await import('mammoth'))
          const result  = await mammoth.extractRawText({ arrayBuffer: ev.target.result })
          const text    = result.value?.trim()
          if (!text) { setUploadError('Could not extract text from document.'); return }
          appendToFacts(text, file.name)
        } catch {
          setUploadError('Failed to parse .docx file. Try copying the text manually.')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setUploadError('Supported formats: .txt, .docx')
    }

    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  function appendToFacts(text, fileName) {
    const prefix  = `[Extracted from: ${fileName}]\n`
    const current = facts.trim()
    const merged  = current ? `${current}\n\n${prefix}${text}` : `${prefix}${text}`
    const capped  = merged.slice(0, 4000)
    setFacts(capped)
    setUploadedFileName(fileName)
    setTimeout(() => {
      autoResize(factsRef.current)
    }, 0)
  }

  // ── Form submit ────────────────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault()
    if (!claim.trim() || loading) return

    onSubmit({
      jurisdiction,
      claim: claim.trim(),
      facts: facts.trim(),
      ...(posture ? { procedural_posture: posture } : {}),
      options: {
        k,
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo   ? { date_to:   dateTo   } : {}),
      },
    })
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    function close(e) {
      if (!e.target.closest('[data-jur-dropdown]'))     setJurOpen(false)
      if (!e.target.closest('[data-posture-dropdown]')) setPostureOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">

      {/* ── Advanced panel (slides in above) ────────────────────────────── */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            key="advanced"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-4 pb-3 space-y-4 border-b border-white/[0.07]">

              {/* Date range */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                    <Calendar size={11} />
                    Filter by case date
                  </span>
                  <span className="text-xs text-gray-600">Leave blank for all years</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'From', val: dateFrom, set: setDateFrom, max: dateTo || undefined, min: undefined },
                    { label: 'To',   val: dateTo,   set: setDateTo,   min: dateFrom || undefined, max: undefined },
                  ].map(({ label, val, set, max, min }) => (
                    <div key={label}>
                      <div className="text-xs text-gray-600 mb-1">{label}</div>
                      <div className="relative">
                        <input
                          type="date"
                          value={val}
                          onChange={e => set(e.target.value)}
                          max={max}
                          min={min}
                          className="input-field w-full text-sm pr-7"
                          style={{ colorScheme: 'dark' }}
                        />
                        {val && (
                          <button type="button" onClick={() => set('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300"
                            tabIndex={-1}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {dateFrom && dateTo && (
                  <div className="mt-2 text-xs text-indigo-400 flex items-center gap-1.5">
                    <Calendar size={10} />
                    {formatDisplayDate(dateFrom)} → {formatDisplayDate(dateTo)}
                    <button type="button" onClick={() => { setDateFrom(''); setDateTo('') }}
                      className="ml-auto text-gray-600 hover:text-gray-300"><X size={10} /></button>
                  </div>
                )}
              </div>

              {/* Retrieval depth */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database size={12} className="text-indigo-400" />
                    <span className="text-xs font-medium text-white">
                      Retrieval depth
                      <span className="ml-1.5 font-bold text-indigo-400 font-mono">{k}</span>
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                    k <= 5  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    k <= 12 ? 'bg-amber-500/10  border-amber-500/20  text-amber-400'   :
                              'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                  }`}>{k <= 5 ? 'Fast' : k <= 12 ? 'Balanced' : 'Thorough'}</span>
                </div>
                <input
                  type="range" min={3} max={20} value={k}
                  onChange={e => setK(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-500"
                  style={{ background: `linear-gradient(to right, rgb(99,102,241) ${((k-3)/(20-3))*100}%, rgba(255,255,255,0.1) ${((k-3)/(20-3))*100}%)` }}
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>3 — faster</span><span>20 — more context</span>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top row: jurisdiction + posture + controls ───────────────────── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-wrap">

        {/* Jurisdiction selector */}
        <div className="relative" data-jur-dropdown>
          <button
            type="button"
            onClick={() => { setJurOpen(o => !o); setPostureOpen(false) }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                       bg-white/[0.05] border border-white/10
                       hover:bg-white/[0.09] hover:border-white/20
                       transition-all duration-150 cursor-pointer"
          >
            <span className="font-mono text-indigo-400 font-semibold">{selectedJur.short}</span>
            <span className="text-gray-400 hidden sm:inline truncate max-w-[140px]">{selectedJur.label}</span>
            <ChevronDown size={12} className={`text-gray-500 flex-shrink-0 transition-transform duration-150 ${jurOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {jurOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.13 }}
                className="absolute z-50 bottom-full mb-2 w-72 rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden"
                style={{
                  background: theme === 'dark' ? 'rgba(6,13,31,0.97)' : 'rgba(249,250,251,0.97)',
                  borderColor: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)',
                }}
              >
                <div className="max-h-56 overflow-y-auto py-1">
                  {JURISDICTIONS.map(j => (
                    <button key={j.value} type="button"
                      onClick={() => { setJurisdiction(j.value); setJurOpen(false) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left
                        ${theme === 'dark' ? 'hover:bg-white/6' : 'hover:bg-black/5'}
                        ${j.value === jurisdiction
                          ? theme === 'dark' ? 'bg-indigo-500/12 text-indigo-300' : 'bg-indigo-500/15 text-indigo-700'
                          : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      <span className="text-xs font-mono bg-white/6 px-1.5 py-0.5 rounded w-16 text-center flex-shrink-0 text-gray-400">
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

        {/* Procedural posture selector */}
        <div className="relative" data-posture-dropdown>
          <button
            type="button"
            onClick={() => { setPostureOpen(o => !o); setJurOpen(false) }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer ${
              posture
                ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                : 'bg-white/[0.05] border-white/10 text-gray-400 hover:bg-white/[0.09] hover:border-white/20'
            }`}
          >
            <span>{posture || 'Posture'}</span>
            <ChevronDown size={12} className={`text-gray-500 flex-shrink-0 transition-transform duration-150 ${postureOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {postureOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.13 }}
                className="absolute z-50 bottom-full mb-2 w-56 rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden"
                style={{
                  background: theme === 'dark' ? 'rgba(6,13,31,0.97)' : 'rgba(249,250,251,0.97)',
                  borderColor: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)',
                }}
              >
                <div className="py-1">
                  {POSTURES.map(p => (
                    <button key={p.value} type="button"
                      onClick={() => { setPosture(p.value); setPostureOpen(false) }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors text-left
                        ${theme === 'dark' ? 'hover:bg-white/6' : 'hover:bg-black/5'}
                        ${p.value === posture
                          ? theme === 'dark' ? 'bg-violet-500/12 text-violet-300' : 'bg-violet-500/15 text-violet-700'
                          : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {p.value === posture && <CheckCircle size={12} className="text-violet-400 flex-shrink-0" />}
                      <span className="truncate">{p.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Document upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.docx"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload document (.txt or .docx)"
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 ${
            uploadedFileName
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-white/[0.04] border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/[0.08]'
          }`}
        >
          {uploadedFileName
            ? <><FileText size={12} /><span className="hidden sm:inline max-w-[80px] truncate">{uploadedFileName}</span></>
            : <><Paperclip size={12} /><span className="hidden sm:inline">Upload doc</span></>
          }
        </button>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(o => !o)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 flex-shrink-0 ${
            showAdvanced
              ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
              : 'bg-white/[0.04] border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/[0.08]'
          }`}
        >
          <SlidersHorizontal size={12} />
          <span className="hidden sm:inline">Advanced</span>
        </button>
      </div>

      {/* Upload error */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-1 text-xs text-red-400 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
          >
            <X size={11} />
            {uploadError}
            <button type="button" onClick={() => setUploadError(null)} className="ml-auto"><X size={10} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Claim textarea ────────────────────────────────────────────────── */}
      <div className="px-4 pb-1">
        <div className="flex gap-3 items-start">
          <div className="flex-shrink-0 w-20 pt-2.5 text-right">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider leading-none">Claim</span>
            <span className="block text-red-400 text-xs mt-0.5">required</span>
          </div>
          <textarea
            ref={claimRef}
            value={claim}
            onChange={e => { setClaim(e.target.value); autoResize(e.target) }}
            placeholder="e.g. Agency unlawfully failed to designate critical habitat under ESA § 4"
            className="input-field flex-1 resize-none leading-relaxed text-sm"
            data-max-h="120"
            rows={2}
            required
            maxLength={500}
            style={{ minHeight: '3.5rem', maxHeight: '7.5rem', overflowY: 'auto' }}
          />
        </div>
      </div>

      {/* ── Facts textarea + submit ───────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <div className="flex gap-3 items-start">
          <div className="flex-shrink-0 w-20 pt-2.5 text-right">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider leading-none">Facts</span>
            <span className="block text-gray-600 text-xs mt-0.5">optional</span>
          </div>
          <div className="relative flex-1">
            <textarea
              ref={factsRef}
              value={facts}
              onChange={e => { setFacts(e.target.value); autoResize(e.target) }}
              placeholder="Parties, statutes, agency conduct, dates, injuries…"
              className="input-field w-full resize-none leading-relaxed text-sm pr-14"
              data-max-h="220"
              rows={5}
              maxLength={4000}
              style={{ minHeight: '8rem', maxHeight: '13.75rem', overflowY: 'auto' }}
            />

            {/* Send button */}
            <motion.button
              type="submit"
              disabled={loading || !claim.trim()}
              whileHover={{ scale: loading || !claim.trim() ? 1 : 1.05 }}
              whileTap={{ scale: loading || !claim.trim() ? 1 : 0.95 }}
              className="absolute bottom-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center
                         transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                         bg-indigo-500 hover:bg-indigo-400 shadow-lg shadow-indigo-500/30"
              title="Run Assessment"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <ArrowUp size={16} className="text-white" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Bottom meta row */}
        <div className="flex items-center justify-between mt-1.5" style={{ paddingLeft: '5.75rem' }}>
          <span className={`text-xs font-mono ${factWarn ? 'text-amber-400' : 'text-gray-700'}`}>
            {charsLeft} chars left
          </span>
          <span className="text-xs text-gray-700 hidden sm:inline">
            Not legal advice · federal corpus only
          </span>
        </div>
      </div>

    </form>
  )
}
