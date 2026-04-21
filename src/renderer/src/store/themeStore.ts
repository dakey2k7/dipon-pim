import { create } from 'zustand'

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
  // Blur Admin Felder
  blurOverlayEnabled: false,
  blurOverlayColor:   '#00bcd4',
  blurOverlayIntensity: 30,
  blurOverlaySpots:   3,
})

export type ThemeConfig = ReturnType<typeof getDefaultTheme>
export type ThemeMode   = 'dark' | 'light' | 'custom' | 'blur-admin'

// ── Preset: Light ─────────────────────────────────────────────
export const LIGHT_THEME: ThemeConfig = {
  ...getDefaultTheme(),
  id:'light', name:'DIPON Light', isDefault:false,
  bgPrimary:'#f8fafc', bgSecondary:'#ffffff', bgCard:'rgba(255,255,255,1)',
  accentColor:'#4f46e5',
  textPrimary:'#0f172a', textSecondary:'#475569', textMuted:'#94a3b8',
  borderColor:'rgba(0,0,0,0.09)',
  glowEnabled:false, glassEnabled:false, glassOpacity:0,
  dotGrid:false,
  scrollbarTrack:'#e2e8f0', scrollbarColor:'#4f46e5',
  fontWeightBody: 400,
  blurOverlayEnabled:false,
  navGradientFrom:'#4f46e5', navGradientTo:'#4338ca',
}

// ── Preset: Blur Admin ────────────────────────────────────────
export const BLUR_ADMIN_THEME: ThemeConfig = {
  ...getDefaultTheme(),
  id:'blur-admin', name:'Blur Admin', isDefault:false,
  bgPrimary:'#1b1e24', bgSecondary:'#252a33', bgCard:'rgba(37,42,51,0.88)',
  accentColor:'#2ec4b6',
  textPrimary:'#ffffff', textSecondary:'#c4cad3', textMuted:'#6b7785',
  borderColor:'rgba(255,255,255,0.07)',
  glowEnabled:true, glowIntensity:40, glowColor:'#2ec4b6', glowSpread:16,
  glassEnabled:true, glassBlur:20, glassOpacity:5, glassBorder:true,
  navStyle:'gradient' as const, navGradientFrom:'#2ec4b6', navGradientTo:'#0097a7',
  dotGrid:false,
  chartLineColor:'#2ec4b6',
  scrollbarColor:'#2ec4b6', scrollbarTrack:'#1b1e24',
  blurOverlayEnabled:true,
  blurOverlayColor:'#00bcd4',
  blurOverlayIntensity:30,
  blurOverlaySpots:3,
}

export const DARK_THEME: ThemeConfig = {
  ...getDefaultTheme(),
  fontWeightBody: 300,
}

// Alle Built-in Presets
export const BUILTIN_THEMES: ThemeConfig[] = [
  DARK_THEME,
  LIGHT_THEME,
  BLUR_ADMIN_THEME,
]

export function applyThemeToDom(theme: ThemeConfig) {
  try {
    const root = document.documentElement
    const v = (n: string, val: string) => root.style.setProperty(n, val)

    v('--bg-primary',     theme.bgPrimary)
    v('--bg-secondary',   theme.bgSecondary)
    v('--accent',         theme.accentColor)
    v('--text-primary',   theme.textPrimary)
    v('--text-secondary', theme.textSecondary)
    v('--text-muted',     theme.textMuted)
    v('--border-color',   theme.borderColor)

    const glowAlpha = Math.round(theme.glowIntensity/100*255).toString(16).padStart(2,'0')
    v('--glow-shadow', theme.glowEnabled ? `0 0 ${theme.glowSpread}px ${theme.glowColor}${glowAlpha}` : 'none')
    v('--glow-text',   theme.glowEnabled ? `0 0 10px ${theme.glowColor}, 0 0 20px ${theme.glowColor}80` : 'none')

    const glassBlur    = theme.glassEnabled ? `blur(${theme.glassBlur}px)` : 'none'
    const glassOpacity = theme.glassEnabled ? theme.glassOpacity / 1000 : 0
    v('--glass-blur',   glassBlur)
    v('--glass-bg',     theme.glassEnabled ? `rgba(255,255,255,${glassOpacity})` : theme.bgSecondary)
    v('--glass-border', theme.glassEnabled ? `rgba(255,255,255,${Math.min(glassOpacity*4,0.15)})` : theme.borderColor)
    v('--radius-card',  `${theme.radiusCard}px`)
    v('--radius-btn',   `${theme.radiusButton}px`)
    v('--radius-badge', `${theme.radiusBadge}px`)
    v('--radius-input', `${theme.radiusInput}px`)
    v('--font-family',  `"${theme.fontFamily}", Inter, system-ui, sans-serif`)
    v('--chart-line',   theme.chartLineColor)
    v('--scrollbar-w',  `${theme.scrollbarWidth}px`)
    v('--scrollbar-color', theme.scrollbarColor)
    root.style.setProperty('--color-accent', theme.accentColor)

    if (document.body) { document.body.style.background = theme.bgPrimary; document.body.style.color = theme.textPrimary }
    root.style.background = theme.bgPrimary
    root.style.color = theme.textPrimary

    const isLight = theme.bgPrimary.startsWith('#f') || theme.bgPrimary.startsWith('#e')
    const cardBg  = isLight ? 'rgba(255,255,255,0.95)' : 'linear-gradient(145deg,rgba(15,20,45,0.92),rgba(8,11,28,0.96))'
    const inputBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'

    const styleId = 'dipon-theme-overrides'
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl) }

    styleEl.textContent = `
      :root { --bg-primary:${theme.bgPrimary};--bg-secondary:${theme.bgSecondary};--accent:${theme.accentColor};--text-primary:${theme.textPrimary};--text-secondary:${theme.textSecondary};--text-muted:${theme.textMuted};--border-color:${theme.borderColor}; }
      html,body,#root { background:${theme.bgPrimary} !important; color:${theme.textPrimary} !important; }
      body * { font-family:"${theme.fontFamily}",Inter,system-ui,sans-serif; }
      .glass-card { background:${isLight ? 'rgba(255,255,255,0.97)' : cardBg} !important; backdrop-filter:${isLight?'none':glassBlur} !important; -webkit-backdrop-filter:${isLight?'none':glassBlur} !important; border:1px solid ${theme.borderColor} !important; border-radius:${theme.radiusCard}px !important; color:${theme.textPrimary} !important; box-shadow:${isLight ? '0 1px 8px rgba(0,0,0,0.06)' : '0 4px 32px rgba(0,0,0,0.55)'} !important; }
      /* Light mode overrides */
      ${isLight ? `
        .page-subtitle, label, p { color: ${theme.textSecondary} !important; }
        .text-slate-800, .text-slate-900, .text-gray-900 { color: ${theme.textPrimary} !important; }
        select option { background: #ffffff; color: ${theme.textPrimary}; }
        .form-input, input, select, textarea { background: rgba(0,0,0,0.04) !important; color: ${theme.textPrimary} !important; }
      ` : ''}
      h1,h2,h3,h4,.page-title { color:${theme.textPrimary} !important; }
      .text-white,.text-slate-100,.text-slate-200 { color:${theme.textPrimary} !important; }
      .text-slate-300,.text-slate-400 { color:${theme.textSecondary} !important; }
      .text-slate-500,.text-slate-600 { color:${theme.textMuted} !important; }
      .bg-brand-500,[class*="bg-brand"] { background:${theme.accentColor} !important; }
      .text-brand-400,.text-brand-500,[class*="text-brand"] { color:${theme.accentColor} !important; }
      aside,.sidebar-shell { background:${theme.bgSecondary} !important; border-color:${theme.borderColor} !important; }
      header { background:${theme.bgPrimary}e6 !important; border-color:${theme.borderColor} !important; }
      .nav-link.active { background:${theme.accentColor}20 !important; border-color:${theme.accentColor}35 !important; }
      .nav-link.active svg,.nav-link.active span { color:${theme.accentColor} !important; }
      input,select,textarea,.form-input { background:${inputBg} !important; border-color:${theme.borderColor} !important; color:${theme.textPrimary} !important; border-radius:${theme.radiusInput}px !important; }
      input::placeholder,textarea::placeholder { color:${theme.textMuted} !important; }
      .page-subtitle { color:${theme.textMuted} !important; }
      ::-webkit-scrollbar { width:${theme.scrollbarWidth}px !important; }
      ::-webkit-scrollbar-track { background:${theme.scrollbarTrack} !important; }
      ::-webkit-scrollbar-thumb { background:${theme.scrollbarColor} !important; border-radius:99px; }
      tr,td,th { border-color:${theme.borderColor} !important; }
    `

    theme.animatedBorder ? root.classList.add('animated-borders') : root.classList.remove('animated-borders')
  } catch(e) { console.error('Theme apply error:', e) }
}

interface ThemeStore {
  active:    ThemeConfig
  mode:      ThemeMode
  profiles:  ThemeConfig[]
  externalThemes: ThemeConfig[]
  setMode:        (m: ThemeMode) => void
  setActive:      (t: ThemeConfig) => void
  saveProfile:    (t: ThemeConfig) => void
  deleteProfile:  (id: string) => void
  addExternal:    (t: ThemeConfig) => void
  removeExternal: (id: string) => void
  resetDefault:   () => void
  updateBlurColor:(color: string) => void
  updateBlurIntensity:(intensity: number) => void
}

function ls(key: string, fallback: unknown) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch { return fallback }
}
function lsSet(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

const savedMode: ThemeMode = (localStorage.getItem('dipon-theme-mode') as ThemeMode) || 'dark'
const savedCustom = { ...getDefaultTheme(), ...ls('dipon-theme-active', {}) }
const savedExternals: ThemeConfig[] = ls('dipon-theme-externals', [BLUR_ADMIN_THEME])

const getInitialTheme = (): ThemeConfig => {
  if (savedMode === 'dark')       return DARK_THEME
  if (savedMode === 'light')      return LIGHT_THEME
  if (savedMode === 'blur-admin') {
    const saved = ls('dipon-blur-admin-theme', BLUR_ADMIN_THEME)
    return { ...BLUR_ADMIN_THEME, ...saved }
  }
  return savedCustom
}

const initialTheme = getInitialTheme()
if (typeof document !== 'undefined') applyThemeToDom(initialTheme)

export const useThemeStore = create<ThemeStore>()((set, get) => ({
  active:         initialTheme,
  mode:           savedMode,
  profiles:       ls('dipon-theme-profiles', [DARK_THEME]),
  externalThemes: savedExternals,

  setMode: (mode) => {
    let theme: ThemeConfig
    if (mode === 'dark')         theme = DARK_THEME
    else if (mode === 'light')   theme = LIGHT_THEME
    else if (mode === 'blur-admin') {
      const saved = ls('dipon-blur-admin-theme', BLUR_ADMIN_THEME)
      theme = { ...BLUR_ADMIN_THEME, ...saved }
    }
    else theme = savedCustom
    localStorage.setItem('dipon-theme-mode', mode)
    applyThemeToDom(theme)
    set({ mode, active: theme })
  },

  setActive: (theme) => {
    lsSet('dipon-theme-active', theme)
    applyThemeToDom(theme)
    set({ active: theme })
  },

  saveProfile: (theme) => {
    set(s => {
      const idx = s.profiles.findIndex(p => p.id === theme.id)
      const profiles = idx >= 0 ? s.profiles.map((p,i) => i===idx?theme:p) : [...s.profiles, theme]
      lsSet('dipon-theme-profiles', profiles)
      lsSet('dipon-theme-active', theme)
      applyThemeToDom(theme)
      return { active: theme, profiles }
    })
  },

  deleteProfile: (id) => {
    set(s => {
      const profiles = s.profiles.filter(p => p.id !== id)
      lsSet('dipon-theme-profiles', profiles)
      return { profiles }
    })
  },

  addExternal: (theme) => {
    set(s => {
      const list = s.externalThemes.filter(t => t.id !== theme.id)
      const next = [...list, theme]
      lsSet('dipon-theme-externals', next)
      return { externalThemes: next }
    })
  },

  removeExternal: (id) => {
    set(s => {
      const list = s.externalThemes.filter(t => t.id !== id)
      lsSet('dipon-theme-externals', list)
      return { externalThemes: list }
    })
  },

  updateBlurColor: (color) => {
    set(s => {
      const updated = { ...s.active, blurOverlayColor: color, blurOverlayEnabled: true }
      if (s.mode === 'blur-admin') lsSet('dipon-blur-admin-theme', updated)
      applyThemeToDom(updated)
      return { active: updated }
    })
  },

  updateBlurIntensity: (intensity) => {
    set(s => {
      const updated = { ...s.active, blurOverlayIntensity: intensity, blurOverlayEnabled: true }
      if (s.mode === 'blur-admin') lsSet('dipon-blur-admin-theme', updated)
      applyThemeToDom(updated)
      return { active: updated }
    })
  },

  resetDefault: () => {
    localStorage.setItem('dipon-theme-mode', 'dark')
    localStorage.removeItem('dipon-theme-active')
    applyThemeToDom(DARK_THEME)
    set({ active: DARK_THEME, mode: 'dark' })
  },
}))
