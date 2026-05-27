import { ShieldCheck, ShieldAlert, ShieldX, Shield } from 'lucide-react'
import { motion } from 'framer-motion'

const CONFIG = {
  high:    { label: 'High Confidence',   icon: ShieldCheck, bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500', width: '90%', glow: 'shadow-emerald-500/20' },
  medium:  { label: 'Medium Confidence', icon: ShieldAlert, bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400',   bar: 'bg-amber-500',   width: '55%', glow: 'shadow-amber-500/20' },
  low:     { label: 'Low Confidence',    icon: ShieldX,     bg: 'bg-red-500/15',      border: 'border-red-500/30',     text: 'text-red-400',     bar: 'bg-red-500',     width: '25%', glow: 'shadow-red-500/20' },
  refused: { label: 'Refused',           icon: Shield,      bg: 'bg-gray-500/15',     border: 'border-gray-500/30',    text: 'text-gray-400',    bar: 'bg-gray-500',    width: '0%',  glow: 'shadow-gray-500/20' },
}

export default function ConfidenceBadge({ band }) {
  const cfg = CONFIG[band] || CONFIG.low
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${cfg.bg} border ${cfg.border} rounded-2xl p-5 shadow-lg ${cfg.glow}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
          <Icon size={20} className={cfg.text} />
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest font-medium">Confidence Band</div>
          <div className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</div>
        </div>
      </div>

      {/* Animated bar */}
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: cfg.width }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className={`h-full ${cfg.bar} rounded-full`}
        />
      </div>
    </motion.div>
  )
}
