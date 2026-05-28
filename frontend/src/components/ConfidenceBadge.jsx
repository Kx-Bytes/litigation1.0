import { ShieldCheck, ShieldAlert, ShieldX, Shield } from 'lucide-react'
import { motion } from 'framer-motion'

/* ── Config ──────────────────────────────────────────────────────────────── */
const CONFIG = {
  high: {
    label:     'High Confidence',
    sublabel:  'Strong precedent support',
    icon:      ShieldCheck,
    color:     '#10b981',
    textColor: '#34d399',
    pct:       88,
    bg:        'rgba(16,185,129,0.06)',
    border:    'rgba(16,185,129,0.25)',
    glow:      'rgba(16,185,129,0.18)',
    trackGlow: 'rgba(16,185,129,0.3)',
  },
  medium: {
    label:     'Medium Confidence',
    sublabel:  'Moderate precedent support',
    icon:      ShieldAlert,
    color:     '#f59e0b',
    textColor: '#fcd34d',
    pct:       55,
    bg:        'rgba(245,158,11,0.06)',
    border:    'rgba(245,158,11,0.25)',
    glow:      'rgba(245,158,11,0.18)',
    trackGlow: 'rgba(245,158,11,0.3)',
  },
  low: {
    label:     'Low Confidence',
    sublabel:  'Limited precedent support',
    icon:      ShieldX,
    color:     '#ef4444',
    textColor: '#fca5a5',
    pct:       20,
    bg:        'rgba(239,68,68,0.06)',
    border:    'rgba(239,68,68,0.25)',
    glow:      'rgba(239,68,68,0.18)',
    trackGlow: 'rgba(239,68,68,0.3)',
  },
  refused: {
    label:     'Assessment Refused',
    sublabel:  'Corpus too thin to verify',
    icon:      Shield,
    color:     '#6b7280',
    textColor: '#9ca3af',
    pct:       0,
    bg:        'rgba(107,114,128,0.05)',
    border:    'rgba(107,114,128,0.22)',
    glow:      'rgba(107,114,128,0.12)',
    trackGlow: 'rgba(107,114,128,0.2)',
  },
}

/* ── SVG arc constants ───────────────────────────────────────────────────── */
const R    = 38          // circle radius
const SW   = 7           // stroke width
const CIRC = 2 * Math.PI * R   // full circumference ≈ 238.76

/* ─────────────────────────────────────────────────────────────────────────── */
export default function ConfidenceBadge({ band }) {
  const cfg  = CONFIG[band] || CONFIG.low
  const Icon = cfg.icon
  const offset = CIRC * (1 - cfg.pct / 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background:    cfg.bg,
        border:        `1px solid ${cfg.border}`,
        boxShadow:     `0 0 48px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.07)`,
        backdropFilter:'blur(14px) saturate(140%)',
      }}
    >
      {/* Subtle radial glow in the corner */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: '-40px', right: '-40px',
          width: '200px', height: '200px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex items-center gap-6 p-6">

        {/* ── SVG Circular gauge ──────────────────────── */}
        <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
          <svg
            width="96" height="96"
            viewBox="0 0 96 96"
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Background track */}
            <circle
              cx="48" cy="48" r={R}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={SW}
            />
            {/* Glow track behind the arc */}
            <motion.circle
              cx="48" cy="48" r={R}
              fill="none"
              stroke={cfg.color}
              strokeWidth={SW + 4}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
              style={{
                filter:  `blur(6px)`,
                opacity: 0.3,
              }}
            />
            {/* Main arc */}
            <motion.circle
              cx="48" cy="48" r={R}
              fill="none"
              stroke={cfg.color}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
              style={{
                filter: `drop-shadow(0 0 4px ${cfg.trackGlow})`,
              }}
            />
          </svg>

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon size={26} style={{ color: cfg.textColor }} />
          </div>
        </div>

        {/* ── Text content ─────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
            Confidence Band
          </div>

          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold leading-tight mb-0.5"
            style={{ color: cfg.textColor }}
          >
            {cfg.label}
          </motion.div>

          <div className="text-xs text-gray-500 mb-4">{cfg.sublabel}</div>

          {/* Animated progress bar */}
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${cfg.color}cc, ${cfg.color})`,
                boxShadow:  `0 0 10px ${cfg.color}80`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${cfg.pct}%` }}
              transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
            />
          </div>

          {cfg.pct > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-1.5 text-xs font-mono"
              style={{ color: cfg.color + 'aa' }}
            >
              {cfg.pct}% confidence score
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
