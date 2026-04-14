import { create } from 'zustand'

// Import MUSS inline sein – kein Top-Level-Import um TDZ zu vermeiden
const getDefaultTheme = () => ({
  id:'default', name:'DIPON Dark', isDefault:true,
  bgPrimary:'#0c0e1a', bgSecondary:'#11142a', bgCard:'rgba(255,255,255,0.04)',
  accentColor:'#8b5cf6', textPrimary:'#f8fafc', textSecondary:'#94a3b8', textMuted:'#475569',
  borderColor:'rgba(255,255,255,0.08)',
  glowEnabled:true, glowIntensity:60, glowColor:'#8b5cf6', glowSpread:20,
  glassEnabled:true, glassBlur:16, glassOpacity:4, glassBorder:true,
  animatedBorder:false, animatedBg:false, cardHoverScale:true, cardHover3d:false,
  radiusCard:16, radiusButton:12, radiusBadge:8, radiusInput:10,
  fontFamily:'Inter', fontSizeBase:14, fontWeightBody:400,
  bgType:'solid' as const, bgGradient:'', bgImageUrl:'', bgImageBlur:0, bgImageDim:50, bgImageTile:false,
  dotGrid:true, dotGridColor:'#6366f1', dotGridSize:24,
  chartLineColor:'#8b5cf6', chartGlowEnabled:true, chartGlowStrength:40, chartAreaOpacity:25, chartFontSize:9,
  scrollbarWidth:4, scrollbarColor:'#8b5cf6', scrollbarTrack:'#1e2035',
  bentoGap:16, bentoRadius:16,
})

export type ThemeConfig = ReturnType<typeof getDefaultTheme>

export function applyThemeToDom(theme: ThemeConfig) {
  try {
    const root = document.documentElement
    const v = (n: string, val: string) => root.style.setProperty(n, val)
    v('--bg-primary',    theme.bgPrimary)
    v('--bg-secondary',  theme.bgSecondary)
    v('--accent',        theme.accentColor)
    v('--text-primary',  theme.textPrimary)
    v('--text-secondary',theme.textSecondary)
    v('--text-muted',    theme.textMuted)
    v('--border-color',  theme.borderColor)
    const glowAlpha = Math.round(theme.glowIntensity/100*255).toString(16).padStart(2,'0')
    v('--glow-shadow',  theme.glowEnabled ? `0 0 ${theme.glowSpread}px ${theme.glowColor}${glowAlpha}` : 'none')
    v('--glass-blur',   theme.glassEnabled ? `blur(${theme.glassBlur}px)` : 'none')
    v('--glass-bg',     theme.glassEnabled ? `rgba(255,255,255,${theme.glassOpacity/1000})` : `${theme.bgSecondary}dd`)
    v('--radius-card',  `${theme.radiusCard}px`)
    v('--radius-btn',   `${theme.radiusButton}px`)
    v('--radius-badge', `${theme.radiusBadge}px`)
    v('--radius-input', `${theme.radiusInput}px`)
    v('--font-family',  `"${theme.fontFamily}", Inter, system-ui, sans-serif`)
    v('--font-size',    `${theme.fontSizeBase}px`)
    v('--chart-line',   theme.chartLineColor)
    v('--scrollbar-w',  `${theme.scrollbarWidth}px`)
    v('--scrollbar-color', theme.scrollbarColor)
    v('--bg-app',       theme.bgPrimary)
    // Animated border class
    theme.animatedBorder ? root.classList.add('animated-borders') : root.classList.remove('animated-borders')
  } catch {}
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

const initialTheme = loadSaved()
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
