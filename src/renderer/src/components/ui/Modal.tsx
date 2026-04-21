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
    <div className="fixed flex items-center justify-center p-6" style={{inset:0,zIndex:9999}}>
      {/* Frosted backdrop — see-through */}
      <div className="fixed inset-0"
        style={{
          background: 'rgba(4,6,14,0.55)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
        onClick={onClose}/>

      {/* Modal panel — black frosted glass */}
      <div className={`relative w-full ${W[size]} flex flex-col mx-auto`}
        style={{
          maxHeight: '82vh',
          background: 'rgba(8,11,24,0.82)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 40px rgba(99,102,241,0.08)',
          overflow: 'hidden',
        }}>

        {/* Shimmer top */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:1,
          background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
          pointerEvents:'none',
        }}/>

        {/* Header */}
        {(title||subtitle) && (
          <div className="flex items-start justify-between px-6 pt-5 pb-4 shrink-0"
            style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            <div>
              {title    && <h2 className="text-lg font-bold" style={{color:'rgba(255,255,255,0.95)'}}>{title}</h2>}
              {subtitle && <p className="text-sm mt-0.5" style={{color:'rgba(255,255,255,0.45)'}}>{subtitle}</p>}
            </div>
            <button onClick={onClose}
              className="ml-4 p-1.5 rounded-lg transition-all shrink-0"
              style={{color:'rgba(255,255,255,0.4)'}}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.06)')}
              onMouseLeave={e=>(e.currentTarget.style.background='')}>
              <X size={18}/>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 pb-5 pt-4 shrink-0 flex justify-end gap-3"
            style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
