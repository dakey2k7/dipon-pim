import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean; onClose: () => void; title?: string; subtitle?: string
  children: React.ReactNode; size?: 'sm'|'md'|'lg'|'xl'; footer?: React.ReactNode
}
const W: Record<string, string> = {
  sm: '420px', md: '560px', lg: '700px', xl: '900px'
}

export function Modal({ open, onClose, title, subtitle, children, size='md', footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    // Prevent body scroll
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5vh 5vw',
      }}>
      {/* Frosted backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(4,6,14,0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}/>

      {/* Modal panel — responsive */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: W[size],
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(8,11,24,0.92)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 40px rgba(70,130,255,0.06), inset 0 1px 0 rgba(255,255,255,0.07)',
          overflow: 'hidden',
          margin: 'auto',
        }}>

        {/* Shimmer top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)',
          pointerEvents: 'none',
        }}/>

        {/* Header */}
        {(title || subtitle) && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            padding: '18px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div>
              {title && <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.95)', lineHeight: 1.2 }}>{title}</h2>}
              {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              style={{
                marginLeft: 16, padding: '6px 8px', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1px solid transparent',
                color: 'rgba(255,255,255,0.4)', flexShrink: 0, display: 'flex',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'white' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)' }}>
              <X size={18}/>
            </button>
          </div>
        )}

        {/* Content — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '14px 24px 18px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  // Portal to document.body — bypasses ALL z-index stacking contexts
  return createPortal(modal, document.body)
}
