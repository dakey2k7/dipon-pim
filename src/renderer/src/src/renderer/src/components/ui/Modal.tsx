import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean; onClose: () => void; title?: string; subtitle?: string
  children: React.ReactNode; size?: 'sm'|'md'|'lg'|'xl'; footer?: React.ReactNode
}
const W: Record<string,string> = { sm:'max-w-md', md:'max-w-xl', lg:'max-w-2xl', xl:'max-w-4xl' }

export function Modal({ open, onClose, title, subtitle, children, size='md', footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key==='Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${W[size]} glass-card border border-white/10
        shadow-2xl flex flex-col max-h-[90vh]`}>
        {(title||subtitle) && (
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/5 shrink-0">
            <div>
              {title    && <h2 className="text-lg font-bold text-slate-100">{title}</h2>}
              {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose}
              className="ml-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 pb-5 pt-4 border-t border-white/5 shrink-0 flex justify-end gap-3">{footer}</div>
        )}
      </div>
    </div>
  )
}
