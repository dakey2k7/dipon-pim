import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Tag, FlaskConical, Truck, TrendingUp, FileText,
  Package, Box, Beaker, Layers, Calculator, Store, CreditCard,
  Users, Percent, Settings, ChevronLeft, ChevronRight, DollarSign, Shield,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import logoWhite from '@/assets/logo-white.png'

// Icon mit Glow-Effekt
function GlowIcon({ icon, color, active }: { icon: React.ReactNode; color: string; active: boolean }) {
  return (
    <span className="shrink-0 flex items-center justify-center" style={{
      color: active ? color : undefined,
      filter: active ? `drop-shadow(0 0 6px ${color})` : undefined,
      transition: 'all 0.2s',
    }}>
      {icon}
    </span>
  )
}

const NAV_GROUPS = [
  { label:'Übersicht', items:[
    { label:'Dashboard',        path:'/',              icon:<LayoutDashboard size={15}/>, color:'#8b5cf6' },
    { label:'Kategorien',       path:'/categories',    icon:<Tag size={15}/>,             color:'#a78bfa' },
    { label:'Währungsrechner',  path:'/currency',      icon:<DollarSign size={15}/>,      color:'#06b6d4' },
    { label:'USt-ID Prüfung',   path:'/vat',           icon:<Shield size={15}/>,          color:'#10b981' },
    { label:'Szenarienrechner', path:'/scenario',      icon:<Calculator size={15}/>,      color:'#f59e0b' },
  ]},
  { label:'Einkauf', items:[
    { label:'Lieferanten',     path:'/suppliers',     icon:<Truck size={15}/>,           color:'#10b981' },
    { label:'Rohstoffe',       path:'/materials',     icon:<FlaskConical size={15}/>,    color:'#6366f1' },
    { label:'Preis-Historien', path:'/price-history', icon:<TrendingUp size={15}/>,      color:'#f59e0b' },
    { label:'Dokumente',       path:'/documents',     icon:<FileText size={15}/>,        color:'#94a3b8' },
  ]},
  { label:'Verpackung', items:[
    { label:'Verpackungen',    path:'/packaging',     icon:<Package size={15}/>,         color:'#06b6d4' },
    { label:'Kartonagen',      path:'/cartons',       icon:<Box size={15}/>,             color:'#14b8a6' },
    { label:'Etiketten',       path:'/labels',        icon:<Tag size={15}/>,             color:'#ec4899' },
  ]},
  { label:'Produkte', items:[
    { label:'Produkte',        path:'/products',      icon:<Package size={15}/>,         color:'#8b5cf6' },
    { label:'Rezepturen',      path:'/recipes',       icon:<Layers size={15}/>,          color:'#c4b5fd' },
  ]},
  { label:'Kalkulation', items:[
    { label:'Margenkalkulation',path:'/margins',      icon:<Calculator size={15}/>,      color:'#f59e0b' },
    { label:'Plattformprofile', path:'/platforms',    icon:<Store size={15}/>,           color:'#f97316' },
    { label:'Zahlungsprofile',  path:'/payments',     icon:<CreditCard size={15}/>,      color:'#10b981' },
    { label:'Kundengruppen',    path:'/customers',    icon:<Users size={15}/>,           color:'#06b6d4' },
    { label:'Rabattregeln',     path:'/discounts',    icon:<Percent size={15}/>,         color:'#ef4444' },
  ]},
  { label:'System', items:[
    { label:'Einstellungen',   path:'/settings',      icon:<Settings size={15}/>,        color:'#64748b' },
  ]},
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  return (
    <aside className={`fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-200
      ${sidebarCollapsed?'w-16':'w-64'}`}
      style={{background:'linear-gradient(180deg, #11142a 0%, #0e1124 100%)',borderRight:'1px solid rgb(255 255 255 / 0.06)'}}>
      {/* Logo */}
      <div className={`flex items-center justify-center h-16 px-3 shrink-0`}
        style={{borderBottom:'1px solid rgb(255 255 255 / 0.06)'}}>
        {sidebarCollapsed ? (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{background:'linear-gradient(135deg, #7c3aed 0%, #4a57e5 100%)',border:'1px solid rgb(139 92 246 / 0.4)',boxShadow:'0 0 20px rgb(139 92 246 / 0.3)'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v9M5.6 6.4A9 9 0 1 0 18.4 6.4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2 w-full">
            <img src={logoWhite} alt="DIPON.DE" className="h-8 w-auto object-contain mx-auto"
              style={{filter:'drop-shadow(0 0 8px rgb(139 92 246 / 0.3))'}} draggable={false}/>
            <p className="text-[11px] font-bold select-none text-center w-full"
              style={{
                color:'rgb(216 180 254)',
                textShadow:'0 0 12px rgb(139 92 246), 0 0 24px rgb(139 92 246 / 0.6)',
                letterSpacing:'0.3em',
              }}>PIM Studio</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {NAV_GROUPS.map(g=>(
          <div key={g.label}>
            {!sidebarCollapsed&&(
              <div className="flex items-center gap-2 px-2 mb-2 mt-1">
                <div className="flex-1 h-px" style={{background:'linear-gradient(90deg, rgb(139 92 246 / 0.3), transparent)'}}/>
                <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full select-none"
                  style={{
                    color:'rgb(220 220 255 / 0.7)',
                    background:'rgb(139 92 246 / 0.08)',
                    border:'1px solid rgb(139 92 246 / 0.15)',
                    backdropFilter:'blur(8px)',
                    textShadow:'0 0 10px rgb(167 139 250 / 0.8)',
                  }}>
                  {g.label}
                </span>
                <div className="flex-1 h-px" style={{background:'linear-gradient(90deg, transparent, rgb(139 92 246 / 0.15))'}}/>
              </div>
            )}
            <div className="space-y-0.5">
              {g.items.map(item=>(
                <NavLink key={item.path} to={item.path} end={item.path==='/'}
                  className={({isActive})=>`nav-link ${isActive?'active':''} ${sidebarCollapsed?'justify-center px-0':''}`}
                  title={sidebarCollapsed?item.label:undefined}
                  style={({isActive})=>isActive?{
                    borderColor:`${item.color}40`,
                    background:`${item.color}15`,
                    boxShadow:`0 0 16px ${item.color}20`,
                  }:{}}>
                  {({isActive})=>(
                    <>
                      <GlowIcon icon={item.icon} color={item.color} active={isActive}/>
                      {!sidebarCollapsed&&<span className="truncate">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse */}
      <div className="shrink-0 p-3" style={{borderTop:'1px solid rgb(255 255 255 / 0.05)'}}>
        <button onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-200 transition-colors"
          style={{background:'rgb(255 255 255 / 0.03)'}}>
          {sidebarCollapsed?<ChevronRight size={15}/>:<span className="flex items-center gap-2 text-xs"><ChevronLeft size={15}/>Einklappen</span>}
        </button>
      </div>
    </aside>
  )
}
