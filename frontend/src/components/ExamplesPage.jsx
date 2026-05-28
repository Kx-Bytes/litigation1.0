import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  FlaskConical, ArrowRight, ShieldCheck, ShieldAlert,
  Scale, BookOpen, Zap, ChevronRight,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } }

/* ── Example queries ──────────────────────────────────────────────────────── */
const EXAMPLES = [
  {
    id:           'esa-critical-habitat',
    icon:         Scale,
    color:        'indigo',
    badge:        '9th Circuit',
    title:        'ESA Critical Habitat Designation',
    summary:      'Agency failure to designate critical habitat under the Endangered Species Act.',
    jurisdiction: 'US-9th-Cir',
    claim:        'Federal agency unlawfully failed to designate critical habitat for listed species under Section 4 of the Endangered Species Act',
    facts:        'The U.S. Fish and Wildlife Service listed the Pacific pocket mouse as an endangered species but failed to designate critical habitat within the statutory one-year period. Plaintiffs, an animal advocacy nonprofit, filed a citizen suit under 16 U.S.C. § 1540(g) alleging the agency\'s failure constitutes a violation of ESA § 4(b)(6). The agency argues it lacked sufficient information and that designation would be economically harmful. The 9th Circuit has addressed ESA critical habitat deadlines in prior cases.',
    expectedBand: 'medium',
  },
  {
    id:           'awa-research-exemption',
    icon:         FlaskConical,
    color:        'violet',
    badge:        '7th Circuit',
    title:        'AWA Research Facility Exemption Challenge',
    summary:      'Challenge to the USDA\'s exclusion of rats and mice from Animal Welfare Act protections.',
    jurisdiction: 'US-7th-Cir',
    claim:        'USDA\'s regulatory exclusion of rats, mice, and birds from Animal Welfare Act coverage is arbitrary and capricious under the APA',
    facts:        'Plaintiffs challenge a USDA rule that, by regulation, excludes rats, mice, and birds bred for research from the definition of "animal" under the Animal Welfare Act (7 U.S.C. § 2132(g)). The exclusion means research facilities using these species are not subject to AWA housing, care, and veterinary requirements. Plaintiffs argue the exclusion contradicts the plain text of the AWA and was promulgated without adequate notice-and-comment under the APA. The 7th Circuit has addressed AWA standing issues in prior animal advocacy litigation.',
    expectedBand: 'low',
  },
  {
    id:           'scotus-standing',
    icon:         BookOpen,
    color:        'purple',
    badge:        'SCOTUS',
    title:        'Organizational Standing — Wildlife Advocates',
    summary:      'Standing for animal advocacy nonprofit to challenge wildlife import regulations.',
    jurisdiction: 'US',
    claim:        'Animal advocacy organization has Article III standing to challenge federal wildlife import permit regulations based on members\' aesthetic and recreational interests in observing animals in the wild',
    facts:        'An animal advocacy nonprofit challenges USFWS regulations governing import permits for exotic animals used in travelling circuses. The organization\'s members include wildlife researchers and zoo professionals who have submitted declarations attesting to their interest in observing the animals at issue in their natural habitat and the concrete harm they suffer from the permitted imports. The government argues the members\' interests are too attenuated and that the organization lacks representational standing. SCOTUS precedent on organizational standing and aesthetic injury is directly applicable.',
    expectedBand: 'high',
  },
  {
    id:           'incidental-take',
    icon:         Zap,
    color:        'amber',
    badge:        '10th Circuit',
    title:        'Incidental Take Permit — Habitat Modification',
    summary:      'Challenge to incidental take permit authorising habitat modification for listed species.',
    jurisdiction: 'US-10th-Cir',
    claim:        'USFWS incidental take permit authorising habitat modification constitutes an unlawful "take" under ESA Section 9 because the biological opinion\'s jeopardy analysis was arbitrary and capricious',
    facts:        'A developer received an incidental take permit (ITP) under ESA § 10 authorising the destruction of approximately 200 acres of forested habitat occupied by a listed bat species. Plaintiffs argue the accompanying biological opinion failed to adequately analyse jeopardy to the species and that habitat modification constituting significant impairment of breeding constitutes a prohibited "take" under 16 U.S.C. § 1538. The 10th Circuit has addressed habitat modification and ESA take prohibitions in prior decisions.',
    expectedBand: 'medium',
  },
]

const COLOR_MAP = {
  indigo: {
    chip:   'chip-indigo',
    icon:   'text-indigo-400',
    bg:     'bg-indigo-500/10 border-indigo-500/20',
    badge:  'bg-indigo-500/12 border-indigo-500/25 text-indigo-300',
    hover:  'hover:border-indigo-500/40',
    btn:    'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/25 text-indigo-300',
  },
  violet: {
    chip:   '',
    icon:   'text-violet-400',
    bg:     'bg-violet-500/10 border-violet-500/20',
    badge:  'bg-violet-500/12 border-violet-500/25 text-violet-300',
    hover:  'hover:border-violet-500/40',
    btn:    'bg-violet-500/15 hover:bg-violet-500/25 border-violet-500/25 text-violet-300',
  },
  purple: {
    chip:   '',
    icon:   'text-purple-400',
    bg:     'bg-purple-500/10 border-purple-500/20',
    badge:  'bg-purple-500/12 border-purple-500/25 text-purple-300',
    hover:  'hover:border-purple-500/40',
    btn:    'bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/25 text-purple-300',
  },
  amber: {
    chip:   '',
    icon:   'text-amber-400',
    bg:     'bg-amber-500/10 border-amber-500/20',
    badge:  'bg-amber-500/12 border-amber-500/25 text-amber-300',
    hover:  'hover:border-amber-500/40',
    btn:    'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/25 text-amber-300',
  },
}

const BAND_CONFIG = {
  high:   { icon: ShieldCheck, color: 'text-emerald-400', label: 'Expected: High confidence' },
  medium: { icon: ShieldAlert,  color: 'text-amber-400',  label: 'Expected: Medium confidence' },
  low:    { icon: ShieldAlert,  color: 'text-red-400',    label: 'Expected: Low confidence' },
}

/* ── Sample output mockup data ───────────────────────────────────────────── */
const MOCK_RESULT = {
  claim: 'Animal advocacy organization has Article III standing to challenge wildlife import permit regulations',
  jurisdiction: 'U.S. Supreme Court',
  band: 'high',
  summary: 'Based on retrieved federal precedent, the organizational standing claim presents a viable but fact-intensive argument. SCOTUS has recognised aesthetic and recreational injuries as sufficient for Article III standing when members demonstrate concrete plans to return to the affected area. The strength of the claim depends heavily on the specificity of the members\' declarations.',
  factors: [
    {
      label: 'Aesthetic Injury Standing',
      weight: 'high',
      discussion: 'SCOTUS has held that aesthetic and recreational interests in observing animals are cognisable Article III injuries, but members must show concrete, particularised harm rather than a general interest.',
      citations: ['504 U.S. 555 (1992)', '565 U.S. 452 (2012)'],
    },
    {
      label: 'Representational Standing Requirements',
      weight: 'medium',
      discussion: 'For organisational standing, at least one member must have individual standing, the interests must be germane to the organisation\'s purpose, and neither the claim nor relief must require individual member participation.',
      citations: ['455 U.S. 363 (1982)'],
    },
  ],
  cases: [
    { citation: '504 U.S. 555 (1992)', name: 'Lujan v. Defenders of Wildlife', relevance: 'Defines concrete injury requirements for environmental standing' },
    { citation: '565 U.S. 452 (2012)', name: 'Clapper v. Amnesty International', relevance: 'Requires imminent, not speculative, injury for standing' },
  ],
}

function BandBadge({ band }) {
  const cfg = BAND_CONFIG[band]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      <Icon size={13} />
      {cfg.label}
    </span>
  )
}

function MockWeightBadge({ weight }) {
  const map = {
    high:   'bg-red-500/15 border-red-500/25 text-red-400',
    medium: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
    low:    'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${map[weight]}`}>
      {weight}
    </span>
  )
}

export default function ExamplesPage() {
  const navigate = useNavigate()

  function tryExample(ex) {
    navigate('/analyze', {
      state: { prefill: { jurisdiction: ex.jurisdiction, claim: ex.claim, facts: ex.facts } },
    })
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="mb-14">
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
            <span className="chip chip-indigo"><FlaskConical size={11} /> Examples</span>
            <span className="chip">Pre-built queries</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-4xl font-bold text-white mb-3">
            Example litigation queries
          </motion.h1>
          <motion.p variants={fadeUp} className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            Four real-world scenarios from animal-advocacy federal litigation. Click "Try this" to
            pre-fill the analysis form and run the pipeline.
          </motion.p>
        </motion.div>

        {/* Example cards */}
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="space-y-5 mb-20"
        >
          {EXAMPLES.map((ex) => {
            const cls = COLOR_MAP[ex.color]
            const Icon = ex.icon
            return (
              <motion.div
                key={ex.id}
                variants={fadeUp}
                className={`glass-card p-7 transition-all duration-300 ${cls.hover}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${cls.bg}`}>
                      <Icon size={18} className={cls.icon} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-white">{ex.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-lg border font-mono font-medium ${cls.badge}`}>
                          {ex.badge}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{ex.summary}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <BandBadge band={ex.expectedBand} />
                    <button
                      onClick={() => tryExample(ex)}
                      className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-all duration-200 ${cls.btn}`}
                    >
                      Try this
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Claim */}
                <div className="mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Claim</div>
                  <p className="text-sm text-gray-300 leading-relaxed bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
                    {ex.claim}
                  </p>
                </div>

                {/* Facts preview */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Facts (preview)</div>
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                    {ex.facts}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Sample output section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="chip chip-emerald">Sample output</span>
            <span className="chip">What a real result looks like</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-white mb-2">What you get back</h2>
          <p className="text-gray-500 text-sm mb-8">
            Based on the SCOTUS standing example above — a real pipeline result (simplified).
          </p>

          {/* Mock result card */}
          <div className="glass-card overflow-hidden">

            {/* Result header bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-5 border-b border-white/[0.07]">
              <div>
                <div className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wider">Query</div>
                <p className="text-sm text-white font-medium max-w-lg">{MOCK_RESULT.claim}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600 font-mono">{MOCK_RESULT.jurisdiction}</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                  <ShieldCheck size={14} />
                  High confidence
                </span>
              </div>
            </div>

            <div className="p-7 space-y-6">

              {/* Summary */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Assessment summary</div>
                <p className="text-sm text-gray-300 leading-relaxed">{MOCK_RESULT.summary}</p>
              </div>

              {/* Risk factors */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">
                  Risk factors ({MOCK_RESULT.factors.length})
                </div>
                <div className="space-y-3">
                  {MOCK_RESULT.factors.map((f, i) => (
                    <div key={i} className="glass-card p-4 bg-white/[0.02]">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-sm font-semibold text-white">{f.label}</span>
                        <MockWeightBadge weight={f.weight} />
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed mb-2">{f.discussion}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {f.citations.map(c => (
                          <span key={c} className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparable cases */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">
                  Comparable cases ({MOCK_RESULT.cases.length})
                </div>
                <div className="space-y-2">
                  {MOCK_RESULT.cases.map((c, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <ChevronRight size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-indigo-400">{c.citation}</span>
                          <span className="text-xs text-gray-400 font-medium">{c.name}</span>
                        </div>
                        <p className="text-xs text-gray-500">{c.relevance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="border-t border-white/[0.07] px-7 py-5 flex items-center justify-between">
              <p className="text-xs text-gray-600">
                All citations verified against the database before display.
              </p>
              <button
                onClick={() => tryExample(EXAMPLES[2])}
                className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5"
              >
                Run this query
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
