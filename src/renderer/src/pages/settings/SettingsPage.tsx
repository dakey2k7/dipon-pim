import { useState } from 'react'
import {
  Palette, HardDrive, User, Shield, Info,
  ChevronRight, Settings as SettingsIcon,
} from 'lucide-react'
import ThemeEditorPage  from './ThemeEditorPage'
import BackupPage       from './BackupPage'

type SettingsTab = 'theme' | 'backup' | 'profile' | 'about'

const TABS = [
  { id:'theme',   label:'Theme & Design',    icon:<Palette size={16}/>,   color:'#8b5cf6', desc:'Farben, Glow, Glassmorphism, Schriften' },
  { id:'backup',  label:'Backup & Restore',  icon:<HardDrive size={16}/>, color:'#06b6d4', desc:'Auto-Backup, Sicherungen, Wiederherstellung' },
  { id:'profile', label:'Profil & Rollen',   icon:<User size={16}/>,      color:'#10b981', desc:'Benutzer, Admin-Rolle, DIPON Hub' },
  { id:'about',   label:'Über DIPON PIM',    icon:<Info size={16}/>,      color:'#f59e0b', desc:'Version, Lizenzen, Support' },
] as const

function ProfileTab() {
  return(
    <div className="space-y-5 max-w-2xl">
      <h2 className="page-title">Profil & Berechtigungen</h2>
      {/* User Card */}
      <div className="glass-card p-6" style={{borderColor:'rgb(139 92 246/0.3)',boxShadow:'0 0 30px rgb(139 92 246/0.1)'}}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
            style={{background:'linear-gradient(135deg,#7c3aed,#4a57e5)',boxShadow:'0 0 24px rgb(139 92 246/0.5)'}}>
            D
          </div>
          <div>
            <p className="text-lg font-bold text-white">DIPON Administrator</p>
            <p className="text-sm text-slate-400">admin@dipon.de</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{background:'rgb(139 92 246/0.2)',color:'#a78bfa'}}>
                <Shield size={10}/> Admin
              </span>
              <span className="text-xs text-slate-500">DIPON PIM Studio v1.0</span>
            </div>
          </div>
        </div>
      </div>
      {/* DIPON Hub Integration */}
      <div className="glass-card p-5" style={{borderColor:'rgb(59 130 246/0.3)'}}>
        <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
          <SettingsIcon size={14}/> DIPON Hub Integration
        </h3>
        <div className="space-y-2 text-sm">
          {[
            {l:'Status',       v:'DIPON PIM Studio – Standalone'},
            {l:'Hub-URL',      v:'Nicht konfiguriert (Phase 4)'},
            {l:'API-Version',  v:'v1.0'},
            {l:'Architektur',  v:'Electron + React + SQLite'},
          ].map(r=>(
            <div key={r.l} className="flex justify-between">
              <span className="text-slate-500">{r.l}</span>
              <span className="text-slate-300">{r.v}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-3">
          Wenn DIPON Hub als Server läuft, kann PIM Studio dort als Modul eingebunden werden.
          Alle Einstellungen werden dann zentral verwaltet.
        </p>
      </div>
      {/* Berechtigungen */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-3">Berechtigungen</h3>
        <div className="grid grid-cols-2 gap-2">
          {['Alle Rohstoffe','Alle Lieferanten','Alle Produkte','Margenkalkulation',
            'Dokumentenablage','USt-ID Prüfung','Backup & Restore','Theme Editor',
            'Benutzer verwalten','Systemeinstellungen'].map(p=>(
            <div key={p} className="flex items-center gap-2 text-xs text-slate-300">
              <span className="text-emerald-400">✓</span>{p}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AboutTab() {
  return(
    <div className="space-y-4 max-w-2xl">
      <h2 className="page-title">Über DIPON PIM Studio</h2>
      <div className="glass-card p-6 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-black text-white"
          style={{background:'linear-gradient(135deg,#7c3aed,#4a57e5)',boxShadow:'0 0 30px rgb(139 92 246/0.5)'}}>
          D
        </div>
        <h3 className="text-xl font-black text-white">DIPON PIM Studio</h3>
        <p className="text-slate-400 text-sm mt-1">Version 1.0.0 · Phase 2 abgeschlossen</p>
        <p className="text-slate-500 text-xs mt-2">DIPON.DE GmbH & Co. KG</p>
      </div>
      <div className="glass-card p-5 space-y-2">
        <h3 className="text-sm font-bold text-slate-200 mb-3">Tech-Stack</h3>
        {[
          {l:'Framework',  v:'Electron 29 + React 18 + TypeScript 5'},
          {l:'Datenbank',  v:'SQLite (better-sqlite3) · WAL-Mode'},
          {l:'UI',         v:'Tailwind CSS + Lucide Icons'},
          {l:'State',      v:'TanStack Query 5 + Zustand 4'},
          {l:'Build',      v:'electron-vite 2 + Webpack'},
          {l:'Node LTS',   v:'Node 20 (nvm-windows)'},
        ].map(r=>(
          <div key={r.l} className="flex justify-between text-sm">
            <span className="text-slate-500">{r.l}</span>
            <span className="text-slate-300 font-mono text-xs">{r.v}</span>
          </div>
        ))}
      </div>
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-2">Phase-Plan</h3>
        {[{l:'Phase 1',v:'Grundgerüst, DB, CRUD',done:true},{l:'Phase 2',v:'Alle Module, Kalkulation, USt-ID',done:true},{l:'Phase 3',v:'Theme Editor, Backup, Charts',done:true},{l:'Phase 4',v:'PrestaShop, Amazon, eBay API',done:false},{l:'Phase 5',v:'DIPON Hub Integration',done:false}].map(p=>(
          <div key={p.l} className="flex items-center gap-3 py-1.5">
            <span className={`text-sm ${p.done?'text-emerald-400':'text-slate-600'}`}>{p.done?'✅':'⏳'}</span>
            <span className="text-sm font-semibold text-slate-300 w-16">{p.l}</span>
            <span className="text-xs text-slate-500">{p.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('theme')
  return(
    <div className="flex gap-5">
      {/* Sidebar */}
      <div className="w-56 shrink-0 space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-600 px-3 mb-3">Einstellungen</p>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group ${
              tab===t.id?'text-white':'text-slate-400 hover:text-slate-200 hover:bg-white/4'}`}
            style={tab===t.id?{background:`${t.color}15`,border:`1px solid ${t.color}30`,boxShadow:`0 0 16px ${t.color}15`}:{border:'1px solid transparent'}}>
            <span style={{color:tab===t.id?t.color:'inherit'}}>{t.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-[10px] text-slate-600 truncate">{t.desc}</p>
            </div>
            <ChevronRight size={13} className={`${tab===t.id?'opacity-100':'opacity-0 group-hover:opacity-50'} transition-opacity`} style={{color:t.color}}/>
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        {tab==='theme'   && <ThemeEditorPage/>}
        {tab==='backup'  && <BackupPage/>}
        {tab==='profile' && <ProfileTab/>}
        {tab==='about'   && <AboutTab/>}
      </div>
    </div>
  )
}
