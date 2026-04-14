import React from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'

/* ── Badge ──────────────────────────────────────────────────── */
export function Badge({ variant='slate', children, className='' }:
  { variant?:'green'|'red'|'amber'|'blue'|'slate'|'cyan'; children:React.ReactNode; className?:string }) {
  return <span className={`badge-${variant} ${className}`}>{children}</span>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative glass-card border border-white/10 p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-bold text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onCancel}>Abbrechen</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Wird gelöscht …' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
