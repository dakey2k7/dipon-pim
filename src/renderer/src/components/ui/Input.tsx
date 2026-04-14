import React from 'react'
import { Loader2 } from 'lucide-react'

/* ── Button ─────────────────────────────────────────────────── */
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary'|'secondary'|'danger'|'ghost'
  size?: 'sm'|'md'|'lg'
  loading?: boolean
  icon?: React.ReactNode
}
const V: Record<string,string> = { primary:'btn-primary', secondary:'btn-secondary', danger:'btn-danger', ghost:'btn-ghost' }
const S: Record<string,string> = { sm:'text-xs px-3 py-1.5', md:'', lg:'text-base px-5 py-2.5' }
export function Button({ variant='primary', size='md', loading=false, icon, children, disabled, className='', ...p }: BtnProps) {
  return (
    <button className={`${V[variant]} ${S[size]} ${className}`} disabled={disabled||loading} {...p}>
      {loading ? <Loader2 size={14} className="animate-spin shrink-0" /> : icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </button>
  )
}

/* ── Input ──────────────────────────────────────────────────── */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?:string; error?:string; hint?:string }
export function Input({ label, error, hint, className='', ...p }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="form-label">{label}</label>}
      <input className={`form-input ${error ? 'border-red-500/50 focus:ring-red-500/40' : ''} ${className}`} {...p} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/* ── Select ─────────────────────────────────────────────────── */
interface SelProps extends React.SelectHTMLAttributes<HTMLSelectElement> { label?:string; error?:string; hint?:string }
export function Select({ label, error, hint, className='', children, ...p }: SelProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="form-label">{label}</label>}
      <select className={`form-input ${error ? 'border-red-500/50' : ''} ${className}`} {...p}>{children}</select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/* ── Textarea ───────────────────────────────────────────────── */
interface TaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { label?:string; error?:string }
export function Textarea({ label, error, className='', ...p }: TaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="form-label">{label}</label>}
      <textarea rows={3} className={`form-input resize-none ${error?'border-red-500/50':''} ${className}`} {...p} />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
