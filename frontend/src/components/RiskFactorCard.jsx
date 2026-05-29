import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, AlertTriangle, BookOpen, ExternalLink } from 'lucide-react'

function severityConfig(severity) {
  if (!severity) return { dot: 'bg-gray-400', label: 'Unknown', ring: 'border-gray-500/20' }
  const s = severity.toLowerCase()
  if (s === 'high')   return { dot: 'bg-red-400',    label: 'High',   ring: 'border-red-500/20' }
  if (s === 'medium') return { dot: 'bg-amber-400',  label: 'Medium', ring: 'border-amber-500/20' }
  if (s === 'low')    return { dot: 'bg-emerald-400',label: 'Low',    ring: 'border-emerald-500/20' }
  return                     { dot: 'bg-gray-400',   label: severity, ring: 'border-gray-500/20' }
}

export default function RiskFactorCard({ factor, index, citationUrlMap = {} }) {
  const [open, setOpen] = useState(index === 0)
  const cfg = severityConfig(factor.weight)
  const citations = [...new Set(factor.citations || [])]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`glass-card border ${cfg.ring} overflow-hidden`}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-4 p-5 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex-shrink-0 mt-0.5">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dot} shadow-sm`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Risk Factor {index + 1}
            </span>
            {factor.weight && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-gray-400 border border-white/10">
                {cfg.label}
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-white leading-snug pr-4">
            {factor.label || 'Unnamed factor'}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-gray-500 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className="px-5 pb-5 pt-0 border-t border-white/6 space-y-4">
              {factor.discussion && (
                <div className="mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={12} className="text-amber-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Analysis</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{factor.discussion}</p>
                </div>
              )}

              {citations.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen size={12} className="text-indigo-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Supporting Citations ({citations.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {citations.map((cit, i) => {
                      const url = citationUrlMap[cit]
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs text-gray-400 bg-white/4 rounded-lg px-3 py-2 border border-white/6"
                        >
                          <span className="flex-shrink-0 text-indigo-500 font-mono mt-0.5">[{i + 1}]</span>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono break-all text-indigo-300 hover:text-indigo-100 underline underline-offset-2 transition-colors"
                            >
                              {cit}
                            </a>
                          ) : (
                            <span className="font-mono break-all">{cit}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
