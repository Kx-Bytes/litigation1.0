import { useEffect, useRef, useState } from 'react'
import { Link }           from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  Scale, Shield, Zap, BookOpen, ArrowRight,
  AlertTriangle, BarChart3, CheckCircle, ChevronRight,
} from 'lucide-react'
import ParticleNetwork  from './effects/ParticleNetwork'
import TiltCard         from './effects/TiltCard'
import AnimatedCounter  from './effects/AnimatedCounter'

/* ── Variants ────────────────────────────────────────────────────────────── */
const fadeUp  = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }

/* ── Feature data ────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Shield,   color: 'indigo',
    title: 'Cite-or-Refuse Contract',
    desc:  'Every citation is verified against retrieved case chunks. The model cannot hallucinate — it either cites real precedent or refuses to answer.',
    gradient: 'from-indigo-500/20 via-indigo-600/8 to-transparent',
    glow: 'rgba(99,102,241,0.15)',
  },
  {
    icon: BarChart3, color: 'emerald',
    title: 'Pipeline Confidence Bands',
    desc:  'High / Medium / Low / Refused — computed from similarity scores, jurisdiction match rate, and citation verification, not model self-report.',
    gradient: 'from-emerald-500/20 via-emerald-600/8 to-transparent',
    glow: 'rgba(52,211,153,0.15)',
  },
  {
    icon: BookOpen, color: 'amber',
    title: 'Federal Corpus Only',
    desc:  'Supreme Court and all 13 circuit courts. Jurisdiction-aware retrieval ensures only on-point precedent reaches the assessment.',
    gradient: 'from-amber-500/20 via-amber-600/8 to-transparent',
    glow: 'rgba(245,158,11,0.12)',
  },
  {
    icon: Zap,      color: 'purple',
    title: 'Sub-Second Retrieval',
    desc:  'pgvector HNSW index over voyage-3-large embeddings delivers top-k semantic search across the full case corpus in milliseconds.',
    gradient: 'from-purple-500/20 via-purple-600/8 to-transparent',
    glow: 'rgba(167,139,250,0.15)',
  },
]

const COLOR_MAP = {
  indigo:  { text: 'text-indigo-400',  border: 'border-indigo-500/25',  bg: 'bg-indigo-500/12'  },
  emerald: { text: 'text-emerald-400', border: 'border-emerald-500/25', bg: 'bg-emerald-500/12' },
  amber:   { text: 'text-amber-400',   border: 'border-amber-500/25',   bg: 'bg-amber-500/12'   },
  purple:  { text: 'text-purple-400',  border: 'border-purple-500/25',  bg: 'bg-purple-500/12'  },
}

/* ── Pipeline steps ──────────────────────────────────────────────────────── */
const STEPS = [
  { step: '01', title: 'Embed your query',          desc: 'voyage-3-large encodes your claim and facts into a 1024-dimension semantic vector.',                          color: 'text-indigo-400'  },
  { step: '02', title: 'Retrieve precedent',         desc: 'pgvector finds the top-k most similar case chunks within your jurisdiction using HNSW cosine search.',        color: 'text-violet-400'  },
  { step: '03', title: 'Generate assessment',        desc: 'Claude receives retrieved chunks and must cite only from that set — or refuse if the corpus is too thin.',     color: 'text-purple-400'  },
  { step: '04', title: 'Verify citations',           desc: 'Every cited chunk_id is cross-checked against the retrieved set and the database in a round-trip pass.',      color: 'text-fuchsia-400' },
  { step: '05', title: 'Compute confidence',         desc: 'Similarity scores, jurisdiction match rate, and verification rate combine into an objective confidence band.',  color: 'text-pink-400'    },
  { step: '06', title: 'Return structured results',  desc: 'Risk factors, comparable cases, strategic considerations, and caveats — grounded in verified citations.',      color: 'text-rose-400'    },
]

/* ─────────────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const { scrollY } = useScroll()
  const heroY       = useTransform(scrollY, [0, 600], [0, -130])

  /* Typewriter for hero badge */
  const [badgeText, setBadgeText] = useState('')
  const FULL_BADGE = 'AI-Powered Litigation Strategy'
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      setBadgeText(FULL_BADGE.slice(0, ++i))
      if (i >= FULL_BADGE.length) clearInterval(id)
    }, 44)
    return () => clearInterval(id)
  }, [])

  /* Cycling active pipeline step */
  const [activeStep, setActiveStep] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 1700)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen relative overflow-x-hidden">

      {/* ── Particle canvas ─────────────────────────────────────────────── */}
      <ParticleNetwork opacity={0.45} />

      {/* ── Aurora spinning blob (hero area only) ───────────────────────── */}
      <div aria-hidden="true" className="fixed pointer-events-none overflow-hidden"
           style={{ top: '-20%', left: '20%', width: '60%', height: '60%', zIndex: 0 }}>
        <div className="aurora" style={{ borderRadius: '50%', opacity: 0.18 }} />
      </div>

      {/* ── Drifting aurora orbs ────────────────────────────────────────── */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="blur-orb w-[640px] h-[640px] bg-indigo-600/10"  style={{ top: '-12%', left:  '-8%'  }} />
        <div className="blur-orb w-[500px] h-[500px] bg-purple-600/8"   style={{ top: '28%',  right: '-6%', animationDelay: '3.5s' }} />
        <div className="blur-orb w-[380px] h-[380px] bg-violet-600/7"   style={{ bottom: '4%', left: '30%', animationDelay: '7s'  }} />
        <div className="blur-orb w-[280px] h-[280px] bg-sky-500/5"      style={{ top: '60%',  left: '8%',  animationDelay: '10s' }} />
      </div>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="relative pt-40 pb-32 px-6" style={{ zIndex: 1 }}>
        <motion.div style={{ y: heroY }} className="max-w-4xl mx-auto text-center">

          {/* Beacon badge with typewriter */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full
                       bg-indigo-500/10 border border-indigo-500/25 text-indigo-400
                       text-sm font-medium mb-9"
          >
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-indigo-400"
                    style={{ animation: 'beacon 1.8s ease-out infinite' }} />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-indigo-400" />
            </span>
            <span className="min-w-[16ch] text-left">
              {badgeText}<span className="animate-pulse text-indigo-300">|</span>
            </span>
          </motion.div>

          {/* Heading — word-by-word stagger */}
          <div className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.06] mb-7">
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-wrap justify-center gap-x-4">
              {['Litigation', 'Risk', 'Assessment'].map(word => (
                <motion.span key={word} variants={fadeUp} style={{ display: 'inline-block' }}>
                  {word}
                </motion.span>
              ))}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.7, ease: [0.22,1,0.36,1] }}
              className="mt-2"
            >
              <span className="text-gradient-animate text-glow-indigo block">
                Built for Animal Advocates
              </span>
            </motion.div>
          </div>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.6 }}
            className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto mb-11"
          >
            Assess litigation risk, research precedent, and evaluate strategic options —
            grounded exclusively in verified federal case law.{' '}
            <span className="text-gray-300 font-medium">No hallucinations. No guesswork.</span>
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.62, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
          >
            <Link to="/analyze" className="btn-primary flex items-center gap-2 text-base px-8 py-4 neon-indigo">
              Start Analysis <ArrowRight size={16} />
            </Link>
            <Link to="/history" className="btn-secondary text-base px-7 py-4">
              View History
            </Link>
          </motion.div>

          {/* Trust row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.82 }}
            className="flex flex-wrap items-center justify-center gap-5 text-xs text-gray-600"
          >
            {[
              { icon: CheckCircle, label: '0 hallucinated citations' },
              { icon: Shield,      label: '3-layer verification' },
              { icon: Scale,       label: '13 federal circuits' },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <Icon size={12} className="text-emerald-500" />
                {label}
              </span>
            ))}
          </motion.div>

          {/* Tech-stack chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.95 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            {[
              { label: 'pgvector',        color: 'chip-indigo' },
              { label: 'voyage-3-large',  color: 'chip-indigo' },
              { label: 'HNSW index',      color: 'chip-indigo' },
              { label: 'FastAPI',         color: '' },
              { label: 'React',           color: '' },
              { label: '3-layer verify',  color: 'chip-emerald' },
            ].map(({ label, color }) => (
              <span key={label} className={`chip ${color}`}>{label}</span>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.05 }}
            className="mt-6 text-xs text-gray-700 flex items-center justify-center gap-1.5"
          >
            <AlertTriangle size={11} />
            Informational risk assessment only — not legal advice. Always consult qualified counsel.
          </motion.p>
        </motion.div>
      </section>

      {/* ══ STATS BAR ═══════════════════════════════════════════════════════ */}
      <section className="relative border-y border-white/[0.07] py-10 px-6" style={{ zIndex: 1 }}>
        {/* Dot grid overlay */}
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(rgba(99,102,241,0.08) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: 16, suffix: '+', label: 'Seed Cases',            duration: 1200 },
            { value: 13, suffix: '',  label: 'Circuits Covered',      duration: 1500 },
            { value: 3,  suffix: 'x', label: 'Citation Checks',       duration: 900  },
            { value: 0,  suffix: '',  label: 'Hallucinated Citations', duration: 600  },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <AnimatedCounter
                value={s.value}
                suffix={s.suffix}
                duration={s.duration}
                className="text-4xl font-bold text-gradient-animate block"
              />
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
      <section className="relative py-28 px-6" style={{ zIndex: 1 }}>
        <div className="max-w-6xl mx-auto">

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-16 space-y-3"
          >
            <motion.div variants={fadeUp}>
              <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                Core Architecture
              </span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-4xl font-bold">
              Built on Verified Precedhgc
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 max-w-xl mx-auto">
              Every feature is designed around one principle: assessments must be grounded
              in real cases, not model imagination.
            </motion.p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid md:grid-cols-2 gap-5"
          >
            {FEATURES.map(({ icon: Icon, color, title, desc, gradient, glow }) => {
              const cls = COLOR_MAP[color]
              return (
                <motion.div key={title} variants={fadeUp}>
                  <TiltCard
                    intensity={10}
                    className={`glow-border-card rounded-2xl p-7 bg-gradient-to-br ${gradient} cursor-default h-full`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl border ${cls.border} ${cls.bg} flex items-center justify-center mb-5`}
                      style={{ boxShadow: `0 0 22px ${glow}` }}
                    >
                      <Icon size={21} className={cls.text} />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2.5">{title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                    <div className={`mt-5 h-px bg-gradient-to-r ${gradient}`} />
                  </TiltCard>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ══ HOW IT WORKS — live pipeline scanner ════════════════════════════ */}
      <section className="relative py-24 px-6 border-t border-white/[0.06]" style={{ zIndex: 1 }}>
        <div className="max-w-3xl mx-auto">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-purple-400 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
              RAG Pipeline
            </span>
            <h2 className="font-display text-3xl font-bold mt-4 mb-3">How It Works</h2>
            <p className="text-gray-400">Six steps from your query to a verified assessment</p>
          </motion.div>

          <div className="relative">
            {/* Vertical spine */}
            <div className="absolute left-[31px] top-6 bottom-6 w-px bg-gradient-to-b from-indigo-500/40 via-purple-500/20 to-transparent" />

            <div className="space-y-3">
              {STEPS.map(({ step, title, desc, color }, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className={`pipeline-step flex gap-5 rounded-2xl p-5 border transition-all duration-500 ${
                    activeStep === i
                      ? 'bg-white/[0.055] border-white/15 shadow-xl shadow-indigo-500/8'
                      : 'bg-white/[0.02] border-white/[0.06]'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
                      activeStep === i
                        ? 'bg-indigo-500/25 border border-indigo-500/45 shadow-lg shadow-indigo-500/25'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <span className={`text-xs font-bold font-mono ${activeStep === i ? color : 'text-gray-600'}`}>
                      {step}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold mb-1 transition-colors duration-500 ${activeStep === i ? 'text-white' : 'text-gray-400'}`}>
                      {title}
                    </div>
                    <div className="text-sm text-gray-500 leading-relaxed">{desc}</div>
                  </div>
                  {activeStep === i && (
                    <motion.div
                      layoutId="active-indicator"
                      className="flex-shrink-0 self-center"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <ChevronRight size={16} className="text-indigo-400" />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-14"
          >
            <Link to="/analyze" className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-base neon-indigo">
              Try it now <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer className="relative border-t border-white/[0.06] py-8 px-6" style={{ zIndex: 1 }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Scale size={14} />
            <span>OpenPaws Litigation Strategy</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <span className="live-dot" />
            <span>Federal corpus active</span>
          </div>
          <span className="text-xs text-gray-700">Informational use only. Not legal advice.</span>
        </div>
      </footer>

    </div>
  )
}
