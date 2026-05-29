import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Heart, Shield, Code2, BookOpen, AlertTriangle,
  ExternalLink, Scale, Layers, Cpu, Database,
  ArrowRight, Users,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

const TECH_STACK = [
  { layer: 'Retrieval',   icon: Database, color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20',  items: ['pgvector (HNSW index)', 'voyage-3-large embeddings', 'PostgreSQL 16', 'Jurisdiction-aware search'] },
  { layer: 'Generation',  icon: Cpu,      color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20',  items: ['Claude Sonnet 4.6', 'Cite-or-refuse tool_use', 'Enum-locked chunk IDs', '2-level citation verifier'] },
  { layer: 'Backend',     icon: Code2,    color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20',  items: ['FastAPI + Python 3.12', 'SQLAlchemy (async)', 'Alembic migrations', 'structlog + Docker'] },
  { layer: 'Frontend',    icon: Layers,   color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/20',      items: ['React 18 + Vite', 'Tailwind CSS', 'Framer Motion', 'Axios + React Router'] },
]

const PRINCIPLES = [
  {
    icon:  Shield,
    color: 'text-indigo-400',
    bg:    'bg-indigo-500/10 border-indigo-500/20',
    title: 'No hallucinated citations',
    desc:  'The pipeline uses tool_use with enum-locked chunk IDs — Claude physically cannot reference a case that wasn\'t retrieved. A two-level verifier then cross-checks every citation against the database before it reaches the user.',
  },
  {
    icon:  BookOpen,
    color: 'text-emerald-400',
    bg:    'bg-emerald-500/10 border-emerald-500/20',
    title: 'Transparent confidence',
    desc:  'Confidence bands (High / Medium / Low / Refused) are computed from three objective pipeline signals — retrieval depth, jurisdiction match rate, and citation verification rate. The model\'s self-reported confidence is deliberately ignored.',
  },
  {
    icon:  Scale,
    color: 'text-amber-400',
    bg:    'bg-amber-500/10 border-amber-500/20',
    title: 'Federal corpus, explicitly scoped',
    desc:  'The corpus is restricted to U.S. Supreme Court and federal circuit court opinions. State cases are filtered at ingest. Jurisdiction matching is hierarchical — a 9th Circuit query automatically includes SCOTUS precedent.',
  },
  {
    icon:  Heart,
    color: 'text-rose-400',
    bg:    'bg-rose-500/10 border-rose-500/20',
    title: 'Built for mission-driven teams',
    desc:  'Small nonprofit legal teams in animal advocacy have limited research bandwidth. This platform is designed to amplify their impact — surfacing relevant precedent faster, not replacing legal judgment.',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="mb-14">
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
            <span className="chip chip-indigo"><Heart size={11} /> About</span>
            <span className="chip">Open Paws RDP</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-4xl font-bold text-white mb-3">
            Why this exists
          </motion.h1>
          <motion.p variants={fadeUp} className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            An open-source AI platform for animal-advocacy litigation strategy.
          </motion.p>
        </motion.div>

        {/* Mission */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-8 mb-14"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Users size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-white">The problem</h2>
              <p className="text-sm text-gray-500">Who this is for and why it matters</p>
            </div>
          </div>
          <div className="space-y-4 text-gray-400 leading-relaxed">
            <p>
              Animal-advocacy nonprofits and legal clinics often operate with one or two staff
              attorneys handling dozens of active cases. Comprehensive case law research for a
              novel litigation theory — the kind that would take a BigLaw associate a full day —
              is simply not feasible on these timelines and budgets.
            </p>
            <p>
              At the same time, the stakes are high. A poorly-researched standing argument or a
              missed circuit split can end a case before it reaches the merits. Animals have no
              voice in the process; their advocates have to be as effective as possible with
              limited resources.
            </p>
            <p>
              This platform is designed to help: take a claim and facts, retrieve the most
              relevant federal precedent, generate a structured risk assessment with verified
              citations, and surface the strategic considerations a practitioner needs to make
              an informed decision — in seconds, not hours.
            </p>
          </div>
        </motion.div>

        {/* Core principles */}
        <motion.div
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="mb-14"
        >
          <motion.h2 variants={fadeUp} className="font-display text-2xl font-bold text-white mb-2">
            Design principles
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-500 text-sm mb-8">
            Four decisions that shape every part of the system.
          </motion.p>

          <div className="grid md:grid-cols-2 gap-5">
            {PRINCIPLES.map(({ icon: Icon, color, bg, title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="glass-card p-6">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4 ${bg}`}>
                  <Icon size={18} className={color} />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tech stack */}
        <motion.div
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="mb-14"
        >
          <motion.h2 variants={fadeUp} className="font-display text-2xl font-bold text-white mb-2">
            How it's built
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-500 text-sm mb-8">
            Full-stack open source. Runs locally with a single <code className="text-indigo-400 text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded">docker compose up</code>.
          </motion.p>

          <div className="grid md:grid-cols-2 gap-4">
            {TECH_STACK.map(({ layer, icon: Icon, color, bg, items }) => (
              <motion.div key={layer} variants={fadeUp} className="glass-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${bg}`}>
                    <Icon size={16} className={color} />
                  </div>
                  <span className="font-semibold text-white">{layer}</span>
                </div>
                <ul className="space-y-1.5">
                  {items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-400">
                      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

 

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card border border-amber-500/20 bg-amber-500/5 p-6 flex items-start gap-4"
        >
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-white mb-2">Important disclaimer</div>
            <p className="text-sm text-gray-400 leading-relaxed">
              This platform provides <strong className="text-white">informational risk assessments</strong> only.
              Nothing on this site constitutes legal advice, creates an attorney-client relationship, or
              guarantees any litigation outcome. All assessments are grounded in retrieved federal case law
              and every citation is verified before display — but the corpus is limited, AI systems make errors,
              and legal strategy requires qualified counsel familiar with your specific facts and jurisdiction.
              Always consult a licensed attorney before making litigation decisions.
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
