import { Link, useLocation } from 'react-router-dom'
import { Scale, History, Search } from 'lucide-react'

export default function Navbar() {
  const { pathname } = useLocation()

  const links = [
    { to: '/',        label: 'Home',    icon: Scale },
    { to: '/analyze', label: 'Analyze', icon: Search },
    { to: '/history', label: 'History', icon: History },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/8"
         style={{ background: 'rgba(6, 13, 31, 0.85)', backdropFilter: 'blur(20px)' }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all">
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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${active
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/8'
                  }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
            Federal Corpus
          </span>
        </div>
      </div>
    </nav>
  )
}
