import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/',          icon: '▦', label: 'Dashboard',   exact: true },
  { to: '/inventory', icon: '≡', label: 'Inventaire' },
  { to: '/vehicles/new', icon: '＋', label: 'Ajouter' },
  { to: '/capital',   icon: '💵', label: 'Capital',    adminOnly: true },
  { to: '/expenses',  icon: '◈', label: 'Dépenses',   adminOnly: true },
  { to: '/settings',  icon: '⚙', label: 'Paramètres', adminOnly: true },
]

export default function Layout() {
  const [open, setOpen] = useState(true)
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = NAV.filter(n => !n.adminOnly || isAdmin)

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to
    return location.pathname.startsWith(item.to)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className="sidebar hidden md:flex flex-col bg-surface border-r border-line flex-shrink-0 overflow-hidden transition-all duration-300"
        style={{ width: open ? 214 : 56 }}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-between flex-shrink-0 border-b border-line px-3.5"
          style={{ height: 54, justifyContent: open ? 'space-between' : 'center' }}>
          {open && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-snow to-snow3 flex items-center justify-center text-sm flex-shrink-0">◈</div>
              <div>
                <div className="font-display font-black text-snow text-sm tracking-widest">DEALER FM</div>
                <div className="text-dim text-[8px] tracking-widest uppercase -mt-0.5">Finance Manager</div>
              </div>
            </div>
          )}
          {!open && (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-snow to-snow3 flex items-center justify-center text-sm">◈</div>
          )}
          <button onClick={() => setOpen(!open)}
            className="flex-shrink-0 bg-transparent border border-line2 rounded-md w-5 h-5 text-dim text-[9px] flex items-center justify-center cursor-pointer hover:border-line3 transition-colors">
            {open ? '◂' : '▸'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto">
          {open && <div className="text-dim text-[9px] tracking-widest uppercase font-semibold px-2 pt-2 pb-1">Navigation</div>}
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to}
              className={`nav-item px-2.5 py-2.5 relative ${isActive(item) ? 'active' : ''}`}
              style={{ justifyContent: open ? 'flex-start' : 'center' }}
              title={!open ? item.label : undefined}
            >
              {isActive(item) && (
                <div className="absolute left-0 top-[18%] bottom-[18%] w-0.5 bg-snow rounded-r-sm" />
              )}
              <span className="text-sm w-4 text-center flex-shrink-0"
                style={{ color: isActive(item) ? '#F4F3F8' : '#55546A' }}>{item.icon}</span>
              {open && (
                <span className="text-xs" style={{ color: isActive(item) ? '#F4F3F8' : '#55546A' }}>{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-line p-3 flex items-center gap-2.5"
          style={{ justifyContent: open ? 'flex-start' : 'center' }}>
          <div className="w-7 h-7 rounded-full bg-surface3 border border-line3 flex items-center justify-center text-[11px] font-bold text-snow2 flex-shrink-0">
            {profile?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          {open && (
            <div className="flex-1 min-w-0">
              <div className="text-snow text-xs font-medium truncate">{profile?.full_name || 'Utilisateur'}</div>
              <button onClick={handleSignOut} className="text-dim text-[10px] hover:text-stop transition-colors cursor-pointer bg-transparent border-none">
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Outlet />
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-line z-50 flex justify-around items-center pb-safe"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {navItems.map(item => {
          const active = isActive(item)
          return (
            <NavLink key={item.to} to={item.to}
              className="flex flex-col items-center gap-1 px-3 py-2 min-w-[52px]">
              <span className="text-xl leading-none" style={{ color: active ? '#F4F3F8' : '#55546A' }}>{item.icon}</span>
              <span className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: active ? '#F4F3F8' : '#55546A' }}>{item.label}</span>
              {active && <div className="w-3.5 h-0.5 bg-snow rounded-sm" />}
            </NavLink>
          )
        })}
      </nav>

    </div>
  )
}
