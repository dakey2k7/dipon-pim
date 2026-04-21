/**
 * GlowCard – Unified bento card design used across all grid views.
 * Dark glass background with type-specific color glow.
 */
import React from 'react'

interface GlowCardProps {
  color?: string
  icon?: React.ReactNode
  isActive?: boolean
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  title: string
  subtitle?: string
  badge?: string
  meta?: { label: string; value: React.ReactNode }[]
  highlight?: React.ReactNode  // e.g. price
  footer?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export function GlowCard({
  color = '#8b5cf6',
  icon,
  isActive = true,
  onClick,
  onEdit,
  onDelete,
  title,
  subtitle,
  badge,
  meta = [],
  highlight,
  footer,
  children,
}: GlowCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden transition-all duration-200"
      style={{
        background: `linear-gradient(135deg, ${color}12 0%, rgba(0,0,0,0.45) 100%)`,
        border: `1px solid ${color}28`,
        borderRadius: 16,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: `0 4px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)`,
        cursor: onClick ? 'pointer' : 'default',
        padding: 18,
      }}
      onMouseEnter={e => {
        if (onClick) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 36px rgba(0,0,0,0.45), 0 0 20px ${color}18, inset 0 1px 0 rgba(255,255,255,0.08)`
        ;(e.currentTarget as HTMLElement).style.borderColor = `${color}45`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.transform = ''
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 4px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)`
        ;(e.currentTarget as HTMLElement).style.borderColor = `${color}28`
      }}>
      {/* Shimmer top edge */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg, transparent, ${color}55, transparent)` }}/>

      {/* Header row */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
        {/* Icon */}
        {icon && (
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${color}22`,
            border: `1px solid ${color}40`,
            boxShadow: `0 0 20px ${color}30`,
            fontSize: 22,
            color,
            filter: `drop-shadow(0 0 6px ${color})`,
          }}>
            {icon}
          </div>
        )}

        {/* Status dot + action buttons */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {(onEdit || onDelete) && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display:'flex', gap:4 }}>
              {onEdit && (
                <button onClick={e=>{e.stopPropagation();onEdit()}}
                  style={{ padding:'4px 8px', borderRadius:8, fontSize:10, fontWeight:600,
                    background:`${color}18`, border:`1px solid ${color}35`, color: 'rgba(255,255,255,0.8)' }}>
                  ✏
                </button>
              )}
              {onDelete && (
                <button onClick={e=>{e.stopPropagation();onDelete()}}
                  style={{ padding:'4px 8px', borderRadius:8, fontSize:10,
                    background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171' }}>
                  ✕
                </button>
              )}
            </div>
          )}
          {/* Active dot */}
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: isActive ? '#10b981' : '#334155',
            boxShadow: isActive ? '0 0 8px #10b981, 0 0 3px #10b981' : 'none',
          }}/>
        </div>
      </div>

      {/* Title */}
      <p style={{ fontWeight: 800, fontSize: 15, color: 'white', marginBottom: 3, lineHeight: 1.2 }}
        className="truncate">{title}</p>

      {/* Subtitle / code */}
      {subtitle && (
        <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
          {subtitle}
        </p>
      )}

      {/* Badge */}
      {badge && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: `${color}20`, border: `1px solid ${color}35`, color, display:'inline-block', marginBottom: 8 }}>
          {badge}
        </span>
      )}

      {/* Meta rows */}
      {meta.map((m, i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom: 4, fontSize: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>{m.label}</span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{m.value}</span>
        </div>
      ))}

      {/* Custom children */}
      {children}

      {/* Highlight (e.g. price) */}
      {highlight && (
        <div style={{ marginTop: 10 }}>
          {highlight}
        </div>
      )}

      {/* Footer */}
      {footer && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid rgba(255,255,255,0.06)` }}>
          {footer}
        </div>
      )}
    </div>
  )
}
