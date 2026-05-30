import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Database, Cpu, FileSearch, ShieldCheck, BarChart2 } from 'lucide-react'

const STAGES = [
  { id: 'embed',    icon: Cpu,         label: 'Embedding',          detail: 'Converting your claim into a 1024-dim semantic vector.',                       start: 0,     duration: 1400  },
  { id: 'retrieve', icon: Database,    label: 'Retrieving',         detail: 'Scanning the federal corpus via pgvector HNSW similarity search.',             start: 1400,  duration: 2200  },
  { id: 'generate', icon: FileSearch,  label: 'Generating',         detail: 'Claude Sonnet 4.6 drafting risk factors — citing only retrieved chunks.',      start: 3600,  duration: 13000 },
  { id: 'verify',   icon: ShieldCheck, label: 'Verifying',          detail: 'Cross-checking every citation against the live database.',                     start: 16600, duration: 1800  },
  { id: 'score',    icon: BarChart2,   label: 'Scoring',            detail: 'Computing your High / Medium / Low confidence band from three signals.',       start: 18400, duration: 1200  },
]

const FACTS = [
  'The Animal Welfare Act of 1966 was the first U.S. federal law regulating the treatment of animals in research.',
  'The 9th Circuit handles more animal law appeals than any other federal circuit.',
  'Standing to sue on behalf of animals was first seriously litigated in Animal Legal Defense Fund v. Glickman (1998).',
  'The Marine Mammal Protection Act of 1972 prohibits the "take" of any marine mammal in U.S. waters.',
  'In 2019, the 9th Circuit held that a monkey cannot hold a copyright — reinforcing that personhood is human.',
  'The Endangered Species Act allows citizen suits against federal agencies for failing to protect listed species.',
  'Federal circuits are split on whether advocacy organisations have automatic standing in animal law cases.',
]

// Orbital ring animation for the header
function OrbitalRing({ radius, duration, dotSize = 4, color = 'rgba(99,102,241,0.7)', delay = 0 }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        width: radius * 2,
        height: radius * 2,
        borderRadius: '50%',
        border: `1px solid rgba(99,102,241,0.12)`,
        top: '50%',
        left: '50%',
        marginTop: -radius,
        marginLeft: -radius,
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear', delay }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <div style={{
          position: 'absolute',
          top: -dotSize / 2,
          left: '50%',
          marginLeft: -dotSize / 2,
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 ${dotSize * 2}px ${color}`,
        }} />
      </motion.div>
    </motion.div>
  )
}

export default function PipelineLoader() {
  const [elapsed,     setElapsed]     = useState(0)
  const [factIndex,   setFactIndex]   = useState(0)
  const [factVisible, setFactVisible] = useState(true)

  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - t0), 80)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setFactVisible(false)
      setTimeout(() => { setFactIndex(i => (i + 1) % FACTS.length); setFactVisible(true) }, 350)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const statuses = STAGES.map((s, i) => {
    const nextStart = STAGES[i + 1]?.start ?? Infinity
    if (elapsed >= nextStart) return 'done'
    if (elapsed >= s.start)   return 'active'
    return 'pending'
  })

  const doneCount   = statuses.filter(s => s === 'done').length
  const activeIdx   = statuses.indexOf('active')
  const activeStage = STAGES[activeIdx]
  const progressPct = Math.min(
    (doneCount / STAGES.length) * 100 + (activeIdx >= 0 ? (1 / STAGES.length) * 55 : 0),
    94
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass-card max-w-lg mx-auto overflow-hidden"
    >
      {/* ── Hero header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(160deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 100%)',
        borderBottom: '1px solid rgba(99,102,241,0.15)',
        padding: '2rem 1.75rem 1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Orbital icon */}
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            {/* Core */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2,
            }}>
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(99,102,241,0.5), 0 0 40px rgba(99,102,241,0.2)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </motion.div>
            </div>
            <OrbitalRing radius={28} duration={3.2} dotSize={5} color="rgba(99,102,241,0.9)" />
            <OrbitalRing radius={20} duration={2.1} dotSize={3.5} color="rgba(167,139,250,0.8)" delay={0.5} />
          </div>

          <div>
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 99, padding: '2px 10px',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: 'rgb(165,180,252)', textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'rgb(129,140,248)',
                boxShadow: '0 0 6px rgba(129,140,248,0.8)',
                display: 'inline-block',
              }} />
              Live
            </motion.div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
              {activeStage ? activeStage.label + '…' : 'Finalising…'}
            </div>
            <div style={{ fontSize: 12, color: 'rgb(148,163,184)', marginTop: 3 }}>
              Stage {Math.min(doneCount + 1, STAGES.length)} of {STAGES.length}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          marginTop: '1.25rem',
          height: 4, borderRadius: 99,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <motion.div
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              height: '100%', borderRadius: 99,
              background: 'linear-gradient(90deg, #6366f1, #a78bfa, #38bdf8)',
              backgroundSize: '200% 100%',
              boxShadow: '0 0 10px rgba(99,102,241,0.6)',
            }}
          />
        </div>
      </div>

      {/* ── Stage list ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '1rem 1.25rem' }}>
        {STAGES.map((stage, i) => {
          const status    = statuses[i]
          const isActive  = status === 'active'
          const isDone    = status === 'done'
          const Icon      = stage.icon

          return (
            <motion.div
              key={stage.id}
              layout
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 12,
                marginBottom: 2,
                position: 'relative',
                background: isActive ? 'rgba(99,102,241,0.10)' : 'transparent',
                border: isActive ? '1px solid rgba(99,102,241,0.28)' : '1px solid transparent',
                transition: 'background 0.3s, border-color 0.3s',
              }}
            >
              {/* Active left accent */}
              {isActive && (
                <motion.div
                  layoutId="active-bar"
                  style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%',
                    width: 3, borderRadius: 99,
                    background: 'linear-gradient(180deg, #6366f1, #a78bfa)',
                    boxShadow: '0 0 8px rgba(99,102,241,0.7)',
                  }}
                />
              )}

              {/* Icon box */}
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone
                  ? 'rgba(99,102,241,0.15)'
                  : isActive
                  ? 'rgba(99,102,241,0.20)'
                  : 'rgba(255,255,255,0.04)',
                border: isDone
                  ? '1px solid rgba(99,102,241,0.3)'
                  : isActive
                  ? '1px solid rgba(99,102,241,0.4)'
                  : '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.3s',
              }}>
                {isDone
                  ? <Check size={13} color="rgb(129,140,248)" strokeWidth={2.5} />
                  : <Icon size={13} color={isActive ? 'rgb(165,180,252)' : 'rgba(156,163,175,0.4)'} />
                }
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 600,
                  color: isDone ? 'rgb(148,163,184)' : isActive ? 'white' : 'rgba(156,163,175,0.55)',
                  transition: 'color 0.3s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {stage.label}
                  {isActive && (
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ fontSize: 10, color: 'rgb(129,140,248)' }}
                    >
                      ●
                    </motion.span>
                  )}
                </div>
                <AnimatePresence>
                  {isActive && (
                    <motion.p
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 3 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ fontSize: 11, color: 'rgb(156,163,175)', lineHeight: 1.55, margin: 0 }}
                    >
                      {stage.detail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Step index */}
              <span style={{
                fontSize: 10, fontFamily: 'monospace', flexShrink: 0,
                color: isDone ? 'rgba(99,102,241,0.7)' : isActive ? 'rgb(129,140,248)' : 'rgba(107,114,128,0.4)',
                marginTop: 2,
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
            </motion.div>
          )
        })}
      </div>

      {/* ── Fact strip ───────────────────────────────────────────────────────── */}
      <div style={{
        margin: '0 1.25rem 1.25rem',
        padding: '1rem 1.1rem',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.08))',
        border: '1px solid rgba(99,102,241,0.3)',
        minHeight: 80,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* subtle glow */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 80, height: 80, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
        }}>
          <span style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
            color: 'rgb(165,180,252)', textTransform: 'uppercase',
          }}>
            Did you know?
          </span>
          <span style={{
            fontSize: 9, color: 'rgba(165,180,252,0.5)',
            fontStyle: 'italic',
          }}>· Federal Animal Law</span>
        </div>
        <AnimatePresence mode="wait">
          {factVisible && (
            <motion.p
              key={factIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              style={{ fontSize: 12.5, color: 'rgb(226,232,240)', lineHeight: 1.65, margin: 0, fontWeight: 400 }}
            >
              {FACTS[factIndex]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
