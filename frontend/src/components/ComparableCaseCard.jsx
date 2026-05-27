import { motion } from 'framer-motion'
import { Scale, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'

function outcomeIcon(outcome) {
  if (!outcome) return <Minus size={12} className="text-gray-400" />
  const o = outcome.toLowerCase()
  if (o.includes('favor') || o.includes('win') || o.includes('success') || o.includes('affirm'))
    return <TrendingUp size={12} className="text-emerald-400" />
  if (o.includes('against') || o.includes('loss') || o.includes('fail') || o.includes('revers'))
    return <TrendingDown size={12} className="text-red-400" />
  return <Minus size={12} className="text-amber-400" />
}

function outcomeColor(outcome) {
  if (!outcome) return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
  const o = outcome.toLowerCase()
  if (o.includes('favor') || o.includes('win') || o.includes('success') || o.includes('affirm'))
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (o.includes('against') || o.includes('loss') || o.includes('fail') || o.includes('revers'))
    return 'text-red-400 bg-red-500/10 border-red-500/20'
  return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
}

export default function ComparableCaseCard({ case: c, index }) {
  const citation = c.citation || c.chunk_id || 'Unknown citation'
  const similarity = c.similarity_score != null ? Math.round(c.similarity_score * 100) : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="glass-card p-5 hover:bg-white/4 transition-colors group"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mt-0.5">
          <Scale size={15} className="text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Citation + link */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1">
              <span className="text-sm font-semibold text-white leading-snug">
                {citation}
              </span>
            </div>
            {c.source_url && (
              <a
                href={c.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ExternalLink size={11} />
                View case
              </a>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2">
            {c.outcome && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${outcomeColor(c.outcome)}`}>
                {outcomeIcon(c.outcome)}
                {c.outcome}
              </span>
            )}
            {similarity !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/6 text-gray-400 border border-white/10 font-mono">
                {similarity}% match
              </span>
            )}
            {c.jurisdiction && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {c.jurisdiction}
              </span>
            )}
          </div>

          {/* Relevance / excerpt */}
          {c.relevance && (
            <p className="mt-2.5 text-xs text-gray-400 leading-relaxed line-clamp-3">
              {c.relevance}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
