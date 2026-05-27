import { motion } from 'framer-motion'

function Shimmer({ className = '' }) {
  return (
    <div className={`relative overflow-hidden bg-white/5 rounded-xl ${className}`}>
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/8 to-transparent"
        animate={{ translateX: ['−100%', '200%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear', repeatDelay: 0.4 }}
      />
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Shimmer className="w-9 h-9 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-3 w-1/4 rounded" />
          <Shimmer className="h-4 w-3/4 rounded" />
        </div>
      </div>
      <Shimmer className="h-3 w-full rounded" />
      <Shimmer className="h-3 w-5/6 rounded" />
    </div>
  )
}

export default function LoadingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Confidence badge skeleton */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Shimmer className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Shimmer className="h-2.5 w-24 rounded" />
            <Shimmer className="h-5 w-36 rounded" />
          </div>
        </div>
        <Shimmer className="h-1.5 w-full rounded-full" />
      </div>

      {/* Section label */}
      <div className="flex items-center gap-3">
        <Shimmer className="h-3 w-32 rounded" />
        <div className="flex-1 h-px bg-white/6" />
      </div>

      {/* Risk factor cards */}
      {[0, 1, 2].map(i => (
        <SkeletonCard key={i} />
      ))}

      {/* Section label */}
      <div className="flex items-center gap-3 mt-2">
        <Shimmer className="h-3 w-40 rounded" />
        <div className="flex-1 h-px bg-white/6" />
      </div>

      {/* Comparable case cards */}
      {[0, 1].map(i => (
        <SkeletonCard key={i} />
      ))}

      {/* Strategic considerations */}
      <div className="glass-card p-5 space-y-2">
        <Shimmer className="h-3 w-44 rounded mb-3" />
        <Shimmer className="h-3 w-full rounded" />
        <Shimmer className="h-3 w-full rounded" />
        <Shimmer className="h-3 w-4/5 rounded" />
      </div>
    </motion.div>
  )
}
