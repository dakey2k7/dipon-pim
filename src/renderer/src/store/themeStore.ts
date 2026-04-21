import { create } from 'zustand'

// Import MUSS inline sein – kein Top-Level-Import um TDZ zu vermeiden
const getDefaultTheme = () => ({
  id:'default', name:'DIPON Dark', isDefault:true,
  bgPrimary:'#080c18', bgSecondary:'#0c1430', bgCard:'rgba(15,20,45,0.92)',
  accentColor:'#6366f1', textPrimary:'#f0f4ff', textSecondary:'#94a3b8', textMuted:'#475569',
  borderColor:'rgba(255,255,255,0.08)',
  glowEnabled:true, glowIntensity:60, glowColor:'#6366f1', glowSpread:20,
  glassEnabled:true, glassBlur:16, glassOpacity:4, glassBorder:true,
  animatedBorder:false, animatedBg:false, cardHoverScale:true, cardHover3d:false,
  radiusCard:16, radiusButton:12, radiusBadge:8, radiusInput:10,
  fontFamily:'Inter', fontSizeBase:14, fontWeightBody:400,
  bgType:'solid' as const, bgGradient:'', bgImageUrl:'', bgImageBlur:0, bgImageDim:50, bgImageTile:false,
  navStyle:'glass' as const, navGradientFrom:'#7c3aed', navGradientTo:'#4a57e5',
  dotGrid:true, dotGridColor:'#818cf8', dotGridSize:24,
  chartLineColor:'#6366f1', chartGlowEnabled:true, chartGlowStrength:40, chartAreaOpacity:25, chartFontSize:9,
  scrollbarWidth:4, scrollbarColor:'#6366f1', scrollbarTrack:'#0c1028',
  bentoGap:16, bentoRadius:16,
})

export type ThemeConfig = ReturnType<typeof getDefaultTheme>

export function applyThemeToDom(theme: ThemeConfig) {
  try {
    const root = document.documentElement
    const v = (n: string, val: string) => root.style.setProperty(n, val)

    // ── Core colours ──────────────────────────────────────────
    v('--bg-primary',     theme.bgPrimary)
    v('--bg-secondary',   theme.bgSecondary)
    v('--accent',         theme.accentColor)
    v('--text-primary',   theme.textPrimary)
    v('--text-secondary', theme.textSecondary)
    v('--text-muted',     theme.textMuted)
    v('--border-color',   theme.borderColor)

    // ── Glow ─────────────────────────────────────────────────
    const glowAlpha = Math.round(theme.glowIntensity/100*255).toString(16).padStart(2,'0')
    v('--glow-shadow', theme.glowEnabled
      ? `0 0 ${theme.glowSpread}px ${theme.glowColor}${glowAlpha}`
      : 'none')
    v('--glow-text', theme.glowEnabled
      ? `0 0 10px ${theme.glowColor}, 0 0 20px ${theme.glowColor}80`
      : 'none')

    // ── Glass (Frozen Glass Effect) ───────────────────────────
    const glassBlur = theme.glassEnabled ? `blur(${theme.glassBlur}px)` : 'none'
    v('--glass-blur', glassBlur)
    // Frozen glass: very subtle white tint, heavy blur, thin white border
    const glassOpacity = theme.glassEnabled ? theme.glassOpacity / 1000 : 0
    v('--glass-bg', theme.glassEnabled
      ? `rgba(255,255,255,${glassOpacity})`
      : theme.bgSecondary)
    v('--glass-border', theme.glassEnabled
      ? `rgba(255,255,255,${Math.min(glassOpacity * 4, 0.15)})`
      : theme.borderColor)

    // ── Radius ────────────────────────────────────────────────
    v('--radius-card',  `${theme.radiusCard}px`)
    v('--radius-btn',   `${theme.radiusButton}px`)
    v('--radius-badge', `${theme.radiusBadge}px`)
    v('--radius-input', `${theme.radiusInput}px`)

    // ── Typography ────────────────────────────────────────────
    v('--font-family', `"${theme.fontFamily}", Inter, system-ui, sans-serif`)
    v('--font-size',   `${theme.fontSizeBase}px`)

    // ── Charts / Scrollbar ────────────────────────────────────
    v('--chart-line',      theme.chartLineColor)
    v('--scrollbar-w',     `${theme.scrollbarWidth}px`)
    v('--scrollbar-color', theme.scrollbarColor)

    // ── Direct DOM updates (override Tailwind inline) ─────────
    if (document.body) {
      document.body.style.background = theme.bgPrimary
      document.body.style.color      = theme.textPrimary
    }
    root.style.background = theme.bgPrimary
    root.style.color      = theme.textPrimary

    // Inject a dynamic style tag for Tailwind overrides
    const styleId = 'dipon-theme-overrides'
    let styleEl = document.getElementById(styleId) as HTMLStyleElement|null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    // Also update :root CSS vars directly for Tailwind overrides
    const slate = {
      50:'#f8fafc', 100:'#f1f5f9', 200:'#e2e8f0', 300:'#cbd5e1',
      400:'#94a3b8', 500:'#64748b', 600:'#475569', 700:'#334155',
      800:'#1e293b', 900:'#0f172a'
    }
    // Map theme text colors to slate-like variables
    root.style.setProperty('--color-text-primary',   theme.textPrimary)
    root.style.setProperty('--color-text-secondary', theme.textSecondary)
    root.style.setProperty('--color-text-muted',     theme.textMuted)
    root.style.setProperty('--color-bg-primary',     theme.bgPrimary)
    root.style.setProperty('--color-bg-secondary',   theme.bgSecondary)
    root.style.setProperty('--color-accent',         theme.accentColor)
    root.style.setProperty('--color-border',         theme.borderColor)

    styleEl.textContent = `
      /* ══ DIPON Dynamic Theme Overrides ══ */
      :root {
        --bg-primary:     ${theme.bgPrimary};
        --bg-secondary:   ${theme.bgSecondary};
        --accent:         ${theme.accentColor};
        --text-primary:   ${theme.textPrimary};
        --text-secondary: ${theme.textSecondary};
        --text-muted:     ${theme.textMuted};
        --border-color:   ${theme.borderColor};
      }
      html, body, #root { 
        background: ${theme.bgPrimary} !important; 
        color: ${theme.textPrimary} !important;
      }
      /* Font family only - no font-size on root to avoid rem scaling */
      body * { font-family: "${theme.fontFamily}", Inter, system-ui, sans-serif; }
      .glass-card {
        background: ${theme.glassEnabled
          ? `rgba(255,255,255,${glassOpacity})`
          : theme.bgSecondary} !important;
        backdrop-filter: ${glassBlur} !important;
        -webkit-backdrop-filter: ${glassBlur} !important;
        border-color: ${theme.glassEnabled
          ? `rgba(255,255,255,${Math.min(glassOpacity*4,0.15)})`
          : theme.borderColor} !important;
        border-radius: ${theme.radiusCard}px !important;
      }
      .glass-card::before {
        background: linear-gradient(90deg, transparent, ${theme.accentColor}50, transparent) !important;
      }
      h1,h2,h3,h4,h5,.page-title { color: ${theme.textPrimary} !important; }
      p,.page-subtitle,label { color: ${theme.textSecondary}; }
      .text-slate-100,.text-slate-200,.text-white { color: ${theme.textPrimary} !important; }
      .text-slate-300,.text-slate-400 { color: ${theme.textSecondary} !important; }
      .text-slate-500,.text-slate-600 { color: ${theme.textMuted} !important; }
      .border-white\/5, .border-white\/8, .border-white\/10 { border-color: ${theme.borderColor} !important; }
      .bg-brand-500, [class*="bg-brand"] { background: ${theme.accentColor} !important; }
      .text-brand-400, .text-brand-500, [class*="text-brand"] { color: ${theme.accentColor} !important; }
      .sidebar-shell { background: ${theme.bgSecondary} !important; }
      .nav-link.active {
        background: ${theme.accentColor}20 !important;
        border-color: ${theme.accentColor}30 !important;
        box-shadow: ${theme.glowEnabled ? `0 0 ${theme.glowSpread}px ${theme.glowColor}${glowAlpha}` : 'none'} !important;
      }
      .nav-link.active span { color: ${theme.accentColor} !important; }
      .table-td { color: ${theme.textSecondary} !important; }
      .table-th { color: ${theme.textMuted} !important; }
      .table-row:hover { background: ${theme.accentColor}08 !important; }
      .form-input, select, input[type="text"], input[type="number"], input[type="email"] {
        background: rgba(255,255,255,0.04) !important;
        border-color: ${theme.borderColor} !important;
        color: ${theme.textPrimary} !important;
        border-radius: ${theme.radiusButton}px !important;
      }
      .btn-ghost { color: ${theme.textSecondary} !important; }
      .btn-ghost:hover { color: ${theme.textPrimary} !important; background: ${theme.accentColor}15 !important; }
      
      /* Text color overrides - comprehensive */
      .text-white, .text-slate-50, .text-slate-100, .text-slate-200 { color: ${theme.textPrimary} !important; }
      .text-slate-300, .text-slate-400 { color: ${theme.textSecondary} !important; }
      .text-slate-500, .text-slate-600, .text-slate-700 { color: ${theme.textMuted} !important; }
      
      /* Sidebar */
      .sidebar-shell, aside { background: ${theme.bgSecondary} !important; border-color: ${theme.borderColor} !important; }
      [class*="sidebar"] { color: ${theme.textSecondary} !important; }
      
      /* Topbar */
      header, [class*="topbar"], [class*="top-bar"] { 
        background: ${theme.bgPrimary}e6 !important; 
        border-color: ${theme.borderColor} !important;
      }

      /* All cards and containers */
      .glass-card, [class*="glass-card"] {
        background: linear-gradient(145deg, rgba(15,20,45,0.92) 0%, rgba(8,11,28,0.96) 100%) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        border: 1px solid rgba(255,255,255,0.07) !important;
        border-radius: ${theme.radiusCard}px !important;
        color: ${theme.textPrimary} !important;
        box-shadow: 0 4px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05) !important;
      }
      .glass-card::before {
        background: linear-gradient(90deg, transparent, ${theme.accentColor}50, transparent) !important;
      }

      /* Background */
      .min-h-screen, main, [class*="page"], [class*="content"] {
        background: ${theme.bgPrimary} !important;
        color: ${theme.textPrimary} !important;
      }

      /* Inputs */
      input, select, textarea, .form-input {
        background: rgba(255,255,255,0.05) !important;
        border-color: ${theme.borderColor} !important;
        color: ${theme.textPrimary} !important;
        border-radius: ${theme.radiusInput}px !important;
      }
      input::placeholder, textarea::placeholder { color: ${theme.textMuted} !important; }

      /* Buttons */
      button, .btn { border-radius: ${theme.radiusButton}px; }
      [class*="btn-primary"], [class*="bg-brand"] { background: ${theme.accentColor} !important; }
      [class*="text-brand"] { color: ${theme.accentColor} !important; }
      [class*="border-brand"] { border-color: ${theme.accentColor} !important; }

      /* Navigation */
      .nav-link.active {
        background: ${(theme as any).navStyle==='gradient'
          ? `linear-gradient(135deg,${(theme as any).navGradientFrom||theme.accentColor}40,${(theme as any).navGradientTo||theme.accentColor}20)`
          : `${theme.accentColor}22`} !important;
        border-color: ${theme.accentColor}35 !important;
        box-shadow: ${theme.glowEnabled?`0 0 12px ${(theme as any).navGradientFrom||theme.accentColor}25`:'none'} !important;
      }
      .nav-link.active svg, .nav-link.active span { color: ${theme.accentColor} !important; }
      /* Sidebar background */
      .sidebar-shell {
        background: ${(theme as any).navStyle==='gradient'
          ? `linear-gradient(180deg,${(theme as any).navGradientFrom||theme.bgSecondary}18,${theme.bgSecondary})`
          : theme.bgSecondary} !important;
      }

      /* Tables */
      .table-th { color: ${theme.textMuted} !important; }
      .table-td { color: ${theme.textSecondary} !important; }
      .table-row:hover { background: ${theme.accentColor}08 !important; }
      tr, td, th { border-color: ${theme.borderColor} !important; }

      /* Badges */
      [class*="badge"] { border-radius: ${theme.radiusBadge}px !important; }

      /* Scrollbar */
      ::-webkit-scrollbar { width: ${theme.scrollbarWidth}px !important; }
      ::-webkit-scrollbar-track { background: ${theme.scrollbarTrack} !important; border-radius: 99px; }
      ::-webkit-scrollbar-thumb { background: ${theme.scrollbarColor} !important; border-radius: 99px; }
      ::-webkit-scrollbar-thumb:hover { background: ${theme.accentColor} !important; }

      /* Page titles */
      .page-title, h1, h2, h3 { color: ${theme.textPrimary} !important; }
      .page-subtitle { color: ${theme.textMuted} !important; }

      /* Headings & labels */
      label, p { color: ${theme.textSecondary}; }
    `

    // Class toggles
    theme.animatedBorder
      ? root.classList.add('animated-borders')
      : root.classList.remove('animated-borders')
    theme.cardHover3d
      ? root.classList.add('hover-3d')
      : root.classList.remove('hover-3d')

  } catch (e) { console.error('Theme apply error:', e) }
}

interface ThemeStore {
  active:   ThemeConfig
  profiles: ThemeConfig[]
  setActive:     (t: ThemeConfig) => void
  saveProfile:   (t: ThemeConfig) => void
  deleteProfile: (id: string) => void
  resetDefault:  () => void
}

// Gespeichertes Theme aus localStorage laden (ohne persist-Middleware → kein TDZ)
function loadSaved(): ThemeConfig {
  try {
    const raw = localStorage.getItem('dipon-theme-active')
    if (raw) return { ...getDefaultTheme(), ...JSON.parse(raw) }
  } catch {}
  return getDefaultTheme()
}
function loadProfiles(): ThemeConfig[] {
  try {
    const raw = localStorage.getItem('dipon-theme-profiles')
    if (raw) return JSON.parse(raw)
  } catch {}
  return [getDefaultTheme()]
}

const initialTheme = (() => {
  const saved = loadSaved()
  // Safety: if background looks wrong (too bright or blue), reset to default
  const bg = saved.bgPrimary || ''
  if (!bg.startsWith('#0') && !bg.startsWith('#1') && bg !== '#0c0e1a') {
    try { localStorage.removeItem('dipon-theme-active') } catch {}
    return getDefaultTheme()
  }
  return saved
})()
// Theme sofort beim Laden anwenden
if (typeof document !== 'undefined') applyThemeToDom(initialTheme)

export const useThemeStore = create<ThemeStore>()((set) => ({
  active:   initialTheme,
  profiles: loadProfiles(),

  setActive: (theme) => {
    try { localStorage.setItem('dipon-theme-active', JSON.stringify(theme)) } catch {}
    applyThemeToDom(theme)
    set({ active: theme })
  },

  saveProfile: (theme) => {
    set((s) => {
      const idx = s.profiles.findIndex(p => p.id === theme.id)
      const profiles = idx >= 0
        ? s.profiles.map((p,i) => i === idx ? theme : p)
        : [...s.profiles, theme]
      try { localStorage.setItem('dipon-theme-profiles', JSON.stringify(profiles)) } catch {}
      try { localStorage.setItem('dipon-theme-active',   JSON.stringify(theme)) } catch {}
      applyThemeToDom(theme)
      return { active: theme, profiles }
    })
  },

  deleteProfile: (id) => {
    set((s) => {
      const profiles = s.profiles.filter(p => p.id !== id)
      try { localStorage.setItem('dipon-theme-profiles', JSON.stringify(profiles)) } catch {}
      return { profiles }
    })
  },

  resetDefault: () => {
    const d = getDefaultTheme()
    try { localStorage.removeItem('dipon-theme-active') } catch {}
    applyThemeToDom(d)
    set({ active: d })
  },
}))
