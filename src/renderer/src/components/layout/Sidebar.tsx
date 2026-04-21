import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Tag, FlaskConical, Truck, TrendingUp, FileText, Trash2,
  Package, Box, Layers, Calculator, Store, CreditCard, Table2, Swords,
  Users, Percent, Settings, ChevronLeft, ChevronRight, DollarSign, Shield,
} from 'lucide-react'
import { useAppStore }   from '@/store/appStore'
import { useThemeStore } from '@/store/themeStore'
import logoWhite         from '@/assets/logo-white.png'

const NAV_GROUPS = [
  { label: 'Übersicht', items: [
    { label: 'Dashboard',       path: '/',              icon: <LayoutDashboard size={15}/>, color: '#6366f1' },
    { label: 'Kategorien',      path: '/categories',    icon: <Tag size={15}/>,             color: '#818cf8' },
    { label: 'Währungsrechner', path: '/currency',      icon: <DollarSign size={15}/>,      color: '#06b6d4' },
    { label: 'USt-ID Prüfung', path: '/vat',           icon: <Shield size={15}/>,          color: '#10b981' },
    { label: 'Szenario',       path: '/scenario',      icon: <Calculator size={15}/>,      color: '#f59e0b' },
  ]},
  { label: 'Einkauf', items: [
    { label: 'Lieferanten',     path: '/suppliers',     icon: <Truck size={15}/>,           color: '#10b981' },
    { label: 'Rohstoffe',       path: '/materials',     icon: <FlaskConical size={15}/>,    color: '#6366f1' },
    { label: 'Preis-Historien', path: '/price-history', icon: <TrendingUp size={15}/>,      color: '#f59e0b' },
    { label: 'Dokumente',       path: '/documents',     icon: <FileText size={15}/>,        color: '#94a3b8' },
  ]},
  { label: 'Verpackung', items: [
    { label: 'Verpackungen',    path: '/packaging',     icon: <Package size={15}/>,         color: '#06b6d4' },
    { label: 'Kartonagen',      path: '/cartons',       icon: <Box size={15}/>,             color: '#14b8a6' },
    { label: 'Etiketten',       path: '/labels',        icon: <Tag size={15}/>,             color: '#ec4899' },
  ]},
  { label: 'Produkte', items: [
    { label: 'Produkte',           path: '/products',          icon: <Package size={15}/>, color: '#6366f1' },
    { label: 'Rezepturen',         path: '/recipes',           icon: <Layers size={15}/>,  color: '#818cf8' },
    { label: '2K Systeme',         path: '/systems',           icon: <Layers size={15}/>,  color: '#06b6d4' },
    { label: 'Varianten-Vorlagen', path: '/variant-templates', icon: <Tag size={15}/>,     color: '#f59e0b' },
  ]},
  { label: 'Kalkulation', items: [
    { label: 'Preistabelle',     path: '/preistabelle',  icon: <Table2 size={15}/>,     color: '#06b6d4' },
    { label: 'Wettbewerb',       path: '/wettbewerb',    icon: <Swords size={15}/>,     color: '#ef4444' },
    { label: 'Systempreise',     path: '/system-prices', icon: <TrendingUp size={15}/>, color: '#10b981' },
    { label: 'Margenkalkulation',path: '/margins',       icon: <Calculator size={15}/>, color: '#f59e0b' },
    { label: 'Plattformprofile', path: '/platforms',     icon: <Store size={15}/>,      color: '#f97316' },
    { label: 'Zahlungsprofile',   path: '/payment-profiles', icon: <CreditCard size={15}/>, color: '#10b981' },
    { label: 'EU OSS / MwSt',      path: '/vat-rates',        icon: <Shield size={15}/>,    color: '#06b6d4' },
    { label: 'Versandkosten',       path: '/shipping-manager', icon: <Truck size={15}/>,     color: '#f97316' },
    { label: 'Kundengruppen',    path: '/customers',     icon: <Users size={15}/>,      color: '#06b6d4' },
    { label: 'Rabattregeln',     path: '/discounts',     icon: <Percent size={15}/>,    color: '#ef4444' },
    { label: 'Papierkorb',       path: '/trash',         icon: <Trash2 size={15}/>,     color: '#ef4444' },
  ]},
  { label: 'Presta-Kalkulation', items: [
    { label: 'PSM-Kalkulation',  path: '/psm-kalkulation', icon: <FileText size={15}/>, color: '#10b981' },
  ]},
  { label: 'System', items: [
    { label: 'Einstellungen', path: '/settings', icon: <Settings size={15}/>, color: '#64748b' },
  ]},
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const store = useThemeStore()
  const active = store.active
  const mode   = store.mode ?? 'dark'
  const isLight = mode === 'light'

  const sidebarBg     = isLight ? '#ffffff' : `linear-gradient(180deg,#11142a 0%,#0e1124 100%)`
  const borderColor   = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'
  const dividerColor  = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'
  const labelColor    = isLight ? 'rgba(0,0,0,0.35)'  : 'rgba(148,163,184,0.5)'
  const textColor     = isLight ? '#1e293b'            : '#e2e8f0'
  const collapseColor = isLight ? '#64748b'            : '#64748b'

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}
      style={{ background: sidebarBg, borderRight: `1px solid ${borderColor}` }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-3 shrink-0"
        style={{ borderBottom: `1px solid ${dividerColor}` }}>
        {sidebarCollapsed ? (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg,#7c3aed,#4a57e5)`, border: '1px solid rgba(139,92,246,0.4)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v9M5.6 6.4A9 9 0 1 0 18.4 6.4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2 w-full">
            <img src={logoWhite} alt="DIPON" className="h-8 w-auto object-contain"
              style={{ filter: isLight ? 'invert(1) brightness(0.3)' : 'drop-shadow(0 0 8px rgba(139,92,246,0.3))' }}
              draggable={false}/>
            <p className="text-[11px] font-bold select-none"
              style={{ color: isLight ? active.accentColor : 'rgb(216,180,254)', letterSpacing: '0.3em',
                textShadow: isLight ? 'none' : '0 0 12px rgb(139,92,246)' }}>
              PIM Studio
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {NAV_GROUPS.map(g => (
          <div key={g.label}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 px-2 mb-2 mt-1">
                <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg,${dividerColor},transparent)` }}/>
                <span className="text-[9px] font-bold tracking-widest uppercase select-none"
                  style={{ color: labelColor, letterSpacing: '0.12em' }}>{g.label}</span>
                <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg,transparent,${dividerColor})` }}/>
              </div>
            )}
            <div className="space-y-0.5">
              {g.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                  title={sidebarCollapsed ? item.label : undefined}
                  style={({ isActive }) => isActive ? {
                    borderColor: `${item.color}50`,
                    background:  isLight
                      ? `${item.color}12`
                      : `linear-gradient(135deg,${item.color}18,${item.color}06)`,
                    boxShadow: isLight ? 'none' : `0 0 18px ${item.color}30,inset 0 1px 0 rgba(255,255,255,0.07)`,
                  } : {}}
                >
                  {({ isActive }) => (
                    <>
                      <span className="shrink-0 flex items-center justify-center" style={{
                        color:  isActive ? item.color : isLight ? '#475569' : `${item.color}c0`,
                        filter: isActive && !isLight ? `drop-shadow(0 0 8px ${item.color}) drop-shadow(0 0 4px ${item.color})` : 'none',
                        transition: 'color 0.2s, filter 0.2s',
                      }}>
                        {item.icon}
                      </span>
                      {!sidebarCollapsed && (
                        <span className="truncate font-medium" style={{ color: isActive ? item.color : textColor }}>
                          {item.label}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Button */}
      <div className="shrink-0 p-3" style={{ borderTop: `1px solid ${dividerColor}` }}>
        <button onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-xl transition-colors"
          style={{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)', color: collapseColor }}>
          {sidebarCollapsed
            ? <ChevronRight size={15}/>
            : <span className="flex items-center gap-2 text-xs"><ChevronLeft size={15}/>Einklappen</span>
          }
        </button>
      </div>
    </aside>
  )
}
