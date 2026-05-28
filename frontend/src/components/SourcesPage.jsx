import { motion } from 'framer-motion'
import {
  Database, Globe, FileText, Layers, Cpu, CheckCircle,
  AlertTriangle, ExternalLink, Scale, ArrowRight,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

const PIPELINE_STEPS = [
  { icon: Globe,    color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20',  label: 'Scrape',  desc: 'Async HTTP scraper fetches federal case pages from animallaw.info' },
  { icon: FileText, color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20',  label: 'Parse',   desc: 'Text normalisation, citation extraction via eyecite, Haiku category classification' },
  { icon: Layers,   color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20',  label: 'Chunk',   desc: '800-token sliding window with 10% overlap and section detection' },
  { icon: Cpu,      color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10 border-fuchsia-500/20', label: 'Embed',   desc: 'voyage-3-large produces 1024-dimensional semantic vectors per chunk' },
  { icon: Database, color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/20',      label: 'Index',   desc: 'pgvector HNSW index enables sub-millisecond cosine similarity search' },
]

const SOURCES = [
  {
    name:   'Animal Legal Defense Fund — animallaw.info',
    org:    'Michigan State University College of Law',
    url:    'https://www.animallaw.info',
    status: 'active',
    desc:   'The primary corpus source. The world\'s largest collection of animal law cases, statutes, and legal articles. The scraper targets federal case pages (circuit courts + SCOTUS), filtering out state-court opinions at ingest time.',
    stats:  [
      { label: 'Seed cases loaded', value: '16' },
      { label: 'Jurisdictions',     value: 'SCOTUS + 5 circuits' },
      { label: 'Scraper status',    value: 'Active' },
    ],
    color: 'indigo',
  },
  {
    name:   'CourtListener / RECAP Archive',
    org:    'Free Law Project',
    url:    'https://www.courtlistener.com',
    status: 'planned',
    desc:   'A planned secondary source. CourtListener\'s REST API provides structured access to millions of federal opinions with rich metadata (court, citation, date, judge). Would significantly expand circuit coverage beyond animallaw.info.',
    stats:  [
      { label: 'Federal opinions',  value: '4M+' },
      { label: 'API access',        value: 'Free tier' },
      { label: 'Integration',       value: 'Planned' },
    ],
    color: 'violet',
  },
  {
    name:   'Caselaw Access Project',
    org:    'Harvard Law School',
    url:    'https://case.law',
    status: 'planned',
    desc:   'Harvard\'s digitised archive of all US court decisions through 2020. Provides bulk download and an API. Would fill historical coverage gaps for older SCOTUS and circuit opinions relevant to animal law.',
    stats:  [
      { label: 'Total cases',       value: '6.7M' },
      { label: 'Date range',        value: '1658–2020' },
      { label: 'Integration',       value: 'Planned' },
    ],
    color: 'purple',
  },
]

const COLOR_MAP = {
  indigo: { badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25', bar: 'bg-indigo-500/20 border-indigo-500/25', icon: 'text-indigo-400' },
  violet: { badge: 'bg-violet-500/15 text-violet-400 border-violet-500/25', bar: 'bg-violet-500/20 border-violet-500/25', icon: 'text-violet-400' },
  purple: { badge: 'bg-purple-500/15 text-purple-400 border-purple-500/25', bar: 'bg-purple-500/20 border-purple-500/25', icon: 'text-purple-400' },
}

export default function SourcesPage() {
  return (
    <div className="min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="mb-14"
        >
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
            <span className="chip chip-indigo"><Database size={11} /> Data Sources</span>
            <span className="chip">Federal corpus only</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-4xl font-bold text-white mb-3">
            Where the case law comes from
          </motion.h1>
          <motion.p variants={fadeUp} className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            Every assessment is grounded in real federal cases. This page explains which sources
            feed the corpus, how cases are processed, and what's planned.
          </motion.p>
        </motion.div>

        {/* Corpus scope callout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card border border-indigo-500/20 bg-indigo-500/5 p-6 mb-12 flex items-start gap-4"
        >
          <Scale size={20} className="text-indigo-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-white mb-1">Federal cases only — by design</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              The corpus is restricted to U.S. Supreme Court opinions and federal circuit court decisions.
              State court cases are filtered out at ingest time. This keeps jurisdiction matching precise
              and avoids mixing binding and persuasive authority.
            </p>
          </div>
        </motion.div>

        {/* Sources */}
        <motion.div
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="space-y-6 mb-16"
        >
          <motion.h2 variants={fadeUp} className="font-display text-2xl font-bold text-white">
            Case law sources
          </motion.h2>

          {SOURCES.map((src) => {
            const cls = COLOR_MAP[src.color]
            return (
              <motion.div key={src.name} variants={fadeUp} className="glass-card p-7">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="font-semibold text-white text-lg leading-tight">{src.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        src.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                      }`}>
                        {src.status === 'active' ? '● Active' : '◌ Planned'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">{src.org}</div>
                  </div>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-400 transition-colors border border-white/10 rounded-lg px-3 py-1.5 hover:border-indigo-500/30"
                  >
                    <ExternalLink size={11} />
                    {src.url.replace('https://', '')}
                  </a>
                </div>

                <p className="text-sm text-gray-400 leading-relaxed mb-5">{src.desc}</p>

                <div className={`grid grid-cols-3 gap-3 p-4 rounded-xl border ${cls.bar}`}>
                  {src.stats.map(s => (
                    <div key={s.label} className="text-center">
                      <div className={`text-base font-bold font-mono ${cls.icon}`}>{s.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Ingest pipeline */}
        <motion.div
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="mb-16"
        >
          <motion.h2 variants={fadeUp} className="font-display text-2xl font-bold text-white mb-2">
            How cases are processed
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-500 text-sm mb-8">
            Every case goes through a five-stage pipeline before it's queryable.
          </motion.p>

          <div className="relative">
            {/* Spine */}
            <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-indigo-500/40 via-purple-500/20 to-transparent" />

            <div className="space-y-3">
              {PIPELINE_STEPS.map(({ icon: Icon, color, bg, label, desc }, i) => (
                <motion.div
                  key={label}
                  variants={fadeUp}
                  className="flex gap-5 glass-card p-5"
                >
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center ${bg}`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold font-mono text-gray-600">0{i + 1}</span>
                      <span className="font-semibold text-white">{label}</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Transparency note */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card border border-amber-500/20 bg-amber-500/5 p-6 flex items-start gap-4"
        >
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-white mb-1">Corpus limitations</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              The current seed corpus contains 16 federal cases. Assessments on topics with thin
              coverage will receive a <span className="text-amber-300 font-medium">low</span> or <span className="text-gray-300 font-medium">refused</span> confidence
              band until the scraper runs at scale. The corpus is designed to grow — confidence bands
              accurately reflect retrieval depth rather than masking it.
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
