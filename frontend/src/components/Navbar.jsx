import { Link, useLocation } from 'react-router-dom'
import { Scale, History, Search } from 'lucide-react'

export default function Navbar() {
  const { pathname } = useLocation()

  const links = [
    { to: '/',        label: 'Home',    icon: Scale  },
    { to: '/analyze', label: 'Analyze', icon: Search },
    { to: '/history', label: 'History', icon: History },
  ]

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(6,13,31,0.80)',
        backdropFilter: 'blur(24px) saturate(150%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            }}
          >
            <Scale size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg text-white tracking-tight">
            Open<span className="text-gradient">Paws</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                style={active ? {
                  background: 'rgba(99,102,241,0.18)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99,102,241,0.30)',
                  boxShadow: '0 0 12px rgba(99,102,241,0.15)',
                } : {
                  color: 'rgba(156,163,175,1)',
                  border: '1px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.color = 'white'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.color = 'rgba(156,163,175,1)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <Icon size={14} />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Status chip */}
        <div className="flex items-center gap-2">
          <span className="chip chip-emerald text-xs">
            <span className="live-dot" />
            Federal Corpus
          </span>
        </div>
      </div>
    </nav>
  )
}
