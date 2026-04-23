import React from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

/* ── Badge ──────────────────────────────────────────────────── */
export function Badge({ variant='slate', children, className='' }:
  { variant?:'green'|'red'|'amber'|'blue'|'slate'|'cyan'; children:React.ReactNode; className?:string }) {
  return <span className={`badge-${variant} ${className}`}>{children}</span>
}


/* ── Skeleton ───────────────────────────────────────────────── */
function SkeletonBase({ className='', style={} }: { className?:string; style?:React.CSSProperties }) {
  return (
    <div className={`animate-pulse rounded-lg ${className}`}
      style={{background:'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)',backgroundSize:'200% 100%',...style}}/>
  )
}

export function SkeletonText({ lines=1, className='' }:{ lines?:number; className?:string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({length:lines}).map((_,i)=>(
        <SkeletonBase key={i} className="h-3" style={{width: i===lines-1&&lines>1 ? '65%':'100%'}}/>
      ))}
    </div>
  )
}

export function SkeletonCard({ className='' }:{ className?:string }) {
  return (
    <div className={`glass-card p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <SkeletonBase className="w-8 h-8 rounded-xl shrink-0"/>
        <div className="flex-1 space-y-2">
          <SkeletonBase className="h-3 w-3/4"/>
          <SkeletonBase className="h-2 w-1/2"/>
        </div>
      </div>
      <SkeletonBase className="h-2"/>
      <SkeletonBase className="h-2 w-4/5"/>
    </div>
  )
}

export function SkeletonTable({ rows=5, cols=4 }:{ rows?:number; cols?:number }) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-white/5">
        {Array.from({length:cols}).map((_,i)=>(
          <SkeletonBase key={i} className="h-2.5" style={{flex:i===0?2:1}}/>
        ))}
      </div>
      {/* Rows */}
      {Array.from({length:rows}).map((_,r)=>(
        <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-white/4">
          {Array.from({length:cols}).map((_,c)=>(
            <SkeletonBase key={c} className="h-3" style={{flex:c===0?2:1, opacity: 0.7+Math.random()*0.3}}/>
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonKpi() {
  return (
    <div className="glass-card p-5 space-y-3">
      <SkeletonBase className="h-2.5 w-20"/>
      <SkeletonBase className="h-10 w-16"/>
      <SkeletonBase className="h-2 w-24"/>
    </div>
  )
  return createPortal(dialog, document.body)
}

export function SkeletonList({ items=5 }:{ items?:number }) {
  return (
    <div className="space-y-2">
      {Array.from({length:items}).map((_,i)=>(
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
          style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)'}}>
          <SkeletonBase className="w-8 h-8 rounded-xl shrink-0"/>
          <div className="flex-1 space-y-1.5">
            <SkeletonBase className="h-3" style={{width:`${60+Math.random()*30}%`}}/>
            <SkeletonBase className="h-2" style={{width:`${40+Math.random()*20}%`}}/>
          </div>
          <SkeletonBase className="h-3 w-16 shrink-0"/>
        </div>
      ))}
    </div>
  )
}

/* ── Card ───────────────────────────────────────────────────── */
export function Card({ children, className='', hover=false, onClick, padding=true }:
  { children:React.ReactNode; className?:string; hover?:boolean; onClick?:()=>void; padding?:boolean }) {
  return (
    <div onClick={onClick}
      className={`glass-card ${padding?'p-5':''} ${hover?'hover:border-white/10 cursor-pointer transition-all duration-150':''} ${className}`}>
      {children}
    </div>
  )
}

/* ── KPI Card ───────────────────────────────────────────────── */
export function KpiCard({ title, value, subtitle, icon, accentColor='#6366f1' }:
  { title:string; value:string|number; subtitle?:string; icon?:React.ReactNode; trend?:number|null; accentColor?:string }) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        {icon && (
          <div className="p-2 rounded-xl" style={{ background:`${accentColor}20`, color:accentColor }}>{icon}</div>
        )}
      </div>
      <p className="text-3xl font-bold text-slate-100 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

/* ── Toast Container ────────────────────────────────────────── */
const ICON = {
  success: <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />,
  error:   <XCircle      size={16} className="text-red-400 shrink-0" />,
  info:    <Info         size={16} className="text-brand-400 shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-400 shrink-0" />,
}
const BORDER = { success:'border-emerald-500/30', error:'border-red-500/30', info:'border-brand-500/30', warning:'border-amber-500/30' }

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore()
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80">
      {toasts.map(t => (
        <div key={t.id} className={`glass-card border ${BORDER[t.type]} px-4 py-3 flex items-start gap-3 shadow-xl`}>
          {ICON[t.type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100">{t.title}</p>
            {t.message && <p className="text-xs text-slate-400 mt-0.5">{t.message}</p>}
          </div>
          <button onClick={() => removeToast(t.id)} className="p-0.5 text-slate-500 hover:text-slate-200 shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ── Empty State ────────────────────────────────────────────── */
export function EmptyState({ icon, title, description, action }:
  { icon?:React.ReactNode; title:string; description?:string; action?:React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-slate-600 mb-4">{icon}</div>}
      <p className="text-base font-semibold text-slate-400">{title}</p>
      {description && <p className="text-sm text-slate-600 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ── Spinner ────────────────────────────────────────────────── */
export function Spinner({ size=20 }: { size?:number }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500"
        style={{ width:size, height:size }} />
    </div>
  )
}

/* ── Confirm Dialog ─────────────────────────────────────────── */
export function ConfirmDialog({ open, title, message, confirmLabel='Löschen', onConfirm, onCancel, loading }:
  { open:boolean; title:string; message:string; confirmLabel?:string;
    onConfirm:()=>void; onCancel:()=>void; loading?:boolean }) {
  if (!open) return null
  return createPortal(
    <div style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{position:'fixed',inset:0,background:'rgba(4,6,14,0.6)',backdropFilter:'blur(16px)'}} onClick={onCancel}/>
      <div style={{position:'relative',width:'100%',maxWidth:400,background:'rgba(8,11,24,0.92)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,backdropFilter:'blur(32px)',boxShadow:'0 32px 80px rgba(0,0,0,0.8)',padding:24,margin:'auto'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)',pointerEvents:'none'}}/>
        <h3 style={{fontSize:17,fontWeight:800,color:'rgba(255,255,255,0.95)',marginBottom:8}}>{title}</h3>
        <p style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:24,lineHeight:1.5}}>{message}</p>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button className="btn-secondary" onClick={onCancel}>Abbrechen</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Wird gelöscht …' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
