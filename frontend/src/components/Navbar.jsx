import { Link, useLocation } from 'react-router-dom'
import { Scale, History, Search, Sun, Moon, Database, FlaskConical, Info } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function Navbar() {
  const { pathname } = useLocation()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const links = [
    { to: '/analyze',  label: 'Analyze',  icon: Search      },
    { to: '/examples', label: 'Examples', icon: FlaskConical },
    { to: '/sources',  label: 'Sources',  icon: Database     },
    { to: '/history',  label: 'History',  icon: History      },
    { to: '/about',    label: 'About',    icon: Info         },
  ]

  const activeStyle = {
    background: 'rgba(99,102,241,0.18)',
    color: isDark ? '#a5b4fc' : '#4f46e5',
    border: '1px solid rgba(99,102,241,0.30)',
    boxShadow: '0 0 12px rgba(99,102,241,0.15)',
  }

  const inactiveColor = isDark ? 'rgba(156,163,175,1)' : 'rgba(55,65,81,1)'

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: isDark
          ? 'rgba(10,8,30,0.92)'
          : 'rgba(238,236,255,0.92)',
        backdropFilter: 'blur(24px) saturate(150%)',
        borderBottom: isDark
          ? '1px solid rgba(99,102,241,0.18)'
          : '1px solid rgba(99,102,241,0.20)',
        boxShadow: isDark
          ? '0 1px 0 rgba(99,102,241,0.08), 0 4px 32px rgba(0,0,0,0.5)'
          : '0 1px 0 rgba(99,102,241,0.10), 0 4px 24px rgba(99,102,241,0.08)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            }}
          >
            <Scale size={16} className="theme-logo-icon" />
          </div>
          <span className="font-display font-bold text-lg text-white tracking-tight">
            Open<span className="text-gradient">Paws</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-0.5">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                style={active ? activeStyle : { color: inactiveColor, border: '1px solid transparent' }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.color = isDark ? 'white' : '#0f172a'
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.color = inactiveColor
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <Icon size={13} />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-secondary theme-toggle"
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            aria-pressed={isDark}
            title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            <span className="hidden sm:inline text-xs font-medium">
              {isDark ? 'Light' : 'Dark'}
            </span>
          </button>

          <span className="chip chip-emerald text-xs hidden md:inline-flex">
            <span className="live-dot" />
            Federal Corpus
          </span>
        </div>
      </div>
    </nav>
  )
}
