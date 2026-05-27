import { motion } from 'framer-motion'
import { ShieldOff, Info, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function RefusalCard({ refusal }) {
  const reason = refusal?.reason || 'The corpus did not contain sufficient on-point precedent to generate a verified assessment.'
  const suggestion = refusal?.suggestion

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-gray-500/25 bg-gray-500/8 p-7"
    >
      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-gray-500/8 blur-2xl" />
      </div>

      <div className="relative flex items-start gap-5">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gray-500/15 border border-gray-500/25 flex items-center justify-center">
          <ShieldOff size={22} className="text-gray-400" />
        </div>

        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-1">
            Assessment Refused
          </div>
          <h3 className="text-xl font-bold text-white mb-3">
            Insufficient Verified Precedent
          </h3>

          <p className="text-sm text-gray-400 leading-relaxed mb-4">
            {reason}
          </p>

          {/* Info callout */}
          <div className="flex items-start gap-2.5 bg-white/4 border border-white/8 rounded-xl p-4 mb-4">
            <Info size={14} className="flex-shrink-0 text-indigo-400 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">
              This is intentional. The cite-or-refuse contract ensures that when the retrieved case corpus
              is too thin or insufficiently on-point, the system refuses rather than generating ungrounded analysis.
              This protects against hallucinated citations.
            </p>
          </div>

          {suggestion && (
            <div className="mt-3">
              <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Suggestion</div>
              <p className="text-sm text-gray-300">{suggestion}</p>
            </div>
          )}

          {/* Try again CTA */}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Try a broader query
              <ArrowRight size={12} />
            </Link>
            <span className="text-gray-600 text-xs">or</span>
            <span className="text-xs text-gray-500">
              Expand jurisdiction or widen date range to increase corpus coverage
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
